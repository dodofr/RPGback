import prisma from '../../config/database';
import { CombatStatus, IAType } from '@prisma/client';
import { Position, CombatCaseState } from '../../types';
import { manhattanDistance } from '../../utils/formulas';
import { hasLineOfSight, canMove } from './movement';
import { executeAction, moveEntity, endTurn } from './engine';
import { spellService } from '../spell.service';
import { addLog } from './combatLog';

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
  tauxEchec: number;
  hasDispelEffect?: boolean;
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

  // Get spells for this monster, ordered by priority (include effects for DISPEL detection)
  let monsterSpells: SpellInfo[];
  if (entity.monstreTemplateId) {
    const monstreSorts = await prisma.monstreSort.findMany({
      where: { monstreId: entity.monstreTemplateId },
      include: { sort: { include: { effets: { include: { effet: true } } } } },
      orderBy: { priorite: 'asc' },
    });
    monsterSpells = monstreSorts.map((ms) => ({
      ...ms.sort,
      hasDispelEffect: ms.sort.effets.some((se) => se.effet.type === 'DISPEL'),
    }));
  } else {
    // Fallback: generic spells with raceId = null
    const spells = await prisma.sort.findMany({
      where: { raceId: null },
      include: { effets: { include: { effet: true } } },
    });
    monsterSpells = spells.map((s) => ({
      ...s,
      hasDispelEffect: s.effets.some((se) => se.effet.type === 'DISPEL'),
    }));
  }

  // Separate spells by category
  const healSpells = monsterSpells.filter((s) => s.estSoin);
  const dispelSpells = monsterSpells.filter((s) => s.hasDispelEffect);
  const damageSpells = monsterSpells.filter((s) => !s.estSoin && !s.hasDispelEffect);

  const ctx: AIContext = {
    combatId,
    entiteId,
    entity,
    blockedCases,
    healSpells,
    dispelSpells,
    damageSpells,
  };

  // Record PM before AI turn for consolidated movement log
  const pmBefore = entity.pmActuels;

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

  // Log consolidated movement if PM was used
  const updatedAfter = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
  if (updatedAfter) {
    const totalPmUsed = pmBefore - updatedAfter.pmActuels;
    if (totalPmUsed > 0) {
      const currentCombat = await prisma.combat.findUnique({ where: { id: combatId } });
      if (currentCombat) {
        await addLog(combatId, currentCombat.tourActuel, `${entity.nom} se déplace (${totalPmUsed} PM)`, 'DEPLACEMENT');
      }
    }
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

    // 3. Attack best target (weakest first)
    const target = findBestTarget(updatedEntity, aliveEnemies);
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

    // 4. Move to optimal range (stop when already in range)
    if (currentPM > 0) {
      const optRange = getOptimalRange(ctx.damageSpells);
      const moveResult = await moveToOptimalRange(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
        currentCombat.entites, ctx.blockedCases,
        optRange
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

    // 3. Attack as last resort (weakest target first)
    const target = findBestTarget(updatedEntity, aliveEnemies);
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

      // Move to optimal range if can't attack yet
      if (currentPM > 0) {
        const optRange = getOptimalRange(ctx.damageSpells);
        const moveResult = await moveToOptimalRange(
          ctx.combatId, ctx.entiteId,
          { x: currentX, y: currentY },
          { x: target.positionX, y: target.positionY },
          currentPM,
          { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
          currentCombat.entites, ctx.blockedCases,
          optRange
        );
        if (moveResult) continue;
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

    // Closest enemy for retreat decision, best target (weakest) for attack
    const closestEnemy = findClosestEnemy(updatedEntity, aliveEnemies);
    if (!closestEnemy) break;
    const target = findBestTarget(updatedEntity, aliveEnemies) ?? closestEnemy;

    const distToClosest = manhattanDistance(currentX, currentY, closestEnemy.positionX, closestEnemy.positionY);

    // 1. If closest enemy is adjacent (dist <= 1), retreat first
    if (distToClosest <= 1 && currentPM > 0) {
      const retreated = await moveAwayFromTarget(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: closestEnemy.positionX, y: closestEnemy.positionY },
        currentPM,
        { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
        currentCombat.entites, ctx.blockedCases
      );
      if (retreated) continue;
    }

    // 2. Try ranged attack on best target (sorted by longest range first)
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

    // 3. Move to optimal range (stop when already in range, back away if too close)
    if (currentPM > 0 && rangedSpells.length > 0) {
      const optRange = getOptimalRange(rangedSpells);
      const moveResult = await moveToOptimalRange(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur },
        currentCombat.entites, ctx.blockedCases,
        optRange
      );
      if (moveResult) continue;
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
 * Find the best target: weakest HP ratio first, distance as tiebreak (if ratio diff < 20%)
 */
function findBestTarget(entity: EntityState, enemies: EntityState[]): EntityState | null {
  if (enemies.length === 0) return null;
  return [...enemies].sort((a, b) => {
    const ratioA = a.pvActuels / a.pvMax;
    const ratioB = b.pvActuels / b.pvMax;
    if (Math.abs(ratioA - ratioB) > 0.2) return ratioA - ratioB;
    const distA = manhattanDistance(entity.positionX, entity.positionY, a.positionX, a.positionY);
    const distB = manhattanDistance(entity.positionX, entity.positionY, b.positionX, b.positionY);
    return distA - distB;
  })[0];
}

/**
 * Get optimal range from damage spells (based on highest-priority spell)
 */
function getOptimalRange(damageSorts: SpellInfo[]): { min: number; max: number } {
  if (damageSorts.length === 0) return { min: 1, max: 1 };
  const best = damageSorts[0]; // sorted by priorité ASC
  return { min: best.porteeMin, max: best.porteeMax };
}

/**
 * Find a virtual target position at `distance` cases from `target` in the direction of `from`
 */
function findVirtualTarget(from: Position, target: Position, distance: number): Position {
  const dx = from.x - target.x;
  const dy = from.y - target.y;
  if (dx === 0 && dy === 0) return { x: target.x, y: target.y + distance };
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: target.x + Math.sign(dx) * distance, y: target.y };
  }
  return { x: target.x, y: target.y + Math.sign(dy) * distance };
}

/**
 * Move to optimal attack range:
 * - Already in [optMin, optMax] → don't move (return false)
 * - Too close → back away
 * - Too far → approach virtual position at porteeMax from target
 */
async function moveToOptimalRange(
  combatId: number,
  entiteId: number,
  from: Position,
  target: Position,
  availablePM: number,
  grid: { width: number; height: number },
  entities: EntityState[],
  blockedCases: CombatCaseState[],
  optRange: { min: number; max: number }
): Promise<boolean> {
  const currentDist = manhattanDistance(from.x, from.y, target.x, target.y);

  // Already in optimal range → don't move
  if (currentDist >= optRange.min && currentDist <= optRange.max) {
    return false;
  }

  // Too close → back away
  if (currentDist < optRange.min) {
    return moveAwayFromTarget(combatId, entiteId, from, target, availablePM, grid, entities, blockedCases);
  }

  // Too far → move towards virtual position at porteeMax from target
  const virtualTarget = findVirtualTarget(from, target, optRange.max);
  return moveTowardsTarget(combatId, entiteId, from, virtualTarget, availablePM, grid, entities, blockedCases);
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
 * BFS to find the best first step towards a target.
 * Returns the first cell to move to, or null if no path exists.
 */
function bfsFirstStep(
  from: Position,
  to: Position,
  maxSteps: number,
  grid: { width: number; height: number },
  entities: EntityState[],
  blockedCases: CombatCaseState[]
): Position | null {
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  // BFS queue: each entry is [current position, first step taken]
  const queue: Array<{ pos: Position; firstStep: Position; steps: number }> = [];
  const visited = new Set<string>();
  visited.add(`${from.x},${from.y}`);

  // Seed with all valid adjacent moves
  for (const dir of directions) {
    const next: Position = { x: from.x + dir.dx, y: from.y + dir.dy };
    const key = `${next.x},${next.y}`;
    if (visited.has(key)) continue;

    const moveCheck = canMove(from, next, 1, grid, entities, blockedCases);
    if (moveCheck.valid) {
      // Reached the target (or adjacent to it)
      if (next.x === to.x && next.y === to.y) return next;
      visited.add(key);
      queue.push({ pos: next, firstStep: next, steps: 1 });
    }
  }

  // BFS to find the path that gets closest to the target
  let bestFirstStep: Position | null = null;
  let bestDistance = manhattanDistance(from.x, from.y, to.x, to.y);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const dist = manhattanDistance(current.pos.x, current.pos.y, to.x, to.y);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestFirstStep = current.firstStep;
    }

    if (dist === 0) return current.firstStep; // Reached target

    if (current.steps >= maxSteps) continue;

    for (const dir of directions) {
      const next: Position = { x: current.pos.x + dir.dx, y: current.pos.y + dir.dy };
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) continue;

      const moveCheck = canMove(current.pos, next, 1, grid, entities, blockedCases);
      if (moveCheck.valid) {
        visited.add(key);
        queue.push({ pos: next, firstStep: current.firstStep, steps: current.steps + 1 });
      }
    }
  }

  return bestFirstStep;
}

/**
 * Move one step towards the target using BFS pathfinding
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
  const firstStep = bfsFirstStep(from, to, availablePM, grid, entities, blockedCases);
  if (!firstStep) return false;

  const result = await moveEntity(combatId, entiteId, firstStep.x, firstStep.y);
  return result.success;
}

/**
 * Move one step away from the target using BFS (maximize distance)
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
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const currentDist = manhattanDistance(from.x, from.y, to.x, to.y);
  let bestMove: Position | null = null;
  let bestDist = currentDist;

  for (const dir of directions) {
    const next: Position = { x: from.x + dir.dx, y: from.y + dir.dy };
    const moveCheck = canMove(from, next, availablePM, grid, entities, blockedCases);
    if (moveCheck.valid) {
      const dist = manhattanDistance(next.x, next.y, to.x, to.y);
      if (dist > bestDist) {
        bestDist = dist;
        bestMove = next;
      }
    }
  }

  if (!bestMove) return false;

  const result = await moveEntity(combatId, entiteId, bestMove.x, bestMove.y);
  return result.success;
}
