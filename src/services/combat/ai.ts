import prisma from '../../config/database';
import { CombatStatus } from '@prisma/client';
import { Position, CombatCaseState } from '../../types';
import { manhattanDistance } from '../../utils/formulas';
import { hasLineOfSight, canMove } from './movement';
import { executeAction, moveEntity, endTurn } from './engine';
import { spellService } from '../spell.service';

interface EntityState {
  id: number;
  nom: string;
  equipe: number;
  positionX: number;
  positionY: number;
  pvActuels: number;
  paActuels: number;
  pmActuels: number;
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
}

interface SpellInfo {
  id: number;
  nom: string;
  coutPA: number;
  porteeMin: number;
  porteeMax: number;
  ligneDeVue: boolean;
  degatsMin: number;
  degatsMax: number;
  cooldown: number;
}

/**
 * Execute a complete AI turn for an enemy entity
 */
export async function executeAITurn(combatId: number, entiteId: number): Promise<void> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: {
      entites: true,
      cases: true,
    },
  });

  if (!combat || combat.status !== CombatStatus.EN_COURS) {
    return;
  }

  const entity = combat.entites.find((e) => e.id === entiteId);
  if (!entity || entity.pvActuels <= 0) {
    return;
  }

  // Get enemies (opposite team)
  const enemies = combat.entites.filter((e) => e.equipe !== entity.equipe && e.pvActuels > 0);
  if (enemies.length === 0) {
    await endTurn(combatId, entiteId);
    return;
  }

  // Convert cases to CombatCaseState format
  const blockedCases: CombatCaseState[] = combat.cases.map((c) => ({
    x: c.x,
    y: c.y,
    bloqueDeplacement: c.bloqueDeplacement,
    bloqueLigneDeVue: c.bloqueLigneDeVue,
  }));

  // Get available spells for monsters (generic spells with raceId = null)
  const monsterSpells = await prisma.sort.findMany({
    where: { raceId: null },
  });

  // Find closest enemy
  const target = findClosestEnemy(entity, enemies);
  if (!target) {
    await endTurn(combatId, entiteId);
    return;
  }

  // AI loop: try to attack or move while we have PA/PM
  let currentPA = entity.paActuels;
  let currentPM = entity.pmActuels;
  let currentX = entity.positionX;
  let currentY = entity.positionY;
  let maxIterations = 10; // Safety limit

  while (maxIterations > 0) {
    maxIterations--;

    // Refresh entity state
    const updatedEntity = await prisma.combatEntite.findUnique({
      where: { id: entiteId },
    });

    if (!updatedEntity || updatedEntity.pvActuels <= 0) {
      break;
    }

    currentPA = updatedEntity.paActuels;
    currentPM = updatedEntity.pmActuels;
    currentX = updatedEntity.positionX;
    currentY = updatedEntity.positionY;

    // Refresh target state
    const updatedTarget = await prisma.combatEntite.findUnique({
      where: { id: target.id },
    });

    if (!updatedTarget || updatedTarget.pvActuels <= 0) {
      // Target is dead, find new target
      const newCombat = await prisma.combat.findUnique({
        where: { id: combatId },
        include: { entites: true },
      });
      if (!newCombat) break;

      const newEnemies = newCombat.entites.filter((e) => e.equipe !== entity.equipe && e.pvActuels > 0);
      if (newEnemies.length === 0) break;

      // Continue with new closest enemy
      break;
    }

    // Try to find a usable spell
    const usableSpell = await findUsableSpell(
      combatId,
      entiteId,
      monsterSpells,
      { x: currentX, y: currentY },
      { x: updatedTarget.positionX, y: updatedTarget.positionY },
      currentPA,
      combat.entites,
      blockedCases
    );

    if (usableSpell) {
      // Attack!
      await executeAction(combatId, entiteId, usableSpell.id, updatedTarget.positionX, updatedTarget.positionY);
      continue;
    }

    // Can't attack, try to move closer
    if (currentPM > 0) {
      const moveResult = await moveTowardsTarget(
        combatId,
        entiteId,
        { x: currentX, y: currentY },
        { x: updatedTarget.positionX, y: updatedTarget.positionY },
        currentPM,
        { width: combat.grilleLargeur, height: combat.grilleHauteur },
        combat.entites,
        blockedCases
      );

      if (moveResult) {
        continue;
      }
    }

    // Can't attack or move, end turn
    break;
  }

  await endTurn(combatId, entiteId);
}

/**
 * Find the closest enemy (Manhattan distance)
 */
function findClosestEnemy(entity: EntityState, enemies: EntityState[]): EntityState | null {
  if (enemies.length === 0) return null;

  let closest = enemies[0];
  let minDistance = manhattanDistance(entity.positionX, entity.positionY, closest.positionX, closest.positionY);

  for (const enemy of enemies) {
    const dist = manhattanDistance(entity.positionX, entity.positionY, enemy.positionX, enemy.positionY);
    if (dist < minDistance) {
      minDistance = dist;
      closest = enemy;
    }
  }

  return closest;
}

/**
 * Find a spell that can be used on the target
 */
async function findUsableSpell(
  combatId: number,
  entiteId: number,
  spells: SpellInfo[],
  from: Position,
  to: Position,
  availablePA: number,
  entities: EntityState[],
  blockedCases: CombatCaseState[]
): Promise<SpellInfo | null> {
  const distance = manhattanDistance(from.x, from.y, to.x, to.y);

  for (const spell of spells) {
    // Check PA cost
    if (spell.coutPA > availablePA) continue;

    // Check range
    if (distance < spell.porteeMin || distance > spell.porteeMax) continue;

    // Check cooldown
    const cooldownCheck = await spellService.canUseSpell(combatId, entiteId, spell.id);
    if (!cooldownCheck.canUse) continue;

    // Check LOS if required
    if (spell.ligneDeVue) {
      if (!hasLineOfSight(from, to, entities, blockedCases)) continue;
    }

    return spell;
  }

  return null;
}

/**
 * Move one step towards the target
 */
async function moveTowardsTarget(
  combatId: number,
  entiteId: number,
  from: Position,
  to: Position,
  availablePM: number,
  grid: { width: number; height: number },
  entities: EntityState[],
  blockedCases: CombatCaseState[]
): Promise<boolean> {
  // Determine best direction to move
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Prioritize the larger distance
  const possibleMoves: Position[] = [];

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Prioritize horizontal movement
    if (dx > 0) possibleMoves.push({ x: from.x + 1, y: from.y });
    else if (dx < 0) possibleMoves.push({ x: from.x - 1, y: from.y });
    if (dy > 0) possibleMoves.push({ x: from.x, y: from.y + 1 });
    else if (dy < 0) possibleMoves.push({ x: from.x, y: from.y - 1 });
  } else {
    // Prioritize vertical movement
    if (dy > 0) possibleMoves.push({ x: from.x, y: from.y + 1 });
    else if (dy < 0) possibleMoves.push({ x: from.x, y: from.y - 1 });
    if (dx > 0) possibleMoves.push({ x: from.x + 1, y: from.y });
    else if (dx < 0) possibleMoves.push({ x: from.x - 1, y: from.y });
  }

  // Try each possible move
  for (const move of possibleMoves) {
    const moveCheck = canMove(from, move, availablePM, grid, entities, blockedCases);
    if (moveCheck.valid) {
      const result = await moveEntity(combatId, entiteId, move.x, move.y);
      return result.success;
    }
  }

  return false;
}
