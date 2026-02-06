import { CombatStatus, Sort, ZoneType } from '@prisma/client';
import prisma from '../../config/database';
import { CombatState, ActionResult, Position, CombatCaseState, ArmeData, ActiveEffectStateWithDetails } from '../../types';
import { calculateAlternatingInitiativeOrder, getNextEntity } from './initiative';
import { calculateDamage, applyDamage, isDead } from './damage';
import { canMove, calculateMovementCost, hasLineOfSight } from './movement';
import { getAffectedCells, getEntitiesInArea } from './aoe';
import { manhattanDistance } from '../../utils/formulas';
import { progressionService } from '../progression.service';
import { getCombatCases } from './grid';
import { spellService } from '../spell.service';
import { executeAITurn } from './ai';
import { killInvocationsOf } from './invocation';
import { donjonService } from '../donjon.service';
import { getStatsWithEffects, applySpellEffects, getAllActiveEffectsWithDetails } from './effects';

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
    },
  });

  if (!combat) {
    return null;
  }

  // Find current entity (lowest ordreJeu among alive entities that haven't acted this turn)
  const aliveEntities = combat.entites.filter((e) => e.pvActuels > 0);
  const sortedEntities = [...aliveEntities].sort((a, b) => a.ordreJeu - b.ordreJeu);
  const currentEntity = sortedEntities[0];

  return {
    id: combat.id,
    status: combat.status,
    tourActuel: combat.tourActuel,
    entiteActuelle: currentEntity?.id ?? 0,
    grille: {
      largeur: combat.grilleLargeur,
      hauteur: combat.grilleHauteur,
    },
    entites: combat.entites.map((e) => ({
      id: e.id,
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
    })),
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

  // Get affected cells
  const affectedCells = getAffectedCells(
    { x: targetX, y: targetY },
    attackData.zone,
    { width: combat.grilleLargeur, height: combat.grilleHauteur },
    { x: attacker.positionX, y: attacker.positionY }
  );

  // Get entities in area
  const targetsInArea = getEntitiesInArea(affectedCells, combat.entites);

  // Filter out friendly entities (can't damage own team)
  const validTargets = targetsInArea.filter((t) => t.equipe !== attacker.equipe);

  // Apply spell effects (buffs/debuffs) - BEFORE checking for targets
  // This allows self-buffs to work even when no enemies are targeted
  const targetIds = validTargets.map(t => t.id);
  let appliedEffects: { entiteId: number; effetId: number; effetNom: string; duree: number }[] = [];
  if (!useArme && sortId) {
    appliedEffects = await applySpellEffects(combatId, sortId, entiteId, targetIds);
  }

  if (validTargets.length === 0) {
    const effectsMessage = appliedEffects.length > 0
      ? `Applied effects: ${appliedEffects.map(e => e.effetNom).join(', ')}`
      : 'No enemies in target area';
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

    // Increment turn counter
    await prisma.combat.update({
      where: { id: combatId },
      data: { tourActuel: combat.tourActuel + 1 },
    });

    // Decrement active effects
    await decrementEffects(combatId);

    // Decrement spell cooldowns
    await spellService.decrementCooldowns(combatId);

    // Decrement weapon cooldowns for all alive entities
    for (const e of aliveEntities) {
      if (e.armeCooldownRestant > 0) {
        await prisma.combatEntite.update({
          where: { id: e.id },
          data: { armeCooldownRestant: Math.max(0, e.armeCooldownRestant - 1) },
        });
      }
    }
  }

  // Check if next entity is an enemy (team 1) and auto-play their turn
  if (nextEntity.equipe === 1) {
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
async function decrementEffects(combatId: number): Promise<void> {
  // Decrement all active effects
  await prisma.effetActif.updateMany({
    where: { combatId },
    data: { toursRestants: { decrement: 1 } },
  });

  // Remove expired effects
  await prisma.effetActif.deleteMany({
    where: {
      combatId,
      toursRestants: { lte: 0 },
    },
  });
}
