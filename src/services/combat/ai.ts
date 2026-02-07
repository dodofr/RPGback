import prisma from '../../config/database';
import { CombatStatus, IAType } from '@prisma/client';
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
  pvMax: number;
  paActuels: number;
  pmActuels: number;
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  monstreTemplateId?: number | null;
  iaType?: IAType | null;
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
  estSoin: boolean;
  estDispel: boolean;
  tauxEchec: number;
}

interface AIContext {
  combatId: number;
  entiteId: number;
  entity: EntityState;
  blockedCases: CombatCaseState[];
  healSpells: SpellInfo[];
  dispelSpells: SpellInfo[];
  damageSpells: SpellInfo[];
}

/**
 * Execute a complete AI turn for an entity
 * Dispatches to the appropriate IA strategy based on iaType
 */
export async function executeAITurn(combatId: number, entiteId: number): Promise<void> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: {
      entites: true,
      cases: true,
      effetsActifs: {
        include: { effet: true },
      },
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

  // Get spells for this monster, ordered by priority
  let monsterSpells: SpellInfo[];
  if (entity.monstreTemplateId) {
    const monstreSorts = await prisma.monstreSort.findMany({
      where: { monstreId: entity.monstreTemplateId },
      include: { sort: true },
      orderBy: { priorite: 'asc' },
    });
    monsterSpells = monstreSorts.map((ms) => ms.sort);
  } else {
    // Fallback: generic spells with raceId = null
    monsterSpells = await prisma.sort.findMany({
      where: { raceId: null },
    });
  }

  // Separate spells by category
  const healSpells = monsterSpells.filter((s) => s.estSoin);
  const dispelSpells = monsterSpells.filter((s) => s.estDispel);
  const damageSpells = monsterSpells.filter((s) => !s.estSoin && !s.estDispel);

  const ctx: AIContext = {
    combatId,
    entiteId,
    entity,
    blockedCases,
    healSpells,
    dispelSpells,
    damageSpells,
  };

  // Dispatch to the appropriate strategy
  const iaType = entity.iaType ?? 'EQUILIBRE';
  switch (iaType) {
    case 'AGGRESSIF':
      await executeAggressifTurn(ctx);
      break;
    case 'SOUTIEN':
      await executeSoutienTurn(ctx);
      break;
    case 'DISTANCE':
      await executeDistanceTurn(ctx);
      break;
    case 'EQUILIBRE':
    default:
      await executeEquilibreTurn(ctx);
      break;
  }

  await endTurn(combatId, entiteId);
}

// ===== EQUILIBRE (default, original behavior) =====
// Heal → Dispel → Attack → Move

async function executeEquilibreTurn(ctx: AIContext): Promise<void> {
  let maxIterations = 10;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, aliveAllies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;

    // 1. Heal injured ally (<70% HP)
    if (ctx.healSpells.length > 0) {
      const injuredAlly = findMostInjuredAlly(aliveAllies, 0.7);
      if (injuredAlly) {
        const healSpell = await findUsableSpell(
          ctx.combatId, ctx.entiteId, ctx.healSpells,
          { x: currentX, y: currentY },
          { x: injuredAlly.positionX, y: injuredAlly.positionY },
          currentPA, currentCombat.entites, ctx.blockedCases
        );
        if (healSpell) {
          await executeAction(ctx.combatId, ctx.entiteId, healSpell.id, injuredAlly.positionX, injuredAlly.positionY);
          continue;
        }
      }
    }

    // 2. Dispel debuffed ally
    if (ctx.dispelSpells.length > 0) {
      const debuffedAlly = findAllyWithDebuffs(aliveAllies, currentCombat.effetsActifs);
      if (debuffedAlly) {
        const dispelSpell = await findUsableSpell(
          ctx.combatId, ctx.entiteId, ctx.dispelSpells,
          { x: currentX, y: currentY },
          { x: debuffedAlly.positionX, y: debuffedAlly.positionY },
          currentPA, currentCombat.entites, ctx.blockedCases
        );
        if (dispelSpell) {
          await executeAction(ctx.combatId, ctx.entiteId, dispelSpell.id, debuffedAlly.positionX, debuffedAlly.positionY);
          continue;
        }
      }
    }

    // 3. Attack closest enemy
    const target = findClosestEnemy(updatedEntity, aliveEnemies);
    if (!target) break;

    const usableSpell = await findUsableSpell(
      ctx.combatId, ctx.entiteId, ctx.damageSpells,
      { x: currentX, y: currentY },
      { x: target.positionX, y: target.positionY },
      currentPA, currentCombat.entites, ctx.blockedCases
    );

    if (usableSpell) {
      await executeAction(ctx.combatId, ctx.entiteId, usableSpell.id, target.positionX, target.positionY);
      continue;
    }

    // 4. Move closer
    if (currentPM > 0) {
      const moveResult = await moveTowardsTarget(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
        currentCombat.entites, ctx.blockedCases
      );
      if (moveResult) continue;
    }

    break;
  }
}

// ===== AGGRESSIF =====
// Rush to attack, never heal/dispel, spend all PM to close distance

async function executeAggressifTurn(ctx: AIContext): Promise<void> {
  let maxIterations = 10;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;

    const target = findClosestEnemy(updatedEntity, aliveEnemies);
    if (!target) break;

    // 1. Try to attack
    const usableSpell = await findUsableSpell(
      ctx.combatId, ctx.entiteId, ctx.damageSpells,
      { x: currentX, y: currentY },
      { x: target.positionX, y: target.positionY },
      currentPA, currentCombat.entites, ctx.blockedCases
    );

    if (usableSpell) {
      await executeAction(ctx.combatId, ctx.entiteId, usableSpell.id, target.positionX, target.positionY);
      continue;
    }

    // 2. Move closer (spend all PM)
    if (currentPM > 0) {
      const moveResult = await moveTowardsTarget(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
        currentCombat.entites, ctx.blockedCases
      );
      if (moveResult) continue;
    }

    break;
  }
}

// ===== SOUTIEN =====
// Heal (threshold 90%) → Dispel → Move towards injured allies → Attack as last resort

async function executeSoutienTurn(ctx: AIContext): Promise<void> {
  let maxIterations = 10;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, aliveAllies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;

    // 1. Heal injured ally (more aggressive threshold: 90%)
    if (ctx.healSpells.length > 0) {
      const injuredAlly = findMostInjuredAlly(aliveAllies, 0.9);
      if (injuredAlly) {
        const healSpell = await findUsableSpell(
          ctx.combatId, ctx.entiteId, ctx.healSpells,
          { x: currentX, y: currentY },
          { x: injuredAlly.positionX, y: injuredAlly.positionY },
          currentPA, currentCombat.entites, ctx.blockedCases
        );
        if (healSpell) {
          await executeAction(ctx.combatId, ctx.entiteId, healSpell.id, injuredAlly.positionX, injuredAlly.positionY);
          continue;
        }

        // Ally injured but out of range → move towards them
        if (currentPM > 0) {
          const moveResult = await moveTowardsTarget(
            ctx.combatId, ctx.entiteId,
            { x: currentX, y: currentY },
            { x: injuredAlly.positionX, y: injuredAlly.positionY },
            currentPM,
            { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
            currentCombat.entites, ctx.blockedCases
          );
          if (moveResult) continue;
        }
      }
    }

    // 2. Dispel debuffed ally
    if (ctx.dispelSpells.length > 0) {
      const debuffedAlly = findAllyWithDebuffs(aliveAllies, currentCombat.effetsActifs);
      if (debuffedAlly) {
        const dispelSpell = await findUsableSpell(
          ctx.combatId, ctx.entiteId, ctx.dispelSpells,
          { x: currentX, y: currentY },
          { x: debuffedAlly.positionX, y: debuffedAlly.positionY },
          currentPA, currentCombat.entites, ctx.blockedCases
        );
        if (dispelSpell) {
          await executeAction(ctx.combatId, ctx.entiteId, dispelSpell.id, debuffedAlly.positionX, debuffedAlly.positionY);
          continue;
        }
      }
    }

    // 3. Attack as last resort
    const target = findClosestEnemy(updatedEntity, aliveEnemies);
    if (target) {
      const usableSpell = await findUsableSpell(
        ctx.combatId, ctx.entiteId, ctx.damageSpells,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPA, currentCombat.entites, ctx.blockedCases
      );
      if (usableSpell) {
        await executeAction(ctx.combatId, ctx.entiteId, usableSpell.id, target.positionX, target.positionY);
        continue;
      }
    }

    break;
  }
}

// ===== DISTANCE =====
// Flee if adjacent → Prefer long range spells → Move to stay at range

async function executeDistanceTurn(ctx: AIContext): Promise<void> {
  // Sort damage spells by porteeMax DESC (prefer long range)
  const rangedSpells = [...ctx.damageSpells].sort((a, b) => b.porteeMax - a.porteeMax);

  let maxIterations = 10;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;

    const target = findClosestEnemy(updatedEntity, aliveEnemies);
    if (!target) break;

    const distToTarget = manhattanDistance(currentX, currentY, target.positionX, target.positionY);

    // 1. If enemy is adjacent (dist <= 1), retreat first
    if (distToTarget <= 1 && currentPM > 0) {
      const retreated = await moveAwayFromTarget(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
        currentCombat.entites, ctx.blockedCases
      );
      if (retreated) continue;
    }

    // 2. Try ranged attack (sorted by longest range first)
    const usableSpell = await findUsableSpell(
      ctx.combatId, ctx.entiteId, rangedSpells,
      { x: currentX, y: currentY },
      { x: target.positionX, y: target.positionY },
      currentPA, currentCombat.entites, ctx.blockedCases
    );

    if (usableSpell) {
      await executeAction(ctx.combatId, ctx.entiteId, usableSpell.id, target.positionX, target.positionY);
      continue;
    }

    // 3. Move towards target if out of range, but stop when in max range
    if (currentPM > 0 && rangedSpells.length > 0) {
      const bestRange = rangedSpells[0].porteeMax;
      if (distToTarget > bestRange) {
        const moveResult = await moveTowardsTarget(
          ctx.combatId, ctx.entiteId,
          { x: currentX, y: currentY },
          { x: target.positionX, y: target.positionY },
          currentPM,
          { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
          currentCombat.entites, ctx.blockedCases
        );
        if (moveResult) continue;
      }
    }

    break;
  }
}

// ===== HELPERS =====

/**
 * Refresh entity and combat state
 */
async function refreshState(ctx: AIContext) {
  const updatedEntity = await prisma.combatEntite.findUnique({
    where: { id: ctx.entiteId },
  });

  if (!updatedEntity || updatedEntity.pvActuels <= 0) {
    return null;
  }

  const currentCombat = await prisma.combat.findUnique({
    where: { id: ctx.combatId },
    include: {
      entites: true,
      effetsActifs: {
        include: { effet: true },
      },
    },
  });

  if (!currentCombat || currentCombat.status !== CombatStatus.EN_COURS) {
    return null;
  }

  const aliveEnemies = currentCombat.entites.filter(
    (e) => e.equipe !== ctx.entity.equipe && e.pvActuels > 0
  );
  if (aliveEnemies.length === 0) return null;

  const aliveAllies = currentCombat.entites.filter(
    (e) => e.equipe === ctx.entity.equipe && e.pvActuels > 0
  );

  return { updatedEntity, aliveEnemies, aliveAllies, currentCombat };
}

/**
 * Find the most injured ally (below threshold % of max HP)
 */
function findMostInjuredAlly(allies: EntityState[], threshold: number): EntityState | null {
  let mostInjured: EntityState | null = null;
  let lowestRatio = threshold;

  for (const ally of allies) {
    const ratio = ally.pvActuels / ally.pvMax;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      mostInjured = ally;
    }
  }

  return mostInjured;
}

/**
 * Find an ally that has active debuffs
 */
function findAllyWithDebuffs(
  allies: EntityState[],
  effetsActifs: Array<{ entiteId: number; effet: { type: string } }>
): EntityState | null {
  for (const ally of allies) {
    const hasDebuff = effetsActifs.some(
      (e) => e.entiteId === ally.id && e.effet.type === 'DEBUFF'
    );
    if (hasDebuff) return ally;
  }
  return null;
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
 * Find a spell that can be used on the target (priority order)
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
    if (spell.coutPA > availablePA) continue;
    if (distance < spell.porteeMin || distance > spell.porteeMax) continue;

    const cooldownCheck = await spellService.canUseSpell(combatId, entiteId, spell.id);
    if (!cooldownCheck.canUse) continue;

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
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const possibleMoves: Position[] = [];

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) possibleMoves.push({ x: from.x + 1, y: from.y });
    else if (dx < 0) possibleMoves.push({ x: from.x - 1, y: from.y });
    if (dy > 0) possibleMoves.push({ x: from.x, y: from.y + 1 });
    else if (dy < 0) possibleMoves.push({ x: from.x, y: from.y - 1 });
  } else {
    if (dy > 0) possibleMoves.push({ x: from.x, y: from.y + 1 });
    else if (dy < 0) possibleMoves.push({ x: from.x, y: from.y - 1 });
    if (dx > 0) possibleMoves.push({ x: from.x + 1, y: from.y });
    else if (dx < 0) possibleMoves.push({ x: from.x - 1, y: from.y });
  }

  for (const move of possibleMoves) {
    const moveCheck = canMove(from, move, availablePM, grid, entities, blockedCases);
    if (moveCheck.valid) {
      const result = await moveEntity(combatId, entiteId, move.x, move.y);
      return result.success;
    }
  }

  return false;
}

/**
 * Move one step away from the target (reverse of moveTowardsTarget)
 */
async function moveAwayFromTarget(
  combatId: number,
  entiteId: number,
  from: Position,
  to: Position,
  availablePM: number,
  grid: { width: number; height: number },
  entities: EntityState[],
  blockedCases: CombatCaseState[]
): Promise<boolean> {
  // Reverse the direction
  const dx = from.x - to.x;
  const dy = from.y - to.y;

  const possibleMoves: Position[] = [];

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) possibleMoves.push({ x: from.x + 1, y: from.y });
    else if (dx < 0) possibleMoves.push({ x: from.x - 1, y: from.y });
    else {
      // Same X, try both horizontal directions
      possibleMoves.push({ x: from.x + 1, y: from.y });
      possibleMoves.push({ x: from.x - 1, y: from.y });
    }
    if (dy > 0) possibleMoves.push({ x: from.x, y: from.y + 1 });
    else if (dy < 0) possibleMoves.push({ x: from.x, y: from.y - 1 });
  } else {
    if (dy > 0) possibleMoves.push({ x: from.x, y: from.y + 1 });
    else if (dy < 0) possibleMoves.push({ x: from.x, y: from.y - 1 });
    if (dx > 0) possibleMoves.push({ x: from.x + 1, y: from.y });
    else if (dx < 0) possibleMoves.push({ x: from.x - 1, y: from.y });
  }

  for (const move of possibleMoves) {
    const moveCheck = canMove(from, move, availablePM, grid, entities, blockedCases);
    if (moveCheck.valid) {
      const result = await moveEntity(combatId, entiteId, move.x, move.y);
      return result.success;
    }
  }

  return false;
}
