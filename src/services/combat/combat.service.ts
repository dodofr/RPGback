import prisma from '../../config/database';
import { CombatStatus } from '@prisma/client';
import { CreateCombatRequest, CharacterEquipment, ArmeData } from '../../types';
import { characterService } from '../character.service';
import { grilleService } from '../grille.service';
import { initializeInitiative, getCombatState, executeAction, moveEntity, endTurn, fleeCombat } from './engine';
import { loadGridTemplate } from './grid';
import { addLog } from './combatLog';

export class CombatService {
  async create(data: CreateCombatRequest) {
    // Get group with characters
    const group = await prisma.groupe.findUnique({
      where: { id: data.groupeId },
      include: {
        personnages: {
          include: {
            personnage: {
              include: {
                race: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    if (group.personnages.length === 0) {
      throw new Error('Group has no characters');
    }

    // Get a random grid template for this map
    const grille = await grilleService.getRandomGridForMap(data.mapId);

    // Get spawn positions sorted by ordre
    const playerSpawns = grille.spawns
      .filter(s => s.equipe === 0)
      .sort((a, b) => a.ordre - b.ordre);
    const enemySpawns = grille.spawns
      .filter(s => s.equipe === 1)
      .sort((a, b) => a.ordre - b.ordre);

    if (group.personnages.length > playerSpawns.length) {
      throw new Error('Not enough player spawn positions');
    }

    if (data.monstres.length > enemySpawns.length) {
      throw new Error('Not enough enemy spawn positions');
    }

    // Create combat with grid dimensions
    const combat = await prisma.combat.create({
      data: {
        status: CombatStatus.EN_COURS,
        grilleLargeur: grille.largeur,
        grilleHauteur: grille.hauteur,
      },
    });

    // Create entities for player characters (team 0) at spawn positions
    for (let i = 0; i < group.personnages.length; i++) {
      const char = group.personnages[i].personnage;
      const spawn = playerSpawns[i];

      const totalStats = await characterService.getTotalStats(char.id);

      // Snapshot weapon data if character has a weapon equipped
      let armeData: ArmeData | null = null;
      const equipment = char.equipements as CharacterEquipment;
      const armeId = equipment['ARME'];
      if (armeId) {
        const arme = await prisma.equipement.findUnique({
          where: { id: armeId },
        });
        if (arme && arme.degatsMin != null && arme.degatsMax != null) {
          armeData = {
            nom: arme.nom,
            degatsMin: arme.degatsMin,
            degatsMax: arme.degatsMax,
            degatsCritMin: arme.degatsCritMin ?? arme.degatsMin,
            degatsCritMax: arme.degatsCritMax ?? arme.degatsMax,
            chanceCritBase: arme.chanceCritBase ?? 0.05,
            coutPA: arme.coutPA ?? 3,
            porteeMin: arme.porteeMin ?? 1,
            porteeMax: arme.porteeMax ?? 1,
            ligneDeVue: arme.ligneDeVue ?? true,
            zoneId: arme.zoneId,
            statUtilisee: arme.statUtilisee ?? 'FORCE',
            cooldown: arme.cooldown ?? 0,
            tauxEchec: arme.tauxEchec ?? 0,
          };
        }
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
          armeData: armeData ? JSON.parse(JSON.stringify(armeData)) : undefined,
        },
      });
    }

    // Create entities for monsters (team 1) at spawn positions
    for (let i = 0; i < data.monstres.length; i++) {
      const monster = data.monstres[i];
      const spawn = enemySpawns[i];

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
        },
      });
    }

    // Load grid template obstacles into CombatCase
    await loadGridTemplate(combat.id, grille);

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
