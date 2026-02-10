import { CombatStatus, Sort, ZoneType, IAType } from '@prisma/client';
import prisma from '../../config/database';
import { CombatState, ActionResult, Position, CombatCaseState, ArmeData, ActiveEffectStateWithDetails, CombatSpellState } from '../../types';
import { calculateAlternatingInitiativeOrder, getNextEntity } from './initiative';
import { calculateDamage, applyDamage, isDead } from './damage';
import { canMove, calculateMovementCost, hasLineOfSight } from './movement';
import { getAffectedCells, getEntitiesInArea } from './aoe';
import { manhattanDistance } from '../../utils/formulas';
import { progressionService } from '../progression.service';
import { getCombatCases } from './grid';
import { spellService } from '../spell.service';
import { executeAITurn } from './ai';
import { createInvocation, killInvocationsOf } from './invocation';
import { donjonService } from '../donjon.service';
import { getStatsWithEffects, applySpellEffects, getAllActiveEffectsWithDetails, dispelEffects } from './effects';
import { checkProbability } from '../../utils/random';

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
            estDispel: ps.sort.estDispel,
            estInvocation: ps.sort.estInvocation,
            tauxEchec: ps.sort.tauxEchec,
            zone: ps.sort.zone
              ? { type: ps.sort.zone.type, taille: ps.sort.zone.taille, nom: ps.sort.zone.nom }
              : null,
            effets: ps.sort.effets.map((se) => ({
              effetId: se.effet.id,
              nom: se.effet.nom,
              type: se.effet.type,
              statCiblee: se.effet.statCiblee,
              valeur: se.effet.valeur,
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
            estDispel: ms.sort.estDispel,
            estInvocation: ms.sort.estInvocation,
            tauxEchec: ms.sort.tauxEchec,
            zone: ms.sort.zone
              ? { type: ms.sort.zone.type, taille: ms.sort.zone.taille, nom: ms.sort.zone.nom }
              : null,
            effets: ms.sort.effets.map((se) => ({
              effetId: se.effet.id,
              nom: se.effet.nom,
              type: se.effet.type,
              statCiblee: se.effet.statCiblee,
              valeur: se.effet.valeur,
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
        sorts,
      };
    })
  );

  return {
    id: combat.id,
    status: combat.status,
    tourActuel: combat.tourActuel,
    entiteActuelle: combat.entiteActuelleId ?? 0,
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
    degatsMin: number;
    degatsMax: number;
    degatsCritMin: number;
    degatsCritMax: number;
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
      degatsMin: armeData.degatsMin,
      degatsMax: armeData.degatsMax,
      degatsCritMin: armeData.degatsCritMin,
      degatsCritMax: armeData.degatsCritMax,
      chanceCritBase: armeData.chanceCritBase,
      statUtilisee: armeData.statUtilisee,
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

  // Check range
  const distance = manhattanDistance(attacker.positionX, attacker.positionY, targetX, targetY);
  if (distance < attackData.porteeMin || distance > attackData.porteeMax) {
    return {
      success: false,
      message: `Target out of range (distance: ${distance}, range: ${attackData.porteeMin}-${attackData.porteeMax})`,
    };
  }

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
  let appliedEffects: { entiteId: number; effetId: number; effetNom: string; duree: number }[] = [];
  if (!useArme && sortId) {
    appliedEffects = await applySpellEffects(combatId, sortId, entiteId, targetIds);
  }

  // ===== DISPEL BRANCH =====
  if (spell?.estDispel) {
    const removedEffects: { entiteId: number; removedCount: number }[] = [];
    for (const target of validTargets) {
      const count = await dispelEffects(combatId, target.id);
      if (count > 0) {
        removedEffects.push({ entiteId: target.id, removedCount: count });
      }
    }
    const totalRemoved = removedEffects.reduce((sum, r) => sum + r.removedCount, 0);
    return {
      success: true,
      message: `Dispel removed ${totalRemoved} effect(s) from ${removedEffects.length} target(s).`,
      actionType,
      damages: [],
      removedEffects: removedEffects.length > 0 ? removedEffects : undefined,
      appliedEffects: appliedEffects.length > 0 ? appliedEffects : undefined,
    };
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

    const spellData = {
      degatsMin: attackData.degatsMin,
      degatsMax: attackData.degatsMax,
      degatsCritMin: attackData.degatsCritMin,
      degatsCritMax: attackData.degatsCritMax,
      chanceCritBase: attackData.chanceCritBase,
      statUtilisee: attackData.statUtilisee as any,
    };

    const heals: ActionResult['heals'] = [];
    for (const target of validTargets) {
      const healResult = calculateDamage(spellData, attackerModifiedStats);
      const healAmount = healResult.finalDamage;
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

  // Calculate and apply damage to each target
  const damages: ActionResult['damages'] = [];
  const entitesMortes: number[] = [];

  const spellData = {
    degatsMin: attackData.degatsMin,
    degatsMax: attackData.degatsMax,
    degatsCritMin: attackData.degatsCritMin,
    degatsCritMax: attackData.degatsCritMax,
    chanceCritBase: attackData.chanceCritBase,
    statUtilisee: attackData.statUtilisee as any,
  };

  for (const target of validTargets) {
    const damageResult = calculateDamage(spellData, attackerModifiedStats);

    const newPV = applyDamage(target.pvActuels, damageResult.finalDamage);

    // Update target's HP
    await prisma.combatEntite.update({
      where: { id: target.id },
      data: { pvActuels: newPV },
    });

    damages.push({
      entiteId: target.id,
      damage: damageResult.finalDamage,
      isCritical: damageResult.isCritical,
      pvRestants: newPV,
    });

    if (isDead(newPV)) {
      entitesMortes.push(target.id);
      // Kill invocations of the dead entity
      const killedInvocations = await killInvocationsOf(combatId, target.id);
      entitesMortes.push(...killedInvocations);

      // Remove active effects on dead entities
      const allDeadIds = [target.id, ...killedInvocations];
      await prisma.effetActif.deleteMany({
        where: { combatId, entiteId: { in: allDeadIds } },
      });
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
    entiteMorte: entitesMortes.length > 0 ? entitesMortes : undefined,
    appliedEffects: appliedEffects.length > 0 ? appliedEffects : undefined,
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
  await prisma.combatEntite.update({
    where: { id: entiteId },
    data: {
      positionX: targetX,
      positionY: targetY,
      pmActuels: entity.pmActuels - (moveResult.cost || 0),
    },
  });

  return {
    success: true,
    message: `Moved to (${targetX}, ${targetY}), ${moveResult.cost} PM used`,
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
    // Reset PA and PM for all alive entities
    for (const e of aliveEntities) {
      await prisma.combatEntite.update({
        where: { id: e.id },
        data: {
          paActuels: e.paMax,
          pmActuels: e.pmMax,
        },
      });
    }

    // Increment turn counter and update current entity
    await prisma.combat.update({
      where: { id: combatId },
      data: { tourActuel: combat.tourActuel + 1, entiteActuelleId: nextEntity.id },
    });
  } else {
    // Update current entity for the next turn
    await prisma.combat.update({
      where: { id: combatId },
      data: { entiteActuelleId: nextEntity.id },
    });
  }

  // Decrement effects, cooldowns and weapon cooldown for the next entity at the start of their turn
  await decrementEffects(combatId, nextEntity.id);
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

  await prisma.combat.update({
    where: { id: combatId },
    data: { status: CombatStatus.ABANDONNE },
  });

  // Clean up combat effects, cooldowns and surviving invocations
  await prisma.effetActif.deleteMany({ where: { combatId } });
  await prisma.sortCooldown.deleteMany({ where: { combatId } });
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
  const entities = await prisma.combatEntite.findMany({
    where: { combatId },
  });

  const team0Alive = entities.filter((e) => e.equipe === 0 && e.pvActuels > 0);
  const team1Alive = entities.filter((e) => e.equipe === 1 && e.pvActuels > 0);

  if (team0Alive.length === 0 || team1Alive.length === 0) {
    await prisma.combat.update({
      where: { id: combatId },
      data: { status: CombatStatus.TERMINE },
    });

    // Clean up combat effects and cooldowns
    await prisma.effetActif.deleteMany({ where: { combatId } });
    await prisma.sortCooldown.deleteMany({ where: { combatId } });

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

      // If in dungeon, advance to next room
      if (run) {
        // Use setImmediate to avoid blocking and potential circular issues
        setImmediate(async () => {
          try {
            await donjonService.advanceToNextRoom(run.id);
          } catch (error) {
            console.error('Error advancing dungeon room:', error);
          }
        });
      }
    }

    // Players lost
    if (team0Alive.length === 0 && team1Alive.length > 0) {
      // If in dungeon, fail the run and eject group
      if (run) {
        setImmediate(async () => {
          try {
            await donjonService.failDungeon(run.id);
          } catch (error) {
            console.error('Error failing dungeon:', error);
          }
        });
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

  // Decrement active effects
  await prisma.effetActif.updateMany({
    where,
    data: { toursRestants: { decrement: 1 } },
  });

  // Remove expired effects
  await prisma.effetActif.deleteMany({
    where: { ...where, toursRestants: { lte: 0 } },
  });
}
