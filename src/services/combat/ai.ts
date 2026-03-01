import prisma from '../../config/database';
import { CombatStatus, IAType, ZoneType } from '@prisma/client';
import { Position, CombatCaseState } from '../../types';
import { manhattanDistance } from '../../utils/formulas';
import { hasLineOfSight, canMove } from './movement';
import { executeAction, moveEntity, endTurn } from './engine';
import { spellService } from '../spell.service';
import { addLog } from './combatLog';
import { getAffectedCells, getEntitiesInArea } from './aoe';

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
  ligneDirecte: boolean;
  degatsMin: number;
  degatsMax: number;
  cooldown: number;
  estSoin: boolean;
  tauxEchec: number;
  hasDispelEffect?: boolean;
  zoneType?: ZoneType | null;
  zoneTaille?: number | null;
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

  // Get spells for this monster, ordered by priority (include zone + effects for AoE + DISPEL detection)
  let monsterSpells: SpellInfo[];
  if (entity.monstreTemplateId) {
    const monstreSorts = await prisma.monstreSort.findMany({
      where: { monstreId: entity.monstreTemplateId },
      include: { sort: { include: { zone: true, effets: { include: { effet: true } } } } },
      orderBy: { priorite: 'asc' },
    });
    monsterSpells = monstreSorts.map((ms) => ({
      ...ms.sort,
      hasDispelEffect: ms.sort.effets.some((se) => se.effet.type === 'DISPEL'),
      zoneType: ms.sort.zone?.type ?? null,
      zoneTaille: ms.sort.zone?.taille ?? null,
      ligneDirecte: ms.sort.ligneDirecte,
    }));
  } else {
    // Fallback: generic spells with raceId = null
    const spells = await prisma.sort.findMany({
      where: { raceId: null },
      include: { zone: true, effets: { include: { effet: true } } },
    });
    monsterSpells = spells.map((s) => ({
      ...s,
      hasDispelEffect: s.effets.some((se) => se.effet.type === 'DISPEL'),
      zoneType: s.zone?.type ?? null,
      zoneTaille: s.zone?.taille ?? null,
      ligneDirecte: s.ligneDirecte,
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

// ===== EQUILIBRE (default) =====
// Heal → Dispel → Attack any reachable enemy → Move to position

async function executeEquilibreTurn(ctx: AIContext): Promise<void> {
  // Dynamic limit: PA + PM + buffer. Covers heavily buffed entities.
  let maxIterations = 20;
  let moveFirstEvaluated = false;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, aliveAllies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;
    const grid = { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur };

    // Hard stop: no PA left and no PM left
    if (currentPA <= 0 && currentPM <= 0) break;

    // 0. Move-first evaluation (8): if repositioning improves attack score, do it once
    if (!moveFirstEvaluated && currentPM > 0 && currentPA > 0 && ctx.damageSpells.length > 0) {
      moveFirstEvaluated = true;
      const optimalStep = evaluateMoveFirstBenefit(
        { x: currentX, y: currentY }, currentPM, currentPA,
        ctx.damageSpells, aliveEnemies, currentCombat.entites,
        grid, ctx.blockedCases
      );
      if (optimalStep) {
        await moveEntity(ctx.combatId, ctx.entiteId, optimalStep.x, optimalStep.y);
        continue;
      }
    }

    // A. Auto-preservation: if self HP < 30%, heal self first
    const selfRatio = updatedEntity.pvActuels / updatedEntity.pvMax;
    if (selfRatio < 0.3 && ctx.healSpells.length > 0) {
      const selfHeal = await findUsableSpell(
        ctx.combatId, ctx.entiteId, ctx.healSpells,
        { x: currentX, y: currentY },
        { x: currentX, y: currentY },
        currentPA, currentCombat.entites, ctx.blockedCases
      );
      if (selfHeal) {
        await executeAction(ctx.combatId, ctx.entiteId, selfHeal.id, currentX, currentY);
        continue;
      }
    }

    // 1. Heal injured ally (<70% HP) — AoE-aware (E)
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
          const healTarget = findBestHealTarget(
            healSpell, { x: currentX, y: currentY }, aliveAllies,
            currentCombat.entites, grid, ctx.blockedCases
          );
          const htX = healTarget?.targetX ?? injuredAlly.positionX;
          const htY = healTarget?.targetY ?? injuredAlly.positionY;
          await executeAction(ctx.combatId, ctx.entiteId, healSpell.id, htX, htY);
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

    // 3. Attack best available enemy — AoE-scored (5 + C)
    if (currentPA > 0 && canAffordAnySpell(ctx.damageSpells, currentPA)) {
      const attacked = await tryAttackBestAvailableEnemy(
        ctx, ctx.damageSpells, updatedEntity, aliveEnemies,
        currentCombat.entites, currentPA, grid
      );
      if (attacked) continue;
    }

    // 4. Move to optimal range, or reposition if LOS is blocked
    if (currentPM > 0) {
      const target = findBestTarget(updatedEntity, aliveEnemies);
      if (!target) break;

      const optRange = getOptimalRange(ctx.damageSpells);
      const moved = await moveToPositionOrReposition(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        grid,
        currentCombat.entites, ctx.blockedCases,
        optRange
      );
      if (moved) continue;
    }

    break;
  }
}

// ===== AGGRESSIF =====
// Rush to attack, never heal/dispel, spend all PM to close distance

async function executeAggressifTurn(ctx: AIContext): Promise<void> {
  let maxIterations = 20;
  let moveFirstEvaluated = false;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;
    const grid = { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur };

    if (currentPA <= 0 && currentPM <= 0) break;

    const target = findClosestEnemy(updatedEntity, aliveEnemies);
    if (!target) break;

    // 0. Move-first evaluation (8): reposition before attacking if beneficial
    if (!moveFirstEvaluated && currentPM > 0 && currentPA > 0 && ctx.damageSpells.length > 0) {
      moveFirstEvaluated = true;
      const optimalStep = evaluateMoveFirstBenefit(
        { x: currentX, y: currentY }, currentPM, currentPA,
        ctx.damageSpells, aliveEnemies, currentCombat.entites,
        grid, ctx.blockedCases
      );
      if (optimalStep) {
        await moveEntity(ctx.combatId, ctx.entiteId, optimalStep.x, optimalStep.y);
        continue;
      }
    }

    // 1. Try to attack any enemy (aggressif always targets closest, tries others if needed)
    if (currentPA > 0 && canAffordAnySpell(ctx.damageSpells, currentPA)) {
      // For aggressif: closest first, then others
      const attacked = await tryAttackClosestFirst(
        ctx, ctx.damageSpells, updatedEntity, aliveEnemies,
        currentCombat.entites, currentPA
      );
      if (attacked) continue;
    }

    // 2. Move closer (spend all PM rushing towards closest enemy)
    if (currentPM > 0) {
      const moveResult = await moveTowardsTarget(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        grid,
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
  let maxIterations = 20;
  let moveFirstEvaluated = false;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, aliveAllies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;
    const grid = { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur };

    if (currentPA <= 0 && currentPM <= 0) break;

    // 0. Move-first evaluation (8): reposition before attacking if beneficial
    if (!moveFirstEvaluated && currentPM > 0 && currentPA > 0 && ctx.damageSpells.length > 0) {
      moveFirstEvaluated = true;
      const optimalStep = evaluateMoveFirstBenefit(
        { x: currentX, y: currentY }, currentPM, currentPA,
        ctx.damageSpells, aliveEnemies, currentCombat.entites,
        grid, ctx.blockedCases
      );
      if (optimalStep) {
        await moveEntity(ctx.combatId, ctx.entiteId, optimalStep.x, optimalStep.y);
        continue;
      }
    }

    // A. Auto-preservation: if self HP < 30%, heal self first
    const selfRatio = updatedEntity.pvActuels / updatedEntity.pvMax;
    if (selfRatio < 0.3 && ctx.healSpells.length > 0) {
      const selfHeal = await findUsableSpell(
        ctx.combatId, ctx.entiteId, ctx.healSpells,
        { x: currentX, y: currentY },
        { x: currentX, y: currentY },
        currentPA, currentCombat.entites, ctx.blockedCases
      );
      if (selfHeal) {
        await executeAction(ctx.combatId, ctx.entiteId, selfHeal.id, currentX, currentY);
        continue;
      }
    }

    // 1. Heal injured ally (more aggressive threshold: 90%) — AoE-aware (E)
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
          const healTarget = findBestHealTarget(
            healSpell, { x: currentX, y: currentY }, aliveAllies,
            currentCombat.entites, grid, ctx.blockedCases
          );
          const htX = healTarget?.targetX ?? injuredAlly.positionX;
          const htY = healTarget?.targetY ?? injuredAlly.positionY;
          await executeAction(ctx.combatId, ctx.entiteId, healSpell.id, htX, htY);
          continue;
        }

        // Ally injured but out of range → move towards them
        if (currentPM > 0) {
          const moveResult = await moveTowardsTarget(
            ctx.combatId, ctx.entiteId,
            { x: currentX, y: currentY },
            { x: injuredAlly.positionX, y: injuredAlly.positionY },
            currentPM,
            grid,
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

    // 3. Attack as last resort — AoE-scored (5 + C)
    if (currentPA > 0 && canAffordAnySpell(ctx.damageSpells, currentPA)) {
      const attacked = await tryAttackBestAvailableEnemy(
        ctx, ctx.damageSpells, updatedEntity, aliveEnemies,
        currentCombat.entites, currentPA, grid
      );
      if (attacked) continue;
    }

    // 4. Move to optimal attack range (or reposition for LOS)
    if (currentPM > 0) {
      const target = findBestTarget(updatedEntity, aliveEnemies);
      if (target) {
        const optRange = getOptimalRange(ctx.damageSpells);
        const moved = await moveToPositionOrReposition(
          ctx.combatId, ctx.entiteId,
          { x: currentX, y: currentY },
          { x: target.positionX, y: target.positionY },
          currentPM,
          grid,
          currentCombat.entites, ctx.blockedCases,
          optRange
        );
        if (moved) continue;
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

  let maxIterations = 20;
  let moveFirstEvaluated = false;

  while (maxIterations > 0) {
    maxIterations--;

    const state = await refreshState(ctx);
    if (!state) break;
    const { updatedEntity, aliveEnemies, currentCombat } = state;

    const currentPA = updatedEntity.paActuels;
    const currentPM = updatedEntity.pmActuels;
    const currentX = updatedEntity.positionX;
    const currentY = updatedEntity.positionY;
    const grid = { width: currentCombat.grilleLargeur, height: currentCombat.grilleHauteur };

    if (currentPA <= 0 && currentPM <= 0) break;

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
        grid,
        currentCombat.entites, ctx.blockedCases
      );
      if (retreated) continue;
    }

    // 0. Move-first evaluation (8): only when not under immediate threat
    if (!moveFirstEvaluated && distToClosest > 1 && currentPM > 0 && currentPA > 0 && rangedSpells.length > 0) {
      moveFirstEvaluated = true;
      const optimalStep = evaluateMoveFirstBenefit(
        { x: currentX, y: currentY }, currentPM, currentPA,
        rangedSpells, aliveEnemies, currentCombat.entites,
        grid, ctx.blockedCases
      );
      if (optimalStep) {
        await moveEntity(ctx.combatId, ctx.entiteId, optimalStep.x, optimalStep.y);
        continue;
      }
    }

    // 2. Try ranged attack — AoE-scored (5 + C)
    if (currentPA > 0 && canAffordAnySpell(rangedSpells, currentPA)) {
      const attacked = await tryAttackBestAvailableEnemy(
        ctx, rangedSpells, updatedEntity, aliveEnemies,
        currentCombat.entites, currentPA, grid
      );
      if (attacked) continue;
    }

    // 3. Move to optimal range (stop when already in range, back away if too close)
    if (currentPM > 0 && rangedSpells.length > 0) {
      const optRange = getOptimalRange(rangedSpells);
      // DISTANCE: use pure optimal range movement (don't reposition via moveTowards, would rush in)
      const moveResult = await moveToOptimalRange(
        ctx.combatId, ctx.entiteId,
        { x: currentX, y: currentY },
        { x: target.positionX, y: target.positionY },
        currentPM,
        grid,
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
 * Check if any spell can be afforded with available PA
 */
function canAffordAnySpell(spells: SpellInfo[], availablePA: number): boolean {
  return spells.some((s) => s.coutPA <= availablePA);
}

/**
 * Returns all valid targeting cells for a spell cast from casterPos.
 * Filters by range, LOS, and ligneDirecte constraint.
 */
function getSpellCandidateCells(
  spell: SpellInfo,
  casterPos: Position,
  grid: { width: number; height: number },
  allEntities: EntityState[],
  blockedCases: CombatCaseState[]
): Position[] {
  const candidates: Position[] = [];
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const dist = manhattanDistance(casterPos.x, casterPos.y, x, y);
      if (dist < spell.porteeMin || dist > spell.porteeMax) continue;
      if (spell.ligneDirecte && x !== casterPos.x && y !== casterPos.y) continue;
      if (spell.ligneDeVue && !hasLineOfSight(casterPos, { x, y }, allEntities, blockedCases)) continue;
      candidates.push({ x, y });
    }
  }
  return candidates;
}

/**
 * For an AoE damage spell, find the target cell that maximizes enemies hit.
 * Falls back to single-target behaviour for CASE/no-zone spells.
 * Returns null if no enemies can be hit.
 */
function findBestAoETarget(
  spell: SpellInfo,
  casterPos: Position,
  enemies: EntityState[],
  allEntities: EntityState[],
  grid: { width: number; height: number },
  blockedCases: CombatCaseState[]
): { targetX: number; targetY: number; hitCount: number } | null {
  // Single-cell spells: find first enemy in range (priority order, not AoE scan needed)
  if (!spell.zoneType || spell.zoneType === ZoneType.CASE) {
    for (const enemy of enemies) {
      const dist = manhattanDistance(casterPos.x, casterPos.y, enemy.positionX, enemy.positionY);
      if (dist < spell.porteeMin || dist > spell.porteeMax) continue;
      if (spell.ligneDirecte && enemy.positionX !== casterPos.x && enemy.positionY !== casterPos.y) continue;
      if (spell.ligneDeVue && !hasLineOfSight(casterPos, { x: enemy.positionX, y: enemy.positionY }, allEntities, blockedCases)) continue;
      return { targetX: enemy.positionX, targetY: enemy.positionY, hitCount: 1 };
    }
    return null;
  }

  // AoE spell: scan all candidate cells and pick the one with most enemy hits
  const candidates = getSpellCandidateCells(spell, casterPos, grid, allEntities, blockedCases);
  let best: { targetX: number; targetY: number; hitCount: number } | null = null;

  for (const candidate of candidates) {
    const affectedCells = getAffectedCells(
      candidate,
      { type: spell.zoneType, taille: spell.zoneTaille ?? 1 },
      grid,
      casterPos
    );
    const hitCount = getEntitiesInArea(affectedCells, enemies).length;
    if (hitCount > 0 && (!best || hitCount > best.hitCount)) {
      best = { targetX: candidate.x, targetY: candidate.y, hitCount };
    }
  }

  return best;
}

/**
 * For an AoE heal spell, find the target cell that maximizes injured allies healed.
 * Returns null if no injured allies are in range.
 */
function findBestHealTarget(
  spell: SpellInfo,
  casterPos: Position,
  allies: EntityState[],
  allEntities: EntityState[],
  grid: { width: number; height: number },
  blockedCases: CombatCaseState[]
): { targetX: number; targetY: number } | null {
  const injuredAllies = allies.filter((a) => a.pvActuels < a.pvMax);
  if (injuredAllies.length === 0) return null;

  // Single-cell heal: return the most injured ally in range
  if (!spell.zoneType || spell.zoneType === ZoneType.CASE) {
    const sorted = [...injuredAllies].sort((a, b) => (a.pvActuels / a.pvMax) - (b.pvActuels / b.pvMax));
    for (const ally of sorted) {
      const dist = manhattanDistance(casterPos.x, casterPos.y, ally.positionX, ally.positionY);
      if (dist < spell.porteeMin || dist > spell.porteeMax) continue;
      if (spell.ligneDeVue && !hasLineOfSight(casterPos, { x: ally.positionX, y: ally.positionY }, allEntities, blockedCases)) continue;
      return { targetX: ally.positionX, targetY: ally.positionY };
    }
    return null;
  }

  // AoE heal: find candidate cell covering the most injured allies
  const candidates = getSpellCandidateCells(spell, casterPos, grid, allEntities, blockedCases);
  let best: { targetX: number; targetY: number; hitCount: number } | null = null;

  for (const candidate of candidates) {
    const affectedCells = getAffectedCells(
      candidate,
      { type: spell.zoneType, taille: spell.zoneTaille ?? 1 },
      grid,
      casterPos
    );
    const hitCount = getEntitiesInArea(affectedCells, injuredAllies).length;
    if (hitCount > 0 && (!best || hitCount > best.hitCount)) {
      best = { targetX: candidate.x, targetY: candidate.y, hitCount };
    }
  }

  return best ? { targetX: best.targetX, targetY: best.targetY } : null;
}

/**
 * BFS flood fill: returns all cells reachable within maxPM moves from `from`.
 */
function findReachableCells(
  from: Position,
  maxPM: number,
  grid: { width: number; height: number },
  entities: EntityState[],
  blockedCases: CombatCaseState[]
): Position[] {
  const reachable: Position[] = [];
  const queue: Array<{ pos: Position; cost: number }> = [{ pos: from, cost: 0 }];
  const visited = new Set<string>([`${from.x},${from.y}`]);
  const directions = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of directions) {
      const next: Position = { x: current.pos.x + dir.dx, y: current.pos.y + dir.dy };
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) continue;
      const moveCheck = canMove(current.pos, next, 1, grid, entities, blockedCases);
      if (!moveCheck.valid) continue;
      const newCost = current.cost + 1;
      if (newCost > maxPM) continue;
      visited.add(key);
      reachable.push(next);
      queue.push({ pos: next, cost: newCost });
    }
  }

  return reachable;
}

/**
 * Evaluate the best attack score achievable from a given position.
 * Pure compute (no DB): cooldowns are ignored — used only for comparison.
 */
function evaluateBestAttackFromPos(
  pos: Position,
  damageSpells: SpellInfo[],
  enemies: EntityState[],
  allEntities: EntityState[],
  grid: { width: number; height: number },
  blockedCases: CombatCaseState[]
): { score: number; spellId: number; targetX: number; targetY: number } | null {
  let best: { score: number; spellId: number; targetX: number; targetY: number } | null = null;
  for (const spell of damageSpells) {
    const aoeTarget = findBestAoETarget(spell, pos, enemies, allEntities, grid, blockedCases);
    if (!aoeTarget) continue;
    const avgDmg = (spell.degatsMin + spell.degatsMax) / 2;
    const score = aoeTarget.hitCount * avgDmg;
    if (!best || score > best.score) {
      best = { score, spellId: spell.id, targetX: aoeTarget.targetX, targetY: aoeTarget.targetY };
    }
  }
  return best;
}

/**
 * Determines if moving first would improve the attack score.
 * Returns the first BFS step towards the better position, or null if no improvement found.
 */
function evaluateMoveFirstBenefit(
  currentPos: Position,
  availablePM: number,
  availablePA: number,
  damageSpells: SpellInfo[],
  enemies: EntityState[],
  allEntities: EntityState[],
  grid: { width: number; height: number },
  blockedCases: CombatCaseState[]
): Position | null {
  if (damageSpells.length === 0 || availablePM === 0) return null;

  const currentResult = evaluateBestAttackFromPos(currentPos, damageSpells, enemies, allEntities, grid, blockedCases);
  const currentScore = currentResult?.score ?? 0;

  const reachable = findReachableCells(currentPos, availablePM, grid, allEntities, blockedCases);

  let bestScore = currentScore;
  let bestCell: Position | null = null;

  for (const cell of reachable) {
    const result = evaluateBestAttackFromPos(cell, damageSpells, enemies, allEntities, grid, blockedCases);
    if (result && result.score > bestScore) {
      bestScore = result.score;
      bestCell = cell;
    }
  }

  if (!bestCell) return null;

  // Return the first BFS step towards bestCell
  const searchDepth = grid.width + grid.height;
  return bfsFirstStep(currentPos, bestCell, searchDepth, grid, allEntities, blockedCases);
}

/**
 * Try to attack the best available enemy, scoring by AoE hit count × avg damage × cast count.
 * Higher score = better spell (hits more targets, more damage, more casts possible).
 * Cooldowns are checked only at execution time (not during scoring simulation).
 */
async function tryAttackBestAvailableEnemy(
  ctx: AIContext,
  spells: SpellInfo[],
  entity: { positionX: number; positionY: number; pvActuels: number; pvMax: number },
  enemies: EntityState[],
  allEntities: EntityState[],
  availablePA: number,
  grid: { width: number; height: number }
): Promise<boolean> {
  if (spells.length === 0 || enemies.length === 0 || availablePA <= 0) return false;

  const casterPos = { x: entity.positionX, y: entity.positionY };

  // Score each affordable spell: hitCount × avgDmg × castCount
  type ScoredSpell = { spell: SpellInfo; score: number; targetX: number; targetY: number };
  const scored: ScoredSpell[] = [];

  for (const spell of spells) {
    if (spell.coutPA > availablePA) continue;
    const aoeTarget = findBestAoETarget(spell, casterPos, enemies, allEntities, grid, ctx.blockedCases);
    if (!aoeTarget) continue;
    const castCount = Math.floor(availablePA / spell.coutPA);
    const avgDmg = (spell.degatsMin + spell.degatsMax) / 2;
    const score = aoeTarget.hitCount * avgDmg * castCount;
    scored.push({ spell, score, targetX: aoeTarget.targetX, targetY: aoeTarget.targetY });
  }

  // Sort by score descending, cast the best available (with cooldown check)
  scored.sort((a, b) => b.score - a.score);

  for (const { spell, targetX, targetY } of scored) {
    const cooldownCheck = await spellService.canUseSpell(ctx.combatId, ctx.entiteId, spell.id);
    if (!cooldownCheck.canUse) continue;
    await executeAction(ctx.combatId, ctx.entiteId, spell.id, targetX, targetY);
    return true;
  }

  return false;
}

/**
 * Try to attack — closest enemy first (for AGGRESSIF strategy).
 */
async function tryAttackClosestFirst(
  ctx: AIContext,
  spells: SpellInfo[],
  entity: EntityState,
  enemies: EntityState[],
  allEntities: EntityState[],
  availablePA: number
): Promise<boolean> {
  if (spells.length === 0 || enemies.length === 0 || availablePA <= 0) return false;

  const sorted = [...enemies].sort((a, b) =>
    manhattanDistance(entity.positionX, entity.positionY, a.positionX, a.positionY) -
    manhattanDistance(entity.positionX, entity.positionY, b.positionX, b.positionY)
  );

  for (const target of sorted) {
    const spell = await findUsableSpell(
      ctx.combatId, ctx.entiteId, spells,
      { x: entity.positionX, y: entity.positionY },
      { x: target.positionX, y: target.positionY },
      availablePA, allEntities, ctx.blockedCases
    );
    if (spell) {
      await executeAction(ctx.combatId, ctx.entiteId, spell.id, target.positionX, target.positionY);
      return true;
    }
  }
  return false;
}

/**
 * Move to optimal attack range.
 * If already in range → try to stay (return false = no move needed).
 * If too close → back away.
 * If too far → approach.
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

  if (currentDist >= optRange.min && currentDist <= optRange.max) {
    return false; // Already in optimal range
  }

  if (currentDist < optRange.min) {
    return moveAwayFromTarget(combatId, entiteId, from, target, availablePM, grid, entities, blockedCases);
  }

  // Too far → move directly towards the target. The loop re-checks range each iteration
  // so the entity stops naturally once within porteeMax, without needing a virtual target.
  return moveTowardsTarget(combatId, entiteId, from, target, availablePM, grid, entities, blockedCases);
}

/**
 * Move to optimal range, OR reposition to break LOS block if already in range.
 * Used by EQUILIBRE and SOUTIEN: if in range but can't attack (LOS blocked),
 * try moving closer to get around the obstacle.
 */
async function moveToPositionOrReposition(
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

  // Too close → back away (optimal range logic)
  if (currentDist < optRange.min) {
    return moveAwayFromTarget(combatId, entiteId, from, target, availablePM, grid, entities, blockedCases);
  }

  // Too far → approach directly. The loop re-checks range each iteration so the
  // entity stops once within porteeMax, without needing a virtual target.
  if (currentDist > optRange.max) {
    return moveTowardsTarget(combatId, entiteId, from, target, availablePM, grid, entities, blockedCases);
  }

  // Already in range by distance but couldn't attack → try repositioning towards target
  // to potentially break a LOS block or reach a better angle
  return moveTowardsTarget(combatId, entiteId, from, target, availablePM, grid, entities, blockedCases);
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
  // Fisher-Yates shuffle to remove horizontal bias
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }

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

  // BFS to find the path that gets closest to the target.
  // bestDistance starts at currentDist + 1 so that lateral moves (same distance)
  // are accepted as valid first steps — needed to navigate around obstacles.
  let bestFirstStep: Position | null = null;
  let bestDistance = manhattanDistance(from.x, from.y, to.x, to.y) + 1;

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
  // Use full grid size as BFS search depth so detours longer than available PM
  // are still found. The entity only moves 1 step regardless of search depth.
  const searchDepth = grid.width + grid.height;
  const firstStep = bfsFirstStep(from, to, searchDepth, grid, entities, blockedCases);
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
