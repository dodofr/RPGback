import prisma from '../../config/database';
import { CombatStatus } from '@prisma/client';
import { CreateCombatRequest, CharacterEquipment, ArmeData, LigneDegats } from '../../types';
import { characterService } from '../character.service';
import { initializeInitiative, getCombatState, executeAction, moveEntity, endTurn, fleeCombat } from './engine';
import { loadGridTemplate } from './grid';
import { addLog } from './combatLog';

export class CombatService {
  async create(data: CreateCombatRequest) {
    // Gather player characters — either from a group or a solo character
    let playerChars: { id: number; nom: string; joueurId: number; raceId: number; force: number; intelligence: number; dexterite: number; agilite: number; vie: number; chance: number; or: number; poidsMaxInventaire: number; niveau: number; experience: number; pointsStatsDisponibles: number; mapId: number | null; positionX: number; positionY: number; equipements: any }[] = [];

    if (data.groupeId) {
      const group = await prisma.groupe.findUnique({
        where: { id: data.groupeId },
        include: {
          personnages: {
            include: {
              personnage: {
                include: { race: true },
              },
            },
          },
        },
      });
      if (!group) throw new Error('Group not found');
      if (group.personnages.length === 0) throw new Error('Group has no characters');
      playerChars = group.personnages.map(gp => gp.personnage as any);
    } else if (data.personnageId) {
      const char = await prisma.personnage.findUnique({
        where: { id: data.personnageId },
        include: { race: true },
      });
      if (!char) throw new Error('Character not found');
      playerChars = [char as any];
    } else {
      throw new Error('Either groupeId or personnageId is required');
    }

    // Get map with cases and spawns
    const map = await prisma.map.findUnique({
      where: { id: data.mapId },
      include: {
        cases: true,
        spawns: { orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }] },
      },
    });
    if (!map) throw new Error('Map not found');

    // Get spawn positions sorted by ordre
    const playerSpawns = map.spawns
      .filter(s => s.equipe === 0)
      .sort((a, b) => a.ordre - b.ordre);
    const enemySpawns = map.spawns
      .filter(s => s.equipe === 1)
      .sort((a, b) => a.ordre - b.ordre);

    if (playerChars.length > playerSpawns.length) {
      throw new Error('Not enough player spawn positions');
    }

    if (data.monstres.length > enemySpawns.length) {
      throw new Error('Not enough enemy spawn positions');
    }

    // Create combat with grid dimensions
    const combat = await prisma.combat.create({
      data: {
        status: CombatStatus.EN_COURS,
        grilleLargeur: map.largeur,
        grilleHauteur: map.hauteur,
        groupeId: data.groupeId ?? null,
        personnageId: data.personnageId ?? null,
        mapId: data.mapId,
      },
    });

    // Create entities for player characters (team 0) at spawn positions
    for (let i = 0; i < playerChars.length; i++) {
      const char = playerChars[i];
      const spawn = playerSpawns[i];

      const totalStats = await characterService.getTotalStats(char.id);

      // Snapshot weapon data — try inventory first, then legacy JSON
      let armeData: ArmeData | null = null;
      const equippedWeapon = await prisma.inventaireItem.findFirst({
        where: { personnageId: char.id, estEquipe: true, equipement: { slot: 'ARME' } },
        include: { equipement: { include: { lignesDegats: { orderBy: { ordre: 'asc' } } } } },
      });

      const armeSource = equippedWeapon?.equipement ?? null;
      if (!armeSource) {
        // Fallback: legacy JSON
        const equipment = char.equipements as CharacterEquipment;
        const armeId = equipment['ARME'];
        if (armeId) {
          const arme = await prisma.equipement.findUnique({
            where: { id: armeId },
            include: { lignesDegats: { orderBy: { ordre: 'asc' } } },
          });
          if (arme && arme.coutPA != null) {
            const lignes: LigneDegats[] = arme.lignesDegats.map(l => ({
              ordre: l.ordre,
              degatsMin: l.degatsMin,
              degatsMax: l.degatsMax,
              statUtilisee: l.statUtilisee,
              estVolDeVie: l.estVolDeVie,
              estSoin: l.estSoin,
            }));
            armeData = {
              nom: arme.nom,
              chanceCritBase: arme.chanceCritBase ?? 0.05,
              bonusCrit: arme.bonusCrit ?? 0,
              coutPA: arme.coutPA ?? 3,
              porteeMin: arme.porteeMin ?? 1,
              porteeMax: arme.porteeMax ?? 1,
              ligneDeVue: arme.ligneDeVue ?? true,
              zoneId: arme.zoneId,
              cooldown: arme.cooldown ?? 0,
              tauxEchec: arme.tauxEchec ?? 0,
              lignes,
            };
          }
        }
      } else {
        // Use inventory weapon — attack data from template
        const lignes: LigneDegats[] = armeSource.lignesDegats.map(l => ({
          ordre: l.ordre,
          degatsMin: l.degatsMin,
          degatsMax: l.degatsMax,
          statUtilisee: l.statUtilisee,
          estVolDeVie: l.estVolDeVie,
          estSoin: l.estSoin,
        }));
        armeData = {
          nom: armeSource.nom,
          chanceCritBase: armeSource.chanceCritBase ?? 0.05,
          bonusCrit: armeSource.bonusCrit ?? 0,
          coutPA: armeSource.coutPA ?? 3,
          porteeMin: armeSource.porteeMin ?? 1,
          porteeMax: armeSource.porteeMax ?? 1,
          ligneDeVue: armeSource.ligneDeVue ?? true,
          zoneId: armeSource.zoneId,
          cooldown: armeSource.cooldown ?? 0,
          tauxEchec: armeSource.tauxEchec ?? 0,
          lignes,
        };
      }

      await prisma.combatEntite.create({
        data: {
          combatId: combat.id,
          personnageId: char.id,
          nom: char.nom,
          equipe: 0,
          positionX: spawn.x,
          positionY: spawn.y,
          initiative: 0,
          ordreJeu: 0,
          pvMax: totalStats.pvMax,
          pvActuels: totalStats.pvMax,
          paMax: totalStats.pa,
          paActuels: totalStats.pa,
          pmMax: totalStats.pm,
          pmActuels: totalStats.pm,
          force: totalStats.force,
          intelligence: totalStats.intelligence,
          dexterite: totalStats.dexterite,
          agilite: totalStats.agilite,
          vie: totalStats.vie,
          chance: totalStats.chance,
          poBonus: totalStats.po,
          bonusCritique: totalStats.bonusCritique,
          resistanceForce: totalStats.resistanceForce,
          resistanceIntelligence: totalStats.resistanceIntelligence,
          resistanceDexterite: totalStats.resistanceDexterite,
          resistanceAgilite: totalStats.resistanceAgilite,
          bonusDommages: totalStats.bonusDommages ?? 0,
          bonusSoins: totalStats.bonusSoins ?? 0,
          armeData: armeData ? JSON.parse(JSON.stringify(armeData)) : undefined,
        },
      });
    }

    // Create entities for monsters (team 1) at spawn positions
    for (let i = 0; i < data.monstres.length; i++) {
      const monster = data.monstres[i];
      const spawn = enemySpawns[i];

      // Calculate scaled resistances from template (if available)
      let resistanceForce = 0;
      let resistanceIntelligence = 0;
      let resistanceDexterite = 0;
      let resistanceAgilite = 0;

      if (monster.monstreTemplateId) {
        const template = await prisma.monstreTemplate.findUnique({ where: { id: monster.monstreTemplateId } });
        if (template) {
          const monsterLevel = monster.niveau ?? template.niveauBase;
          const resistScale = 1 + (monsterLevel - template.niveauBase) * 0.05;
          resistanceForce = Math.floor(template.resistanceForce * resistScale);
          resistanceIntelligence = Math.floor(template.resistanceIntelligence * resistScale);
          resistanceDexterite = Math.floor(template.resistanceDexterite * resistScale);
          resistanceAgilite = Math.floor(template.resistanceAgilite * resistScale);
        }
      }

      await prisma.combatEntite.create({
        data: {
          combatId: combat.id,
          personnageId: null,
          nom: monster.nom,
          equipe: 1,
          positionX: spawn.x,
          positionY: spawn.y,
          initiative: 0,
          ordreJeu: 0,
          pvMax: monster.pvMax,
          pvActuels: monster.pvMax,
          paMax: monster.paMax,
          paActuels: monster.paMax,
          pmMax: monster.pmMax,
          pmActuels: monster.pmMax,
          force: monster.force,
          intelligence: monster.intelligence,
          dexterite: monster.dexterite,
          agilite: monster.agilite,
          vie: monster.vie,
          chance: monster.chance,
          monstreTemplateId: monster.monstreTemplateId ?? null,
          niveau: monster.niveau ?? null,
          iaType: (monster.iaType as any) ?? null,
          resistanceForce,
          resistanceIntelligence,
          resistanceDexterite,
          resistanceAgilite,
        },
      });
    }

    // Load map cases (obstacles + excluded) into CombatCase
    await loadGridTemplate(combat.id, map.cases);

    // Initialize initiative order
    await initializeInitiative(combat.id);

    return getCombatState(combat.id);
  }

  async getState(combatId: number) {
    return getCombatState(combatId);
  }

  async action(combatId: number, entiteId: number, sortId: number | null, targetX: number, targetY: number, useArme: boolean = false) {
    return executeAction(combatId, entiteId, sortId, targetX, targetY, useArme);
  }

  async move(combatId: number, entiteId: number, targetX: number, targetY: number) {
    const result = await moveEntity(combatId, entiteId, targetX, targetY);
    if (result.success && result.pmUsed) {
      const entity = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
      const combat = await prisma.combat.findUnique({ where: { id: combatId } });
      if (entity && combat) {
        await addLog(combatId, combat.tourActuel, `${entity.nom} se déplace (${result.pmUsed} PM)`, 'DEPLACEMENT');
      }
    }
    return result;
  }

  async endTurn(combatId: number, entiteId: number) {
    return endTurn(combatId, entiteId);
  }

  async flee(combatId: number) {
    return fleeCombat(combatId);
  }

  async findAll() {
    const combats = await prisma.combat.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const states = await Promise.all(
      combats.map(c => getCombatState(c.id))
    );
    return states.filter(s => s !== null);
  }
}

export const combatService = new CombatService();
