import { CombatStatus, Sort, ZoneType, IAType } from '@prisma/client';
import prisma from '../../config/database';
import { CombatState, ActionResult, Position, CombatCaseState, ArmeData, LigneDegats, ActiveEffectStateWithDetails, CombatSpellState, ZonePoseeState } from '../../types';
import { calculateAlternatingInitiativeOrder, getNextEntity } from './initiative';
import { calculateDamage, applyDamage, isDead } from './damage';
import { canMove, calculateMovementCost, hasLineOfSight } from './movement';
import { getAffectedCells, getEntitiesInArea } from './aoe';
import { manhattanDistance, getStatValue, calculateStatMultiplier, calculateCritChance, calculateAoEReduction, applyResistance } from '../../utils/formulas';
import { progressionService } from '../progression.service';
import { getCombatCases } from './grid';
import { spellService } from '../spell.service';
import { executeAITurn } from './ai';
import { createInvocation, killInvocationsOf } from './invocation';
import { donjonService } from '../donjon.service';
import { dropService } from '../drop.service';
import { getStatsWithEffects, applySpellEffects, applyShieldEffect, calculateShieldReduction, AppliedEffect, PushPullResult, getResourceModifiers, applyPoisonDamage, removeEffectsByCaster, getEffectiveResistance, getEffectiveBonusDommages, getEffectiveBonusSoins } from './effects';
import { createZone, triggerGlyphesForEntity, triggerPiegesForEntity, decrementZones, cleanupZones } from './zones';
import { checkProbability, randomInt } from '../../utils/random';
import { addLog } from './combatLog';

/**
 * Apply PA/PM effects immediately to entities (on new effect creation only, not refresh)
 */
async function applyImmediateResourceEffects(
  combatId: number,
  appliedEffects: AppliedEffect[]
): Promise<void> {
  const NON_STAT_TYPES = ['DISPEL', 'POUSSEE', 'ATTIRANCE', 'POISON', 'BOUCLIER', 'RESISTANCE'];
  const deltas = new Map<number, { pa: number; pm: number }>();

  for (const ae of appliedEffects) {
    if (!ae.isNew || !ae.statCiblee || ae.valeur === undefined) continue;
    if (NON_STAT_TYPES.includes(ae.statCiblee)) continue;
    if (ae.statCiblee !== 'PA' && ae.statCiblee !== 'PM') continue;
    if (!deltas.has(ae.entiteId)) deltas.set(ae.entiteId, { pa: 0, pm: 0 });
    const d = deltas.get(ae.entiteId)!;
    if (ae.statCiblee === 'PA') d.pa += ae.valeur;
    else d.pm += ae.valeur;
  }

  for (const [entiteId, delta] of deltas) {
    if (delta.pa === 0 && delta.pm === 0) continue;
    const entity = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
    if (!entity || entity.pvActuels <= 0) continue;
    await prisma.combatEntite.update({
      where: { id: entiteId },
      data: {
        ...(delta.pa !== 0 ? { paActuels: Math.max(0, entity.paActuels + delta.pa) } : {}),
        ...(delta.pm !== 0 ? { pmActuels: Math.max(0, entity.pmActuels + delta.pm) } : {}),
      },
    });
  }
}

/**
 * Get the current state of a combat
 */
export async function getCombatState(combatId: number): Promise<CombatState | null> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: {
      entites: true,
      effetsActifs: {
        include: {
          effet: true,
        },
      },
      cases: true,
      cooldowns: true,
      logs: {
        orderBy: { id: 'asc' },
      },
      zonesActives: true,
    },
  });

  if (!combat) {
    return null;
  }

  // Load spells for each entity
  const entitesWithSpells = await Promise.all(
    combat.entites.map(async (e) => {
      let sorts: CombatSpellState[] = [];

      if (e.personnageId) {
        // Player entity: get learned spells via PersonnageSort
        const personnageSorts = await prisma.personnageSort.findMany({
          where: { personnageId: e.personnageId },
          include: {
            sort: {
              include: {
                zone: true,
                effets: {
                  include: {
                    effet: true,
                  },
                },
              },
            },
          },
        });

        sorts = personnageSorts.map((ps) => {
          const cd = combat.cooldowns.find(
            (c) => c.entiteId === e.id && c.sortId === ps.sortId
          );
          return {
            id: ps.sort.id,
            nom: ps.sort.nom,
            description: ps.sort.description,
            type: ps.sort.type,
            statUtilisee: ps.sort.statUtilisee,
            coutPA: ps.sort.coutPA,
            porteeMin: ps.sort.porteeMin,
            porteeMax: ps.sort.porteeMax,
            ligneDeVue: ps.sort.ligneDeVue,
            degatsMin: ps.sort.degatsMin,
            degatsMax: ps.sort.degatsMax,
            degatsCritMin: ps.sort.degatsCritMin,
            degatsCritMax: ps.sort.degatsCritMax,
            chanceCritBase: ps.sort.chanceCritBase,
            cooldown: ps.sort.cooldown,
            cooldownRestant: cd ? cd.toursRestants : 0,
            estSoin: ps.sort.estSoin,
            estInvocation: ps.sort.estInvocation,
            estVolDeVie: ps.sort.estVolDeVie,
            estGlyphe: ps.sort.estGlyphe,
            estPiege: ps.sort.estPiege,
            estTeleportation: ps.sort.estTeleportation,
            poseDuree: ps.sort.poseDuree,
            porteeModifiable: ps.sort.porteeModifiable,
            ligneDirecte: ps.sort.ligneDirecte,
            tauxEchec: ps.sort.tauxEchec,
            coefficient: ps.sort.coefficient,
            zone: ps.sort.zone
              ? { type: ps.sort.zone.type, taille: ps.sort.zone.taille, nom: ps.sort.zone.nom }
              : null,
            effets: ps.sort.effets.map((se) => ({
              effetId: se.effet.id,
              nom: se.effet.nom,
              type: se.effet.type,
              statCiblee: se.effet.statCiblee,
              valeur: se.effet.valeur,
              valeurMin: se.effet.valeurMin,
              duree: se.effet.duree,
              chanceDeclenchement: se.chanceDeclenchement,
              surCible: se.surCible,
            })),
          };
        });
      } else if (e.monstreTemplateId) {
        // Monster/invocation entity: get spells via MonstreSort
        const monstreSorts = await prisma.monstreSort.findMany({
          where: { monstreId: e.monstreTemplateId },
          include: {
            sort: {
              include: {
                zone: true,
                effets: {
                  include: {
                    effet: true,
                  },
                },
              },
            },
          },
          orderBy: { priorite: 'asc' },
        });

        sorts = monstreSorts.map((ms) => {
          const cd = combat.cooldowns.find(
            (c) => c.entiteId === e.id && c.sortId === ms.sortId
          );
          return {
            id: ms.sort.id,
            nom: ms.sort.nom,
            description: ms.sort.description,
            type: ms.sort.type,
            statUtilisee: ms.sort.statUtilisee,
            coutPA: ms.sort.coutPA,
            porteeMin: ms.sort.porteeMin,
            porteeMax: ms.sort.porteeMax,
            ligneDeVue: ms.sort.ligneDeVue,
            degatsMin: ms.sort.degatsMin,
            degatsMax: ms.sort.degatsMax,
            degatsCritMin: ms.sort.degatsCritMin,
            degatsCritMax: ms.sort.degatsCritMax,
            chanceCritBase: ms.sort.chanceCritBase,
            cooldown: ms.sort.cooldown,
            cooldownRestant: cd ? cd.toursRestants : 0,
            estSoin: ms.sort.estSoin,
            estInvocation: ms.sort.estInvocation,
            estVolDeVie: ms.sort.estVolDeVie,
            estGlyphe: ms.sort.estGlyphe,
            estPiege: ms.sort.estPiege,
            estTeleportation: ms.sort.estTeleportation,
            poseDuree: ms.sort.poseDuree,
            porteeModifiable: ms.sort.porteeModifiable,
            ligneDirecte: ms.sort.ligneDirecte,
            tauxEchec: ms.sort.tauxEchec,
            coefficient: ms.sort.coefficient,
            zone: ms.sort.zone
              ? { type: ms.sort.zone.type, taille: ms.sort.zone.taille, nom: ms.sort.zone.nom }
              : null,
            effets: ms.sort.effets.map((se) => ({
              effetId: se.effet.id,
              nom: se.effet.nom,
              type: se.effet.type,
              statCiblee: se.effet.statCiblee,
              valeur: se.effet.valeur,
              valeurMin: se.effet.valeurMin,
              duree: se.effet.duree,
              chanceDeclenchement: se.chanceDeclenchement,
              surCible: se.surCible,
            })),
          };
        });
      }

      return {
        id: e.id,
        personnageId: e.personnageId,
        nom: e.nom,
        equipe: e.equipe,
        position: { x: e.positionX, y: e.positionY },
        pvMax: e.pvMax,
        pvActuels: e.pvActuels,
        paMax: e.paMax,
        paActuels: e.paActuels,
        pmMax: e.pmMax,
        pmActuels: e.pmActuels,
        stats: {
          force: e.force,
          intelligence: e.intelligence,
          dexterite: e.dexterite,
          agilite: e.agilite,
          vie: e.vie,
          chance: e.chance,
        },
        initiative: e.initiative,
        ordreJeu: e.ordreJeu,
        invocateurId: e.invocateurId,
        armeData: e.armeData as unknown as ArmeData | null,
        armeCooldownRestant: e.armeCooldownRestant,
        monstreTemplateId: e.monstreTemplateId,
        niveau: e.niveau,
        iaType: e.iaType,
        poBonus: e.poBonus + combat.effetsActifs
          .filter(ea =>
            ea.entiteId === e.id &&
            ['BUFF', 'DEBUFF'].includes(ea.effet.type) &&
            ea.effet.statCiblee === 'PO'
          )
          .reduce((sum, ea) => sum + ea.effet.valeur, 0),
        bonusCritique: e.bonusCritique,
        resistanceForce: e.resistanceForce,
        resistanceIntelligence: e.resistanceIntelligence,
        resistanceDexterite: e.resistanceDexterite,
        resistanceAgilite: e.resistanceAgilite,
        bonusDommages: e.bonusDommages + combat.effetsActifs
          .filter(ea =>
            ea.entiteId === e.id &&
            ['BUFF', 'DEBUFF'].includes(ea.effet.type) &&
            ea.effet.statCiblee === 'DOMMAGES'
          )
          .reduce((sum, ea) => sum + ea.effet.valeur, 0),
        bonusSoins: e.bonusSoins + combat.effetsActifs
          .filter(ea =>
            ea.entiteId === e.id &&
            ['BUFF', 'DEBUFF'].includes(ea.effet.type) &&
            ea.effet.statCiblee === 'SOINS'
          )
          .reduce((sum, ea) => sum + ea.effet.valeur, 0),
        sorts,
      };
    })
  );

  return {
    id: combat.id,
    status: combat.status,
    tourActuel: combat.tourActuel,
    entiteActuelle: combat.entiteActuelleId ?? 0,
    groupeId: combat.groupeId,
    grille: {
      largeur: combat.grilleLargeur,
      hauteur: combat.grilleHauteur,
    },
    entites: entitesWithSpells,
    effetsActifs: combat.effetsActifs.map((e) => ({
      id: e.id,
      entiteId: e.entiteId,
      effetId: e.effetId,
      toursRestants: e.toursRestants,
      nom: e.effet.nom,
      type: e.effet.type,
      statCiblee: e.effet.statCiblee,
      valeur: e.effet.valeur,
      valeurMin: e.effet.valeurMin,
    })),
    cases: combat.cases.map((c) => ({
      x: c.x,
      y: c.y,
      bloqueDeplacement: c.bloqueDeplacement,
      bloqueLigneDeVue: c.bloqueLigneDeVue,
    })),
    cooldowns: combat.cooldowns.map((cd) => ({
      entiteId: cd.entiteId,
      sortId: cd.sortId,
      toursRestants: cd.toursRestants,
    })),
    logs: combat.logs.map((l) => ({
      id: l.id,
      tour: l.tour,
      message: l.message,
      type: l.type,
    })),
    zonesActives: combat.zonesActives.map((z): ZonePoseeState => ({
      id: z.id,
      x: z.x,
      y: z.y,
      poseurId: z.poseurId,
      poseurEquipe: z.poseurEquipe,
      estPiege: z.estPiege,
      toursRestants: z.toursRestants,
      degatsMinFinal: z.degatsMinFinal,
      degatsMaxFinal: z.degatsMaxFinal,
      statUtilisee: z.statUtilisee,
      effetId: z.effetId,
      zoneTaille: z.zoneTaille,
      zoneType: z.zoneType,
    })),
  };
}

/**
 * Initialize initiative order for all combat entities
 * Uses alternating initiative: Player[0] → Enemy[0] → Player[1] → Enemy[1] → ...
 */
export async function initializeInitiative(combatId: number): Promise<void> {
  const entities = await prisma.combatEntite.findMany({
    where: { combatId },
  });

  const initiativeResults = calculateAlternatingInitiativeOrder(
    entities.map((e) => ({ id: e.id, agilite: e.agilite, equipe: e.equipe }))
  );

  // Update all entities with their initiative and play order
  for (const result of initiativeResults) {
    await prisma.combatEntite.update({
      where: { id: result.id },
      data: {
        initiative: result.initiative,
        ordreJeu: result.ordreJeu,
      },
    });
  }

  // Set the first entity as the current turn entity
  const firstEntity = initiativeResults.find((r) => r.ordreJeu === 1);
  if (firstEntity) {
    await prisma.combat.update({
      where: { id: combatId },
      data: { entiteActuelleId: firstEntity.id },
    });
  }
}

/**
 * Execute an action (attack/spell or weapon attack)
 */
export async function executeAction(
  combatId: number,
  entiteId: number,
  sortId: number | null,
  targetX: number,
  targetY: number,
  useArme: boolean = false
): Promise<ActionResult> {
  // Get combat state
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: {
      entites: true,
      cases: true,
    },
  });

  if (!combat || combat.status !== CombatStatus.EN_COURS) {
    return { success: false, message: 'Combat not found or not in progress' };
  }

  // Get attacker entity
  const attacker = combat.entites.find((e) => e.id === entiteId);
  if (!attacker || attacker.pvActuels <= 0) {
    return { success: false, message: 'Attacker not found or dead' };
  }

  // Verify it's this entity's turn
  if (combat.entiteActuelleId !== entiteId) {
    return { success: false, message: "Not this entity's turn" };
  }

  // Build common attack data from either weapon or spell
  let attackData: {
    coutPA: number;
    porteeMin: number;
    porteeMax: number;
    ligneDeVue: boolean;
    ligneDirecte?: boolean;
    degatsMin: number;
    degatsMax: number;
    degatsCritMin?: number;
    degatsCritMax?: number;
    chanceCritBase: number;
    statUtilisee: string;
    zone: { type: ZoneType; taille: number };
  };
  let actionType: 'ARME' | 'SORT';
  let spell: (Sort & { zone: { type: ZoneType; taille: number } | null }) | null = null;

  if (useArme) {
    // Weapon attack
    const armeData = attacker.armeData as unknown as ArmeData | null;
    if (!armeData) {
      return { success: false, message: 'No weapon equipped' };
    }

    // Check weapon cooldown
    if (attacker.armeCooldownRestant > 0) {
      return { success: false, message: `Weapon on cooldown (${attacker.armeCooldownRestant} turns remaining)` };
    }

    // Get zone for weapon
    let weaponZone: { type: ZoneType; taille: number } = { type: 'CASE' as ZoneType, taille: 0 };
    if (armeData.zoneId) {
      const zone = await prisma.zone.findUnique({ where: { id: armeData.zoneId } });
      if (zone) {
        weaponZone = { type: zone.type, taille: zone.taille };
      }
    }

    attackData = {
      coutPA: armeData.coutPA,
      porteeMin: armeData.porteeMin,
      porteeMax: armeData.porteeMax,
      ligneDeVue: armeData.ligneDeVue,
      degatsMin: 0,
      degatsMax: 0,
      chanceCritBase: armeData.chanceCritBase,
      statUtilisee: 'FORCE',
      zone: weaponZone,
    };
    actionType = 'ARME';
  } else {
    // Spell attack
    if (!sortId) {
      return { success: false, message: 'No spell specified' };
    }

    spell = await prisma.sort.findUnique({
      where: { id: sortId },
      include: { zone: true },
    });

    if (!spell) {
      return { success: false, message: 'Spell not found' };
    }

    // Verify spell ownership
    if (attacker.personnageId) {
      const learned = await prisma.personnageSort.findFirst({
        where: { personnageId: attacker.personnageId, sortId },
      });
      if (!learned) {
        return { success: false, message: 'Spell not learned' };
      }
    } else if (attacker.monstreTemplateId) {
      const monsterSpell = await prisma.monstreSort.findFirst({
        where: { monstreId: attacker.monstreTemplateId, sortId },
      });
      if (!monsterSpell) {
        return { success: false, message: 'Spell not available' };
      }
    }

    // Check cooldown
    const cooldownCheck = await spellService.canUseSpell(combatId, entiteId, sortId);
    if (!cooldownCheck.canUse) {
      return { success: false, message: cooldownCheck.reason || 'Spell on cooldown' };
    }

    attackData = {
      coutPA: spell.coutPA,
      porteeMin: spell.porteeMin,
      porteeMax: spell.porteeMax,
      ligneDeVue: spell.ligneDeVue,
      ligneDirecte: spell.ligneDirecte,
      degatsMin: spell.degatsMin,
      degatsMax: spell.degatsMax,
      degatsCritMin: spell.degatsCritMin,
      degatsCritMax: spell.degatsCritMax,
      chanceCritBase: spell.chanceCritBase,
      statUtilisee: spell.statUtilisee,
      zone: spell.zone ? { type: spell.zone.type, taille: spell.zone.taille } : { type: 'CASE' as ZoneType, taille: 0 },
    };
    actionType = 'SORT';
  }

  // Check PA cost
  if (attacker.paActuels < attackData.coutPA) {
    return { success: false, message: `Not enough PA (need ${attackData.coutPA}, have ${attacker.paActuels})` };
  }

  // Check ligne droite (horizontal ou vertical uniquement)
  if (attackData.ligneDirecte) {
    const dx = Math.abs(targetX - attacker.positionX);
    const dy = Math.abs(targetY - attacker.positionY);
    if (dx !== 0 && dy !== 0) {
      return { success: false, message: 'Ce sort ne peut être ciblé qu\'en ligne droite (horizontal ou vertical)' };
    }
  }

  // Check destination for teleportation BEFORE PA deduction
  if (spell?.estTeleportation) {
    const destBlocked = combat.cases.some(
      (c) => c.x === targetX && c.y === targetY && c.bloqueDeplacement
    );
    const destOccupied = combat.entites.some(
      (e) => e.pvActuels > 0 && e.id !== entiteId && e.positionX === targetX && e.positionY === targetY
    );
    if (destBlocked || destOccupied) {
      return { success: false, message: 'Cette case est bloquée ou occupée' };
    }
  }

  // Check range (with PO bonus from equipment + effects, unless porteeModifiable is false)
  const distance = manhattanDistance(attacker.positionX, attacker.positionY, targetX, targetY);
  const poMods = await getResourceModifiers(combatId, entiteId);
  const isPorteeModifiable = useArme ? true : (spell?.porteeModifiable ?? true);
  const poBonus = isPorteeModifiable ? ((attacker.poBonus ?? 0) + poMods.poModifier) : 0;
  const effectivePorteeMax = attackData.porteeMax + poBonus;
  const effectivePorteeMin = Math.max(0, attackData.porteeMin);
  if (distance < effectivePorteeMin || distance > effectivePorteeMax) {
    return {
      success: false,
      message: `Target out of range (distance: ${distance}, range: ${effectivePorteeMin}-${effectivePorteeMax})`,
    };
  }

  // Compute effective bonus dommages/soins (snapshot + active BUFF/DEBUFF effects)
  const bonusDmg = await getEffectiveBonusDommages(combatId, entiteId, attacker.bonusDommages);
  const bonusSoin = await getEffectiveBonusSoins(combatId, entiteId, attacker.bonusSoins);

  // Convert cases to CombatCaseState format
  const blockedCases: CombatCaseState[] = combat.cases.map((c) => ({
    x: c.x,
    y: c.y,
    bloqueDeplacement: c.bloqueDeplacement,
    bloqueLigneDeVue: c.bloqueLigneDeVue,
  }));

  // Check line of sight if required
  if (attackData.ligneDeVue) {
    const hasLOS = hasLineOfSight(
      { x: attacker.positionX, y: attacker.positionY },
      { x: targetX, y: targetY },
      combat.entites,
      blockedCases
    );
    if (!hasLOS) {
      return { success: false, message: 'No line of sight to target' };
    }
  }

  // Deduct PA
  await prisma.combatEntite.update({
    where: { id: entiteId },
    data: { paActuels: attacker.paActuels - attackData.coutPA },
  });

  // Apply cooldown
  if (useArme) {
    const armeData = attacker.armeData as unknown as ArmeData;
    if (armeData.cooldown > 0) {
      await prisma.combatEntite.update({
        where: { id: entiteId },
        data: { armeCooldownRestant: armeData.cooldown },
      });
    }
  } else if (sortId) {
    await spellService.applyCooldown(combatId, entiteId, sortId);
  }

  // Miss check (tauxEchec)
  const tauxEchec = useArme
    ? (attacker.armeData as unknown as ArmeData).tauxEchec ?? 0
    : spell?.tauxEchec ?? 0;

  if (tauxEchec > 0 && checkProbability(tauxEchec)) {
    const actionLabel = useArme
      ? `${attacker.nom} utilise ${(attacker.armeData as unknown as ArmeData).nom} (${attackData.coutPA} PA)`
      : `${attacker.nom} lance ${spell!.nom} (${attackData.coutPA} PA)`;
    await addLog(combatId, combat.tourActuel, `${actionLabel} → ÉCHEC !`, 'ACTION');

    if (useArme) {
      // Weapon miss: PA lost + end turn
      await endTurn(combatId, entiteId);
      return {
        success: true,
        message: 'Weapon attack missed! Turn lost.',
        actionType,
        damages: [],
        missed: true,
      };
    }
    // Spell miss: PA lost only
    return {
      success: true,
      message: 'Spell missed!',
      actionType,
      damages: [],
      missed: true,
    };
  }

  // ===== GLYPHE BRANCH =====
  if (spell?.estGlyphe) {
    const attackerBaseStats = {
      force: attacker.force, intelligence: attacker.intelligence, dexterite: attacker.dexterite,
      agilite: attacker.agilite, vie: attacker.vie, chance: attacker.chance,
    };

    // Look up secondary effect from SortEffet if any
    const sortEffet = await prisma.sortEffet.findFirst({
      where: { sortId: sortId!, surCible: true },
      include: { effet: true },
    });

    await createZone(
      combatId, entiteId, attacker.equipe, targetX, targetY, false,
      spell.poseDuree ?? 3,
      spell.degatsMin + bonusDmg, spell.degatsMax + bonusDmg, spell.statUtilisee as any,
      attackerBaseStats,
      spell.zone?.taille ?? 0,
      spell.zone?.type ?? 'CASE',
      sortEffet?.effetId ?? undefined,
      spell.coefficient ?? 1.0
    );

    const dureeMsg = spell.poseDuree ? `${spell.poseDuree} tours` : 'permanent';
    await addLog(combatId, combat.tourActuel, `${attacker.nom} pose un glyphe en (${targetX},${targetY}) [${dureeMsg}]`, 'ACTION');

    return {
      success: true,
      message: `Glyphe posé en (${targetX}, ${targetY})`,
      actionType,
      damages: [],
    };
  }

  // ===== PIÈGE BRANCH =====
  if (spell?.estPiege) {
    const attackerBaseStats = {
      force: attacker.force, intelligence: attacker.intelligence, dexterite: attacker.dexterite,
      agilite: attacker.agilite, vie: attacker.vie, chance: attacker.chance,
    };

    const sortEffet = await prisma.sortEffet.findFirst({
      where: { sortId: sortId!, surCible: true },
      include: { effet: true },
    });

    await createZone(
      combatId, entiteId, attacker.equipe, targetX, targetY, true,
      spell.poseDuree ?? 5,
      spell.degatsMin + bonusDmg, spell.degatsMax + bonusDmg, spell.statUtilisee as any,
      attackerBaseStats,
      spell.zone?.taille ?? 0,
      spell.zone?.type ?? 'CASE',
      sortEffet?.effetId ?? undefined,
      spell.coefficient ?? 1.0
    );

    // Log visible pour le lanceur seulement (le message existe mais côté client c'est invisible pour l'ennemi)
    await addLog(combatId, combat.tourActuel, `${attacker.nom} pose un piège en (${targetX},${targetY})`, 'ACTION');

    return {
      success: true,
      message: `Piège posé en (${targetX}, ${targetY})`,
      actionType,
      damages: [],
    };
  }

  // ===== INVOCATION BRANCH =====
  if (spell?.estInvocation && spell.invocationTemplateId) {
    const invocTemplate = await prisma.monstreTemplate.findUnique({
      where: { id: spell.invocationTemplateId },
    });

    if (!invocTemplate) {
      return { success: false, message: 'Invocation template not found' };
    }

    // Check position is valid (not occupied, not blocked)
    const isOccupied = combat.entites.some(
      (e) => e.positionX === targetX && e.positionY === targetY && e.pvActuels > 0
    );
    if (isOccupied) {
      return { success: false, message: 'Target position is occupied' };
    }

    const isBlocked = combat.cases.some(
      (c) => c.x === targetX && c.y === targetY && c.bloqueDeplacement
    );
    if (isBlocked) {
      return { success: false, message: 'Target position is blocked' };
    }

    // Scale invocation stats: template base + 50% of caster's combat stats
    const scaledForce = invocTemplate.force + Math.floor(attacker.force * 0.5);
    const scaledIntelligence = invocTemplate.intelligence + Math.floor(attacker.intelligence * 0.5);
    const scaledDexterite = invocTemplate.dexterite + Math.floor(attacker.dexterite * 0.5);
    const scaledAgilite = invocTemplate.agilite + Math.floor(attacker.agilite * 0.5);
    const scaledVie = invocTemplate.vie + Math.floor(attacker.vie * 0.5);
    const scaledChance = invocTemplate.chance + Math.floor(attacker.chance * 0.5);

    // PV: template base + (caster pvMax * pvScalingInvocation)
    const pvScaling = invocTemplate.pvScalingInvocation ?? 0.10;
    const scaledPvMax = invocTemplate.pvBase + Math.floor(attacker.pvMax * pvScaling);

    // Create the invocation using the existing system
    const invocationId = await createInvocation(
      combatId,
      entiteId,
      {
        nom: invocTemplate.nom,
        force: scaledForce,
        intelligence: scaledIntelligence,
        dexterite: scaledDexterite,
        agilite: scaledAgilite,
        vie: scaledVie,
        chance: scaledChance,
        pvMax: scaledPvMax,
        paMax: invocTemplate.paBase,
        pmMax: invocTemplate.pmBase,
      },
      targetX,
      targetY
    );

    // Update the created entity with monstreTemplateId and iaType for AI
    await prisma.combatEntite.update({
      where: { id: invocationId },
      data: {
        monstreTemplateId: invocTemplate.id,
        iaType: invocTemplate.iaType,
      },
    });

    await addLog(combatId, combat.tourActuel, `${attacker.nom} lance ${spell.nom} (${attackData.coutPA} PA) → ${invocTemplate.nom} invoqué`, 'ACTION');

    return {
      success: true,
      message: `Invoked ${invocTemplate.nom} at (${targetX}, ${targetY})`,
      actionType,
      damages: [],
      invocation: {
        entiteId: invocationId,
        nom: invocTemplate.nom,
        position: { x: targetX, y: targetY },
      },
    };
  }

  // ===== TÉLÉPORTATION BRANCH =====
  if (spell?.estTeleportation) {
    const oldX = attacker.positionX;
    const oldY = attacker.positionY;

    // 1. Move caster to destination (no PM cost)
    await prisma.combatEntite.update({
      where: { id: entiteId },
      data: { positionX: targetX, positionY: targetY },
    });

    // 2. Log teleportation
    await addLog(combatId, combat.tourActuel, `${attacker.nom} se téléporte en (${targetX},${targetY})`, 'DEPLACEMENT');

    // 3. Trigger traps at landing position
    await triggerPiegesForEntity(combatId, entiteId, targetX, targetY);

    // 4. AoE at landing point (if zone + damage/effects configured)
    const hasDamageOrEffects = (spell.degatsMin > 0 || spell.degatsMax > 0) || spell.estVolDeVie;
    const hasSortEffets = await prisma.sortEffet.count({ where: { sortId: sortId! } });

    const damages: ActionResult['damages'] = [];
    const entitesMortes: number[] = [];
    let appliedEffectsTeleport: AppliedEffect[] = [];
    let totalLifestealTeleport = 0;

    if (spell.zone && (hasDamageOrEffects || hasSortEffets > 0)) {
      // Use old position as "source" for directional zones (so direction is caster's arrival direction)
      const affectedCells = getAffectedCells(
        { x: targetX, y: targetY },
        { type: spell.zone.type, taille: spell.zone.taille },
        { width: combat.grilleLargeur, height: combat.grilleHauteur },
        { x: oldX, y: oldY }
      );

      // Get all alive entities in zone EXCEPT the caster
      const allInArea = getEntitiesInArea(affectedCells, combat.entites);
      const aoeTargets = allInArea.filter((e) => e.id !== entiteId);

      if (aoeTargets.length > 0) {
        // Apply spell effects (poison, debuff, etc.)
        const targetIds = aoeTargets.map((t) => t.id);
        appliedEffectsTeleport = await applySpellEffects(combatId, sortId!, entiteId, targetIds, {
          gridWidth: combat.grilleLargeur,
          gridHeight: combat.grilleHauteur,
          entities: combat.entites.map((e) => ({
            id: e.id,
            // Use updated position for caster (already teleported)
            positionX: e.id === entiteId ? targetX : e.positionX,
            positionY: e.id === entiteId ? targetY : e.positionY,
            pvActuels: e.pvActuels,
          })),
          blockedCases,
        }, bonusDmg > 0 ? bonusDmg : undefined);
        await applyImmediateResourceEffects(combatId, appliedEffectsTeleport);

        if (hasDamageOrEffects) {
          const attackerBaseStats = {
            force: attacker.force, intelligence: attacker.intelligence, dexterite: attacker.dexterite,
            agilite: attacker.agilite, vie: attacker.vie, chance: attacker.chance,
          };
          const attackerModifiedStats = await getStatsWithEffects(combatId, entiteId, attackerBaseStats);
          const attackerStatsWithCrit = { ...attackerModifiedStats, bonusCritique: attacker.bonusCritique + poMods.critiqueModifier };

          const spellData = {
            degatsMin: spell.degatsMin + bonusDmg,
            degatsMax: spell.degatsMax + bonusDmg,
            degatsCritMin: spell.degatsCritMin + bonusDmg,
            degatsCritMax: spell.degatsCritMax + bonusDmg,
            chanceCritBase: spell.chanceCritBase,
            statUtilisee: spell.statUtilisee as any,
            coefficient: spell.coefficient ?? 1.0,
          };

          for (const target of aoeTargets) {
            const aoeDistance = manhattanDistance(target.positionX, target.positionY, targetX, targetY);
            const aoeMultiplier = calculateAoEReduction(aoeDistance);
            const damageResult = calculateDamage(spellData, attackerStatsWithCrit);
            const rawTeleDmg = Math.floor(damageResult.finalDamage * aoeMultiplier);
            // Apply resistance based on spell's stat
            const teleResistance = await getEffectiveResistance(combatId, target.id, target, spell.statUtilisee as any);
            let totalDmg = applyResistance(rawTeleDmg, teleResistance);

            // Shield reduction
            const shieldAbsorb = await calculateShieldReduction(combatId, target.id, spell.statUtilisee);
            if (shieldAbsorb > 0) {
              const absorbed = Math.min(shieldAbsorb, totalDmg);
              totalDmg = Math.max(0, totalDmg - absorbed);
              await addLog(combatId, combat.tourActuel, `${target.nom} : bouclier absorbe ${absorbed} dégâts`, 'EFFET');
            }

            const newPV = applyDamage(target.pvActuels, totalDmg);
            await prisma.combatEntite.update({ where: { id: target.id }, data: { pvActuels: newPV } });

            damages.push({
              entiteId: target.id,
              damage: totalDmg,
              isCritical: damageResult.isCritical,
              pvRestants: newPV,
            });

            // Lifesteal
            if (spell.estVolDeVie && totalDmg > 0) {
              totalLifestealTeleport += Math.floor(totalDmg / 2);
            }

            if (isDead(newPV)) {
              entitesMortes.push(target.id);
              const killedInvocations = await killInvocationsOf(combatId, target.id);
              entitesMortes.push(...killedInvocations);
              const allDeadIds = [target.id, ...killedInvocations];
              await prisma.effetActif.deleteMany({ where: { combatId, entiteId: { in: allDeadIds } } });
              for (const deadId of allDeadIds) {
                await removeEffectsByCaster(combatId, deadId);
              }
            }
          }
        }
      }
    }

    // Lifesteal for teleport
    let lifestealResult: ActionResult['lifesteal'] = undefined;
    if (totalLifestealTeleport > 0) {
      const currentAttacker = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
      if (currentAttacker && currentAttacker.pvActuels > 0) {
        const newPV = Math.min(currentAttacker.pvMax, currentAttacker.pvActuels + totalLifestealTeleport);
        const actualHeal = newPV - currentAttacker.pvActuels;
        await prisma.combatEntite.update({ where: { id: entiteId }, data: { pvActuels: newPV } });
        lifestealResult = { healAmount: actualHeal, pvRestants: newPV };
      }
    }

    // Log AoE action
    if (damages.length > 0) {
      const dmgParts = damages.map((d) => {
        const t = combat.entites.find((e) => e.id === d.entiteId);
        const critStr = d.isCritical ? 'CRITIQUE ! ' : '';
        return `${critStr}${t?.nom || '?'} subit ${d.damage} dégâts (${d.pvRestants}/${t?.pvMax || '?'} PV)`;
      });
      await addLog(combatId, combat.tourActuel, `${attacker.nom} arrive en (${targetX},${targetY}) — ${dmgParts.join(', ')}`, 'ACTION');
    }

    if (lifestealResult && lifestealResult.healAmount > 0) {
      await addLog(combatId, combat.tourActuel, `${attacker.nom} vole ${lifestealResult.healAmount} PV (${lifestealResult.pvRestants}/${attacker.pvMax} PV)`, 'ACTION');
    }

    for (const ef of appliedEffectsTeleport) {
      const target = combat.entites.find((e) => e.id === ef.entiteId);
      if (ef.isDispel) {
        await addLog(combatId, combat.tourActuel, `Dispel ! ${target?.nom || '?'} perd ${ef.removedCount || 0} effet(s)`, 'ACTION');
      } else if (ef.isPushPull && ef.pushPullResult) {
        const r = ef.pushPullResult;
        if (r.moved) {
          const verb = ef.effetNom.toLowerCase().includes('attir') ? 'attiré' : 'repoussé';
          await addLog(combatId, combat.tourActuel, `${target?.nom || '?'} est ${verb} de ${r.distanceReelle} case(s) (${r.from.x},${r.from.y}) → (${r.to.x},${r.to.y})`, 'ACTION');
          await triggerPiegesForEntity(combatId, ef.entiteId, r.to.x, r.to.y);
          await checkCombatEnd(combatId);
        } else {
          await addLog(combatId, combat.tourActuel, `${target?.nom || '?'} résiste au déplacement`, 'ACTION');
        }
      } else {
        await addLog(combatId, combat.tourActuel, `${target?.nom || '?'}: ${ef.effetNom} (${ef.duree}t)`, 'EFFET');
      }
    }

    for (const deadId of entitesMortes) {
      const dead = combat.entites.find((e) => e.id === deadId);
      if (dead) await addLog(combatId, combat.tourActuel, `${dead.nom} est mort !`, 'MORT');
    }

    await checkCombatEnd(combatId);

    return {
      success: true,
      message: `Téléportation vers (${targetX}, ${targetY})`,
      actionType,
      damages,
      entiteMorte: entitesMortes.length > 0 ? entitesMortes : undefined,
      appliedEffects: appliedEffectsTeleport.length > 0 ? appliedEffectsTeleport : undefined,
      lifesteal: lifestealResult,
      newPosition: { x: targetX, y: targetY },
    } as ActionResult & { newPosition: { x: number; y: number } };
  }

  // Get affected cells
  const affectedCells = getAffectedCells(
    { x: targetX, y: targetY },
    attackData.zone,
    { width: combat.grilleLargeur, height: combat.grilleHauteur },
    { x: attacker.positionX, y: attacker.positionY }
  );

  // Get entities in area (free targeting: all entities, no team filter)
  const validTargets = getEntitiesInArea(affectedCells, combat.entites);

  // Apply spell effects (buffs/debuffs) - BEFORE checking for targets
  // This allows self-buffs to work even when no targets are in area
  const targetIds = validTargets.map(t => t.id);
  let appliedEffects: AppliedEffect[] = [];
  if (!useArme && sortId) {
    appliedEffects = await applySpellEffects(combatId, sortId, entiteId, targetIds, {
      gridWidth: combat.grilleLargeur,
      gridHeight: combat.grilleHauteur,
      entities: combat.entites.map(e => ({
        id: e.id,
        positionX: e.positionX,
        positionY: e.positionY,
        pvActuels: e.pvActuels,
      })),
      blockedCases,
    }, bonusDmg > 0 ? bonusDmg : undefined);
    await applyImmediateResourceEffects(combatId, appliedEffects);
  }

  // ===== HEAL BRANCH =====
  if (spell?.estSoin) {
    const attackerBaseStats = {
      force: attacker.force,
      intelligence: attacker.intelligence,
      dexterite: attacker.dexterite,
      agilite: attacker.agilite,
      vie: attacker.vie,
      chance: attacker.chance,
    };
    const attackerModifiedStats = await getStatsWithEffects(combatId, entiteId, attackerBaseStats);
    const healStats = { ...attackerModifiedStats, bonusCritique: attacker.bonusCritique + poMods.critiqueModifier };

    const spellData = {
      degatsMin: attackData.degatsMin + bonusSoin,
      degatsMax: attackData.degatsMax + bonusSoin,
      degatsCritMin: attackData.degatsCritMin! + bonusSoin,
      degatsCritMax: attackData.degatsCritMax! + bonusSoin,
      chanceCritBase: attackData.chanceCritBase,
      statUtilisee: attackData.statUtilisee as any,
      coefficient: spell?.coefficient ?? 1.0,
    };

    const heals: ActionResult['heals'] = [];
    for (const target of validTargets) {
      const healResult = calculateDamage(spellData, healStats);
      const aoeDistance = manhattanDistance(target.positionX, target.positionY, targetX, targetY);
      const aoeMultiplier = calculateAoEReduction(aoeDistance);
      const healAmount = Math.floor(healResult.finalDamage * aoeMultiplier);
      const newPV = Math.min(target.pvMax, target.pvActuels + healAmount);

      await prisma.combatEntite.update({
        where: { id: target.id },
        data: { pvActuels: newPV },
      });

      heals.push({
        entiteId: target.id,
        healAmount: newPV - target.pvActuels,
        isCritical: healResult.isCritical,
        pvRestants: newPV,
      });
    }

    // Log heal action
    const healParts = heals.map(h => {
      const target = combat.entites.find(e => e.id === h.entiteId);
      const critStr = h.isCritical ? 'CRITIQUE ! ' : '';
      return `${critStr}${target?.nom || '?'} récupère ${h.healAmount} PV (${h.pvRestants}/${target?.pvMax || '?'} PV)`;
    });
    const healLabel = `${attacker.nom} lance ${spell!.nom} (${attackData.coutPA} PA) → ${healParts.join(', ')}`;
    await addLog(combatId, combat.tourActuel, healLabel, 'ACTION');

    // Log applied effects
    for (const ef of appliedEffects) {
      const target = combat.entites.find(e => e.id === ef.entiteId);
      if (ef.isDispel) {
        await addLog(combatId, combat.tourActuel, `Dispel ! ${target?.nom || '?'} perd ${ef.removedCount || 0} effet(s)`, 'ACTION');
      } else if (ef.isPushPull && ef.pushPullResult) {
        const r = ef.pushPullResult;
        if (r.moved) {
          const verb = ef.effetNom.toLowerCase().includes('attir') ? 'attiré' : 'repoussé';
          await addLog(combatId, combat.tourActuel, `${target?.nom || '?'} est ${verb} de ${r.distanceReelle} case(s) (${r.from.x},${r.from.y}) → (${r.to.x},${r.to.y})`, 'ACTION');
          await triggerPiegesForEntity(combatId, ef.entiteId, r.to.x, r.to.y);
          await checkCombatEnd(combatId);
        } else {
          await addLog(combatId, combat.tourActuel, `${target?.nom || '?'} résiste au déplacement`, 'ACTION');
        }
      } else {
        await addLog(combatId, combat.tourActuel, `${target?.nom || '?'}: ${ef.effetNom} (${ef.duree}t)`, 'EFFET');
      }
    }

    const effectsMessage = appliedEffects.length > 0
      ? ` Applied effects: ${appliedEffects.map(e => e.effetNom).join(', ')}`
      : '';

    return {
      success: true,
      message: `Heal hit ${heals.length} target(s).${effectsMessage}`,
      actionType,
      damages: [],
      heals,
      appliedEffects: appliedEffects.length > 0 ? appliedEffects : undefined,
    };
  }

  // ===== DAMAGE BRANCH (default) =====
  if (validTargets.length === 0) {
    // Log effects even when no damage targets
    const actionLabel = useArme
      ? `${attacker.nom} utilise ${(attacker.armeData as unknown as ArmeData).nom} (${attackData.coutPA} PA)`
      : `${attacker.nom} lance ${spell!.nom} (${attackData.coutPA} PA)`;

    if (appliedEffects.length > 0) {
      await addLog(combatId, combat.tourActuel, `${actionLabel} → aucune cible`, 'ACTION');
      for (const ef of appliedEffects) {
        const target = combat.entites.find(e => e.id === ef.entiteId);
        if (ef.isDispel) {
          await addLog(combatId, combat.tourActuel, `Dispel ! ${target?.nom || '?'} perd ${ef.removedCount || 0} effet(s)`, 'ACTION');
        } else {
          await addLog(combatId, combat.tourActuel, `${target?.nom || '?'}: ${ef.effetNom} (${ef.duree}t)`, 'EFFET');
        }
      }
    }

    const effectsMessage = appliedEffects.length > 0
      ? `Applied effects: ${appliedEffects.map(e => e.effetNom).join(', ')}`
      : 'No targets in area';
    return {
      success: true,
      message: effectsMessage,
      actionType,
      damages: [],
      appliedEffects: appliedEffects.length > 0 ? appliedEffects : undefined,
    };
  }

  // Get attacker stats with active effects applied
  const attackerBaseStats = {
    force: attacker.force,
    intelligence: attacker.intelligence,
    dexterite: attacker.dexterite,
    agilite: attacker.agilite,
    vie: attacker.vie,
    chance: attacker.chance,
  };
  const attackerModifiedStats = await getStatsWithEffects(combatId, entiteId, attackerBaseStats);
  const attackerStatsWithCrit = { ...attackerModifiedStats, bonusCritique: attacker.bonusCritique + poMods.critiqueModifier };

  // Calculate and apply damage to each target
  const damages: ActionResult['damages'] = [];
  const heals: ActionResult['heals'] = [];
  const entitesMortes: number[] = [];

  // Build effective lignes for weapon (lines-only)
  const armeDataForLines = useArme ? (attacker.armeData as unknown as ArmeData) : null;
  const effectiveLignes: LigneDegats[] = useArme && armeDataForLines
    ? armeDataForLines.lignes
    : [];

  if (useArme && effectiveLignes.length === 0) {
    return { success: false, message: 'Cette arme n\'a pas de ligne de dégâts configurée' };
  }

  // Global crit roll for ALL weapons (one roll per attack, covers mono and multi-line)
  let globalWeaponCrit = false;
  if (useArme && armeDataForLines) {
    const critChance = calculateCritChance(armeDataForLines.chanceCritBase, attackerModifiedStats.chance, attacker.bonusCritique + poMods.critiqueModifier);
    globalWeaponCrit = checkProbability(critChance);
  }

  // Total lifesteal accumulated across all targets and lines
  let totalLifestealAmount = 0;

  // Track per-target line details for multi-line log formatting
  const targetLineDetails: Map<number, { damage: number; stat: string; isVdV: boolean; isSoin: boolean }[]> = new Map();

  for (const target of validTargets) {
    let totalDamageForTarget = 0;
    let totalHealForTarget = 0;
    let anyCrit = false;

    // Calculate AoE distance reduction
    const aoeDistance = manhattanDistance(target.positionX, target.positionY, targetX, targetY);
    const aoeMultiplier = calculateAoEReduction(aoeDistance);

    if (useArme) {
      // ===== WEAPON DAMAGE (unified mono/multi-line) =====
      const bonusCrit = armeDataForLines!.bonusCrit ?? 0;
      const lineDetails: { damage: number; stat: string; isVdV: boolean; isSoin: boolean }[] = [];

      for (const ligne of effectiveLignes) {
        const statValue = getStatValue(attackerModifiedStats, ligne.statUtilisee as any);
        const statMultiplier = calculateStatMultiplier(statValue);

        // Apply flat bonus: bonusSoin for soin lines, bonusDmg for damage lines
        const lineBonus = ligne.estSoin ? bonusSoin : bonusDmg;
        const effectiveMin = ligne.degatsMin + lineBonus;
        const effectiveMax = ligne.degatsMax + lineBonus;

        let baseDmg: number;
        if (globalWeaponCrit) {
          baseDmg = randomInt(effectiveMin + bonusCrit, effectiveMax + bonusCrit);
          anyCrit = true;
        } else {
          baseDmg = randomInt(effectiveMin, effectiveMax);
        }
        const preFinalDmg = Math.floor(Math.floor(baseDmg * statMultiplier) * aoeMultiplier);
        // Apply resistance based on this line's stat
        const lineResistance = await getEffectiveResistance(combatId, target.id, target, ligne.statUtilisee as any);
        const finalDmg = applyResistance(preFinalDmg, lineResistance);

        lineDetails.push({
          damage: finalDmg,
          stat: ligne.statUtilisee,
          isVdV: ligne.estVolDeVie ?? false,
          isSoin: ligne.estSoin ?? false,
        });

        if (ligne.estSoin) {
          totalHealForTarget += finalDmg;
        } else {
          totalDamageForTarget += finalDmg;
        }

        // Per-line vol de vie
        if (ligne.estVolDeVie && !ligne.estSoin && finalDmg > 0) {
          totalLifestealAmount += Math.floor(finalDmg / 2);
        }
      }

      targetLineDetails.set(target.id, lineDetails);
    } else {
      // ===== SPELL DAMAGE =====
      const spellData = {
        degatsMin: attackData.degatsMin + bonusDmg,
        degatsMax: attackData.degatsMax + bonusDmg,
        degatsCritMin: attackData.degatsCritMin! + bonusDmg,
        degatsCritMax: attackData.degatsCritMax! + bonusDmg,
        chanceCritBase: attackData.chanceCritBase,
        statUtilisee: attackData.statUtilisee as any,
        coefficient: spell?.coefficient ?? 1.0,
      };

      const damageResult = calculateDamage(spellData, attackerStatsWithCrit);
      const rawSpellDmg = Math.floor(damageResult.finalDamage * aoeMultiplier);
      // Apply resistance based on the spell's stat
      const spellResistance = await getEffectiveResistance(combatId, target.id, target, attackData.statUtilisee as any);
      totalDamageForTarget = applyResistance(rawSpellDmg, spellResistance);
      anyCrit = damageResult.isCritical;
    }

    // Apply heal from estSoin lines on target
    if (totalHealForTarget > 0) {
      const newPV = Math.min(target.pvMax, target.pvActuels + totalHealForTarget);
      const actualHeal = newPV - target.pvActuels;
      await prisma.combatEntite.update({
        where: { id: target.id },
        data: { pvActuels: newPV },
      });
      if (actualHeal > 0) {
        heals.push({
          entiteId: target.id,
          healAmount: actualHeal,
          isCritical: anyCrit,
          pvRestants: newPV,
        });
      }
      // If there's also damage, apply it after heal
      if (totalDamageForTarget <= 0) continue;
      // Re-read current PV after heal
      const afterHeal = await prisma.combatEntite.findUnique({ where: { id: target.id } });
      if (afterHeal) target.pvActuels = afterHeal.pvActuels;
    }

    // Apply shield reduction before damage (bouclier absorbs damage of matching stat)
    if (totalDamageForTarget > 0) {
      const shieldStat = useArme && effectiveLignes.length > 0
        ? effectiveLignes[0].statUtilisee
        : attackData.statUtilisee;
      const shieldAbsorb = await calculateShieldReduction(combatId, target.id, shieldStat);
      if (shieldAbsorb > 0) {
        const absorbed = Math.min(shieldAbsorb, totalDamageForTarget);
        totalDamageForTarget = Math.max(0, totalDamageForTarget - absorbed);
        await addLog(combatId, combat.tourActuel, `${target.nom} : bouclier absorbe ${absorbed} dégâts`, 'EFFET');
      }
    }

    // Apply damage
    const newPV = applyDamage(target.pvActuels, totalDamageForTarget);

    await prisma.combatEntite.update({
      where: { id: target.id },
      data: { pvActuels: newPV },
    });

    damages.push({
      entiteId: target.id,
      damage: totalDamageForTarget,
      isCritical: anyCrit,
      pvRestants: newPV,
    });

    if (isDead(newPV)) {
      entitesMortes.push(target.id);
      const killedInvocations = await killInvocationsOf(combatId, target.id);
      entitesMortes.push(...killedInvocations);

      const allDeadIds = [target.id, ...killedInvocations];
      await prisma.effetActif.deleteMany({
        where: { combatId, entiteId: { in: allDeadIds } },
      });

      for (const deadId of allDeadIds) {
        await removeEffectsByCaster(combatId, deadId);
      }
    }
  }

  // ===== LIFESTEAL =====
  // For spells: global estVolDeVie flag. For multi-line weapons: accumulated per-line.
  const isSpellVolDeVie = !useArme && (spell?.estVolDeVie ?? false);
  if (isSpellVolDeVie && damages.length > 0) {
    totalLifestealAmount = Math.floor(damages.reduce((sum, d) => sum + d.damage, 0) / 2);
  }

  let lifestealResult: ActionResult['lifesteal'] = undefined;
  if (totalLifestealAmount > 0) {
    const currentAttacker = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
    if (currentAttacker && currentAttacker.pvActuels > 0) {
      const newPV = Math.min(currentAttacker.pvMax, currentAttacker.pvActuels + totalLifestealAmount);
      const actualHeal = newPV - currentAttacker.pvActuels;
      await prisma.combatEntite.update({
        where: { id: entiteId },
        data: { pvActuels: newPV },
      });
      lifestealResult = { healAmount: actualHeal, pvRestants: newPV };
    }
  }

  // Log damage action
  const actionLabel = useArme
    ? `${attacker.nom} utilise ${(attacker.armeData as unknown as ArmeData).nom} (${attackData.coutPA} PA)`
    : `${attacker.nom} lance ${spell!.nom} (${attackData.coutPA} PA)`;
  const critPrefix = useArme && globalWeaponCrit ? 'CRITIQUE ! ' : '';
  const dmgParts = damages.map(d => {
    const target = combat.entites.find(e => e.id === d.entiteId);
    const critStr = !useArme && d.isCritical ? 'CRITIQUE ! ' : '';

    // Build detail string for multi-line weapons
    let detailStr = '';
    const lineDetails = targetLineDetails.get(d.entiteId);
    if (lineDetails && lineDetails.length > 1) {
      const dmgDetails = lineDetails
        .filter(l => !l.isSoin)
        .map(l => {
          let label = `${l.damage} ${l.stat}`;
          if (l.isVdV) label += ' VdV';
          return label;
        });
      if (dmgDetails.length > 0) {
        detailStr = ` (${dmgDetails.join(' + ')})`;
      }
    }

    return `${critStr}${target?.nom || '?'} subit ${d.damage} dégâts${detailStr} (${d.pvRestants}/${target?.pvMax || '?'} PV)`;
  });
  const healParts = heals.map(h => {
    const target = combat.entites.find(e => e.id === h.entiteId);

    // Build detail string for multi-line weapon heals
    let detailStr = '';
    const lineDetails = targetLineDetails.get(h.entiteId);
    if (lineDetails && lineDetails.length > 1) {
      const healDetails = lineDetails
        .filter(l => l.isSoin)
        .map(l => `${l.damage} ${l.stat} Soin`);
      if (healDetails.length > 0) {
        detailStr = ` (${healDetails.join(' + ')})`;
      }
    }

    return `${target?.nom || '?'} récupère ${h.healAmount} PV${detailStr} (${h.pvRestants}/${target?.pvMax || '?'} PV)`;
  });
  const allParts = [...dmgParts, ...healParts];
  if (allParts.length > 0) {
    await addLog(combatId, combat.tourActuel, `${critPrefix}${actionLabel} → ${allParts.join(', ')}`, 'ACTION');
  } else {
    await addLog(combatId, combat.tourActuel, `${actionLabel} → aucune cible`, 'ACTION');
  }

  // Log lifesteal
  if (lifestealResult && lifestealResult.healAmount > 0) {
    await addLog(combatId, combat.tourActuel, `${attacker.nom} vole ${lifestealResult.healAmount} PV (${lifestealResult.pvRestants}/${attacker.pvMax} PV)`, 'ACTION');
  }

  // Log applied effects
  for (const ef of appliedEffects) {
    const target = combat.entites.find(e => e.id === ef.entiteId);
    if (ef.isDispel) {
      await addLog(combatId, combat.tourActuel, `Dispel ! ${target?.nom || '?'} perd ${ef.removedCount || 0} effet(s)`, 'ACTION');
    } else if (ef.isPushPull && ef.pushPullResult) {
      const r = ef.pushPullResult;
      if (r.moved) {
        const verb = ef.effetNom.toLowerCase().includes('attir') ? 'attiré' : 'repoussé';
        await addLog(combatId, combat.tourActuel, `${target?.nom || '?'} est ${verb} de ${r.distanceReelle} case(s) (${r.from.x},${r.from.y}) → (${r.to.x},${r.to.y})`, 'ACTION');
        await triggerPiegesForEntity(combatId, ef.entiteId, r.to.x, r.to.y);
      } else {
        await addLog(combatId, combat.tourActuel, `${target?.nom || '?'} résiste au déplacement`, 'ACTION');
      }
    } else {
      await addLog(combatId, combat.tourActuel, `${target?.nom || '?'}: ${ef.effetNom} (${ef.duree}t)`, 'EFFET');
    }
  }

  // Log deaths
  for (const deadId of entitesMortes) {
    const dead = combat.entites.find(e => e.id === deadId);
    if (dead) {
      await addLog(combatId, combat.tourActuel, `${dead.nom} est mort !`, 'MORT');
    }
  }

  // Check if combat should end
  await checkCombatEnd(combatId);

  const effectsMessage = appliedEffects.length > 0
    ? ` Applied effects: ${appliedEffects.map(e => e.effetNom).join(', ')}`
    : '';

  return {
    success: true,
    message: `${actionType === 'ARME' ? 'Weapon attack' : 'Spell'} hit ${damages.length} target(s).${effectsMessage}`,
    actionType,
    damages,
    heals: heals.length > 0 ? heals : undefined,
    entiteMorte: entitesMortes.length > 0 ? entitesMortes : undefined,
    appliedEffects: appliedEffects.length > 0 ? appliedEffects : undefined,
    lifesteal: lifestealResult,
  };
}

/**
 * Move an entity
 */
export async function moveEntity(
  combatId: number,
  entiteId: number,
  targetX: number,
  targetY: number
): Promise<ActionResult> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: { entites: true, cases: true },
  });

  if (!combat || combat.status !== CombatStatus.EN_COURS) {
    return { success: false, message: 'Combat not found or not in progress' };
  }

  const entity = combat.entites.find((e) => e.id === entiteId);
  if (!entity || entity.pvActuels <= 0) {
    return { success: false, message: 'Entity not found or dead' };
  }

  // Verify it's this entity's turn
  if (combat.entiteActuelleId !== entiteId) {
    return { success: false, message: "Not this entity's turn" };
  }

  // Convert cases to CombatCaseState format
  const blockedCases: CombatCaseState[] = combat.cases.map((c) => ({
    x: c.x,
    y: c.y,
    bloqueDeplacement: c.bloqueDeplacement,
    bloqueLigneDeVue: c.bloqueLigneDeVue,
  }));

  const moveResult = canMove(
    { x: entity.positionX, y: entity.positionY },
    { x: targetX, y: targetY },
    entity.pmActuels,
    { width: combat.grilleLargeur, height: combat.grilleHauteur },
    combat.entites,
    blockedCases
  );

  if (!moveResult.valid) {
    return { success: false, message: moveResult.reason || 'Cannot move' };
  }

  // Update entity position and PM
  const pmUsed = moveResult.cost || 0;
  await prisma.combatEntite.update({
    where: { id: entiteId },
    data: {
      positionX: targetX,
      positionY: targetY,
      pmActuels: entity.pmActuels - pmUsed,
    },
  });

  // Trigger traps on the new position (traps are one-shot, invisible to enemy)
  await triggerPiegesForEntity(combatId, entiteId, targetX, targetY);

  // Always check combat end: trap AoE can kill other entities even if the trigger entity survived
  await checkCombatEnd(combatId);

  return {
    success: true,
    message: `Moved to (${targetX}, ${targetY}), ${pmUsed} PM used`,
    pmUsed,
  };
}

/**
 * End the current entity's turn
 */
export async function endTurn(combatId: number, entiteId: number): Promise<ActionResult> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: { entites: true },
  });

  if (!combat || combat.status !== CombatStatus.EN_COURS) {
    return { success: false, message: 'Combat not found or not in progress' };
  }

  // Safety check: catch any combat that should already be over (e.g. last enemy killed by trap AoE)
  await checkCombatEnd(combatId);
  const combatAfterCheck = await prisma.combat.findUnique({ where: { id: combatId }, select: { status: true } });
  if (combatAfterCheck && combatAfterCheck.status !== CombatStatus.EN_COURS) {
    return { success: true, message: 'Combat ended.' };
  }

  const entity = combat.entites.find((e) => e.id === entiteId);
  if (!entity) {
    return { success: false, message: 'Entity not found' };
  }

  // Verify it's this entity's turn
  if (combat.entiteActuelleId !== entiteId) {
    return { success: false, message: "Not this entity's turn" };
  }

  // Get next entity in turn order
  const aliveEntities = combat.entites.filter((e) => e.pvActuels > 0);
  const nextEntity = getNextEntity(aliveEntities, entity.ordreJeu);

  if (!nextEntity) {
    return { success: false, message: 'No more entities alive' };
  }

  // Check if new round
  const isNewRound = nextEntity.ordreJeu <= entity.ordreJeu;

  if (isNewRound) {
    // Reset PA and PM for all alive entities (applying PA/PM modifiers from effects)
    for (const e of aliveEntities) {
      const mods = await getResourceModifiers(combatId, e.id);
      await prisma.combatEntite.update({
        where: { id: e.id },
        data: {
          paActuels: Math.max(0, e.paMax + mods.paModifier),
          pmActuels: Math.max(0, e.pmMax + mods.pmModifier),
        },
      });
    }

    // Increment turn counter and update current entity
    await prisma.combat.update({
      where: { id: combatId },
      data: { tourActuel: combat.tourActuel + 1, entiteActuelleId: nextEntity.id },
    });

    await addLog(combatId, combat.tourActuel + 1, `Tour ${combat.tourActuel + 1} commence`, 'TOUR');

    // Decrement zone durations at new round
    await decrementZones(combatId);
  } else {
    // Update current entity for the next turn
    await prisma.combat.update({
      where: { id: combatId },
      data: { entiteActuelleId: nextEntity.id },
    });
  }

  // Trigger glyphs at next entity's position at the start of their turn
  await triggerGlyphesForEntity(combatId, nextEntity.id, nextEntity.positionX, nextEntity.positionY);

  // Check if entity died from glyph
  const nextEntityAfterGlyph = await prisma.combatEntite.findUnique({ where: { id: nextEntity.id } });
  if (nextEntityAfterGlyph && nextEntityAfterGlyph.pvActuels <= 0) {
    await checkCombatEnd(combatId);
    const combatAfterGlyph = await prisma.combat.findUnique({ where: { id: combatId } });
    if (combatAfterGlyph && combatAfterGlyph.status === CombatStatus.EN_COURS) {
      return endTurn(combatId, nextEntity.id);
    }
    return { success: true, message: `${nextEntity.nom} died from glyph.` };
  }

  // Decrement effects, cooldowns and weapon cooldown for the next entity at the start of their turn
  await decrementEffects(combatId, nextEntity.id);

  // Check if entity died from poison — if so, skip to next entity
  const nextEntityAfterPoison = await prisma.combatEntite.findUnique({ where: { id: nextEntity.id } });
  if (nextEntityAfterPoison && nextEntityAfterPoison.pvActuels <= 0) {
    // Entity died from poison/effect, check if combat ended
    await checkCombatEnd(combatId);
    const combatAfterPoison = await prisma.combat.findUnique({ where: { id: combatId } });
    if (combatAfterPoison && combatAfterPoison.status === CombatStatus.EN_COURS) {
      // Skip to next entity
      return endTurn(combatId, nextEntity.id);
    }
    return {
      success: true,
      message: `${nextEntity.nom} died from poison.`,
    };
  }

  await spellService.decrementCooldownsForEntity(combatId, nextEntity.id);
  if (nextEntity.armeCooldownRestant > 0) {
    await prisma.combatEntite.update({
      where: { id: nextEntity.id },
      data: { armeCooldownRestant: Math.max(0, nextEntity.armeCooldownRestant - 1) },
    });
  }

  // Auto-play AI turn for enemies (team 1) and player invocations (have invocateurId)
  if (nextEntity.equipe === 1 || nextEntity.invocateurId !== null) {
    // Execute AI turn asynchronously (don't block the response)
    setImmediate(async () => {
      try {
        await executeAITurn(combatId, nextEntity.id);
      } catch (error) {
        console.error('AI turn error:', error);
      }
    });
  }

  return {
    success: true,
    message: isNewRound
      ? `Turn ended. New round ${combat.tourActuel + 1} begins. Next: ${nextEntity.nom}`
      : `Turn ended. Next: ${nextEntity.nom}`,
  };
}

/**
 * Flee from combat
 */
export async function fleeCombat(combatId: number): Promise<ActionResult> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
  });

  if (!combat || combat.status !== CombatStatus.EN_COURS) {
    return { success: false, message: 'Combat not found or not in progress' };
  }

  // Check if this is a dungeon combat - cannot flee from dungeons
  const run = await donjonService.getRunByCombatId(combatId);
  if (run) {
    return { success: false, message: 'Cannot flee from dungeon combat' };
  }

  const combatData = await prisma.combat.findUnique({ where: { id: combatId } });
  await addLog(combatId, combatData?.tourActuel ?? 0, 'Combat terminé ! Fuite', 'FIN');

  await prisma.combat.update({
    where: { id: combatId },
    data: { status: CombatStatus.ABANDONNE },
  });

  // Clean up combat effects, cooldowns, zones and surviving invocations
  await prisma.effetActif.deleteMany({ where: { combatId } });
  await prisma.sortCooldown.deleteMany({ where: { combatId } });
  await cleanupZones(combatId);
  await prisma.combatEntite.updateMany({
    where: { combatId, invocateurId: { not: null }, pvActuels: { gt: 0 } },
    data: { pvActuels: 0 },
  });

  return { success: true, message: 'Fled from combat' };
}

/**
 * Check if combat should end and distribute XP if players won
 * Handles dungeon progression automatically
 */
async function checkCombatEnd(combatId: number): Promise<void> {
  // Guard: avoid double-processing if combat is already terminated
  const existing = await prisma.combat.findUnique({ where: { id: combatId }, select: { status: true } });
  if (!existing || existing.status !== CombatStatus.EN_COURS) return;

  const entities = await prisma.combatEntite.findMany({
    where: { combatId },
  });

  const team0Alive = entities.filter((e) => e.equipe === 0 && e.pvActuels > 0);
  const team1Alive = entities.filter((e) => e.equipe === 1 && e.pvActuels > 0);

  if (team0Alive.length === 0 || team1Alive.length === 0) {
    const combat = await prisma.combat.findUnique({ where: { id: combatId } });
    const tour = combat?.tourActuel ?? 0;

    await prisma.combat.update({
      where: { id: combatId },
      data: { status: CombatStatus.TERMINE },
    });

    const isVictory = team0Alive.length > 0;
    await addLog(combatId, tour, `Combat terminé ! ${isVictory ? 'Victoire' : 'Défaite'}`, 'FIN');

    // Clean up combat effects, cooldowns and zones
    await prisma.effetActif.deleteMany({ where: { combatId } });
    await prisma.sortCooldown.deleteMany({ where: { combatId } });
    await cleanupZones(combatId);

    // Kill surviving invocations (they don't persist beyond combat)
    await prisma.combatEntite.updateMany({
      where: { combatId, invocateurId: { not: null }, pvActuels: { gt: 0 } },
      data: { pvActuels: 0 },
    });

    // Check if this is a dungeon combat
    const run = await donjonService.getRunByCombatId(combatId);

    // Players won
    if (team0Alive.length > 0 && team1Alive.length === 0) {
      await progressionService.distributeXP(combatId);

      // Distribute drops (gold, resources, equipment)
      try {
        const drops = await dropService.distributeDrops(combatId);
        if (drops.totalOr > 0 || drops.totalRessources.length > 0 || drops.totalItems.length > 0) {
          // Log per-player drops
          for (const pr of drops.perPlayer) {
            const parts: string[] = [];
            if (pr.or > 0) parts.push(`${pr.or} or`);
            if (pr.ressources.length > 0) {
              parts.push(pr.ressources.map(r => `${r.quantite}x ${r.nom}`).join(', '));
            }
            if (pr.items.length > 0) {
              parts.push(pr.items.map(i => i.nom).join(', '));
            }
            if (parts.length > 0) {
              await addLog(combatId, tour, `Butin ${pr.nom} : ${parts.join(' | ')}`, 'FIN');
            }
          }
        }
      } catch (error) {
        console.error('Error distributing drops:', error);
      }

      // If in dungeon, advance to next room
      if (run) {
        try {
          await donjonService.advanceToNextRoom(run.id);
        } catch (error) {
          console.error('Error advancing dungeon room:', error);
        }
      }
    }

    // Players lost
    if (team0Alive.length === 0 && team1Alive.length > 0) {
      // If in dungeon, fail the run and eject group
      if (run) {
        try {
          await donjonService.failDungeon(run.id);
        } catch (error) {
          console.error('Error failing dungeon:', error);
        }
      }
    }
  }
}

/**
 * Decrement effect durations and remove expired effects
 */
async function decrementEffects(combatId: number, entiteId?: number): Promise<void> {
  const where: { combatId: number; entiteId?: number } = { combatId };
  if (entiteId !== undefined) where.entiteId = entiteId;

  // Apply poison damage BEFORE decrementing durations
  if (entiteId !== undefined) {
    const poisonResult = await applyPoisonDamage(combatId, entiteId);
    if (poisonResult.totalDamage > 0) {
      const combat = await prisma.combat.findUnique({ where: { id: combatId } });
      const tour = combat?.tourActuel ?? 0;
      const entity = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
      if (entity) {
        // Log each poison individually for clarity
        const poisonEffects = await prisma.effetActif.findMany({
          where: { combatId, entiteId },
          include: { effet: true },
        });
        const poisons = poisonEffects.filter(e => e.effet.type === 'POISON');
        if (poisons.length > 0) {
          const stackSuffix = poisons.length > 1 ? ` [${poisons.length} stacks]` : '';
          await addLog(combatId, tour, `${entity.nom} subit ${poisonResult.totalDamage} dégâts de poison${stackSuffix} (${entity.pvActuels}/${entity.pvMax} PV)`, 'EFFET');
        }
      }

      if (poisonResult.died && entity) {
        await addLog(combatId, combat?.tourActuel ?? 0, `${entity.nom} est mort du poison !`, 'MORT');
        // Kill invocations of the dead entity
        const killedInvocations = await killInvocationsOf(combatId, entiteId);
        // Remove effects on dead entities
        const allDeadIds = [entiteId, ...killedInvocations];
        await prisma.effetActif.deleteMany({
          where: { combatId, entiteId: { in: allDeadIds } },
        });
        // Remove effects cast by dead entities
        for (const deadId of allDeadIds) {
          await removeEffectsByCaster(combatId, deadId);
        }
        // Log death of invocations
        for (const killedId of killedInvocations) {
          const killed = await prisma.combatEntite.findUnique({ where: { id: killedId } });
          if (killed) await addLog(combatId, combat?.tourActuel ?? 0, `${killed.nom} est mort !`, 'MORT');
        }
        // Check if combat should end
        await checkCombatEnd(combatId);
        return; // Don't decrement effects for dead entity
      }
    }
  }

  // Decrement active effects
  await prisma.effetActif.updateMany({
    where,
    data: { toursRestants: { decrement: 1 } },
  });

  // Find expired effects before deleting (for logging)
  const expired = await prisma.effetActif.findMany({
    where: { ...where, toursRestants: { lte: 0 } },
    include: { effet: true },
  });

  if (expired.length > 0) {
    const combat = await prisma.combat.findUnique({ where: { id: combatId } });
    const tour = combat?.tourActuel ?? 0;

    // Get entity names
    const expiredEntiteIds = [...new Set(expired.map(e => e.entiteId))];
    const entites = await prisma.combatEntite.findMany({
      where: { id: { in: expiredEntiteIds } },
    });
    const nameMap = new Map(entites.map(e => [e.id, e.nom]));

    for (const ef of expired) {
      const nom = nameMap.get(ef.entiteId) || '?';
      await addLog(combatId, tour, `${nom}: ${ef.effet.nom} expire`, 'EFFET_EXPIRE');
    }

    // Roll back PA/PM that were credited immediately on cast
    const NON_STAT_TYPES = ['DISPEL', 'POUSSEE', 'ATTIRANCE', 'POISON', 'BOUCLIER', 'RESISTANCE'];
    for (const entId of expiredEntiteIds) {
      const expiredForEnt = expired.filter(ef => ef.entiteId === entId && !NON_STAT_TYPES.includes(ef.effet.type));
      const paRemove = expiredForEnt
        .filter(ef => ef.effet.statCiblee === 'PA')
        .reduce((sum, ef) => sum + ef.effet.valeur, 0);
      const pmRemove = expiredForEnt
        .filter(ef => ef.effet.statCiblee === 'PM')
        .reduce((sum, ef) => sum + ef.effet.valeur, 0);
      if (paRemove === 0 && pmRemove === 0) continue;
      const ent = entites.find(e => e.id === entId);
      if (!ent || ent.pvActuels <= 0) continue;
      await prisma.combatEntite.update({
        where: { id: entId },
        data: {
          ...(paRemove !== 0 ? { paActuels: Math.max(0, ent.paActuels - paRemove) } : {}),
          ...(pmRemove !== 0 ? { pmActuels: Math.max(0, ent.pmActuels - pmRemove) } : {}),
        },
      });
    }
  }

  // Remove expired effects
  await prisma.effetActif.deleteMany({
    where: { ...where, toursRestants: { lte: 0 } },
  });
}
