import { EffetType, StatType } from '@prisma/client';
import prisma from '../../config/database';
import { checkProbability, randomInt } from '../../utils/random';
import { CombatCaseState } from './grid';
import { isInBounds } from '../../utils/formulas';

export interface EffectDetails {
  id: number;
  nom: string;
  type: EffetType;
  statCiblee: StatType;
  valeur: number;
  toursRestants: number;
}

export interface PushPullResult {
  moved: boolean;
  distanceReelle: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface AppliedEffect {
  entiteId: number;
  effetId: number;
  effetNom: string;
  duree: number;
  isDispel?: boolean;
  removedCount?: number;
  isPushPull?: boolean;
  pushPullResult?: PushPullResult;
}

export interface ModifiedStats {
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  vie: number;
  chance: number;
}

/**
 * Get active effects for an entity with full effect details
 */
export async function getActiveEffectsForEntity(
  combatId: number,
  entiteId: number
): Promise<EffectDetails[]> {
  const activeEffects = await prisma.effetActif.findMany({
    where: {
      combatId,
      entiteId,
    },
    include: {
      effet: true,
    },
  });

  return activeEffects.map((ae) => ({
    id: ae.effet.id,
    nom: ae.effet.nom,
    type: ae.effet.type,
    statCiblee: ae.effet.statCiblee,
    valeur: ae.effet.valeur,
    toursRestants: ae.toursRestants,
  }));
}

/**
 * Calculate stats with active effects applied
 */
export async function getStatsWithEffects(
  combatId: number,
  entiteId: number,
  baseStats: ModifiedStats
): Promise<ModifiedStats> {
  const activeEffects = await getActiveEffectsForEntity(combatId, entiteId);

  // Start with base stats
  const modifiedStats: ModifiedStats = { ...baseStats };

  // Apply each active effect (skip non-stat effects — they don't modify stats)
  for (const effect of activeEffects) {
    if (effect.type === 'DISPEL' || effect.type === 'POUSSEE' || effect.type === 'ATTIRANCE' || effect.type === 'POISON') continue;
    const statKey = statTypeToKey(effect.statCiblee);
    if (!statKey || !(statKey in modifiedStats)) continue; // Skip PA/PM/PO — handled by getResourceModifiers
    if (statKey && statKey in modifiedStats) {
      modifiedStats[statKey] += effect.valeur;
      // Ensure stats don't go below 0
      if (modifiedStats[statKey] < 0) {
        modifiedStats[statKey] = 0;
      }
    }
  }

  return modifiedStats;
}

/**
 * Apply an effect to an entity
 */
export async function applyEffect(
  combatId: number,
  entiteId: number,
  effetId: number,
  lanceurId?: number
): Promise<void> {
  const effet = await prisma.effet.findUnique({
    where: { id: effetId },
  });

  if (!effet) {
    throw new Error(`Effect ${effetId} not found`);
  }

  // Check if effect already exists on this entity
  const existingEffect = await prisma.effetActif.findFirst({
    where: {
      combatId,
      entiteId,
      effetId,
    },
  });

  if (existingEffect) {
    // Refresh duration if effect already exists
    await prisma.effetActif.update({
      where: { id: existingEffect.id },
      data: { toursRestants: effet.duree, lanceurId: lanceurId ?? existingEffect.lanceurId },
    });
  } else {
    // Create new active effect
    await prisma.effetActif.create({
      data: {
        combatId,
        entiteId,
        effetId,
        toursRestants: effet.duree,
        lanceurId: lanceurId ?? null,
      },
    });
  }
}

/**
 * Push or pull an entity along a cardinal direction.
 * Returns the actual displacement result.
 */
export async function pushPullEntity(
  combatId: number,
  casterId: number,
  targetId: number,
  distance: number,
  type: 'POUSSEE' | 'ATTIRANCE',
  gridWidth: number,
  gridHeight: number,
  entities: { id: number; positionX: number; positionY: number; pvActuels: number }[],
  blockedCases: CombatCaseState[]
): Promise<PushPullResult> {
  const caster = entities.find(e => e.id === casterId);
  const target = entities.find(e => e.id === targetId);

  if (!caster || !target) {
    return { moved: false, distanceReelle: 0, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
  }

  const from = { x: target.positionX, y: target.positionY };

  // Calculate cardinal direction
  const dx = target.positionX - caster.positionX;
  const dy = target.positionY - caster.positionY;

  let dirX = 0;
  let dirY = 0;

  if (type === 'POUSSEE') {
    // Push: away from caster
    if (Math.abs(dx) >= Math.abs(dy)) {
      dirX = dx > 0 ? 1 : -1;
    } else {
      dirY = dy > 0 ? 1 : -1;
    }
  } else {
    // Pull: toward caster
    if (Math.abs(dx) >= Math.abs(dy)) {
      dirX = dx > 0 ? -1 : 1;
    } else {
      dirY = dy > 0 ? -1 : 1;
    }
  }

  // If caster and target are on the same cell (shouldn't happen), no movement
  if (dx === 0 && dy === 0) {
    return { moved: false, distanceReelle: 0, from, to: from };
  }

  // Build sets for quick lookup
  const blockedSet = new Set<string>();
  for (const c of blockedCases) {
    if (c.bloqueDeplacement) blockedSet.add(`${c.x},${c.y}`);
  }

  const occupiedSet = new Set<string>();
  for (const e of entities) {
    if (e.pvActuels > 0 && e.id !== targetId) {
      occupiedSet.add(`${e.positionX},${e.positionY}`);
    }
  }

  // Move step by step
  let currentX = target.positionX;
  let currentY = target.positionY;
  let moved = 0;

  for (let i = 0; i < distance; i++) {
    const nextX = currentX + dirX;
    const nextY = currentY + dirY;

    // Check bounds
    if (!isInBounds(nextX, nextY, gridWidth, gridHeight)) break;
    // Check obstacles
    if (blockedSet.has(`${nextX},${nextY}`)) break;
    // Check entities
    if (occupiedSet.has(`${nextX},${nextY}`)) break;

    currentX = nextX;
    currentY = nextY;
    moved++;
  }

  const to = { x: currentX, y: currentY };

  if (moved > 0) {
    // Update entity position in DB
    await prisma.combatEntite.update({
      where: { id: targetId },
      data: { positionX: currentX, positionY: currentY },
    });

    // Update in-memory position for subsequent push/pulls in same spell
    target.positionX = currentX;
    target.positionY = currentY;
  }

  return { moved: moved > 0, distanceReelle: moved, from, to };
}

/**
 * Apply spell effects after spell execution
 * Returns list of applied effects
 */
export async function applySpellEffects(
  combatId: number,
  sortId: number,
  casterId: number,
  targetIds: number[],
  gridContext?: {
    gridWidth: number;
    gridHeight: number;
    entities: { id: number; positionX: number; positionY: number; pvActuels: number }[];
    blockedCases: CombatCaseState[];
  }
): Promise<AppliedEffect[]> {
  // Get spell effects
  const sortEffets = await prisma.sortEffet.findMany({
    where: { sortId },
    include: { effet: true },
  });

  if (sortEffets.length === 0) {
    return [];
  }

  const appliedEffects: AppliedEffect[] = [];

  for (const sortEffet of sortEffets) {
    // Check trigger probability
    if (!checkProbability(sortEffet.chanceDeclenchement)) {
      continue;
    }

    // DISPEL effect: remove all active effects from target(s) instead of creating EffetActif
    if (sortEffet.effet.type === 'DISPEL') {
      if (sortEffet.surCible) {
        for (const targetId of targetIds) {
          const removedCount = await dispelEffects(combatId, targetId);
          appliedEffects.push({
            entiteId: targetId,
            effetId: sortEffet.effetId,
            effetNom: sortEffet.effet.nom,
            duree: 0,
            isDispel: true,
            removedCount,
          });
        }
      } else {
        const removedCount = await dispelEffects(combatId, casterId);
        appliedEffects.push({
          entiteId: casterId,
          effetId: sortEffet.effetId,
          effetNom: sortEffet.effet.nom,
          duree: 0,
          isDispel: true,
          removedCount,
        });
      }
      continue;
    }

    // POUSSEE/ATTIRANCE: instantaneous push/pull effect
    if (sortEffet.effet.type === 'POUSSEE' || sortEffet.effet.type === 'ATTIRANCE') {
      if (!gridContext) continue; // Need grid context for push/pull

      if (sortEffet.surCible) {
        for (const targetId of targetIds) {
          // Skip dead targets
          const targetEntity = gridContext.entities.find(e => e.id === targetId);
          if (!targetEntity || targetEntity.pvActuels <= 0) continue;

          const result = await pushPullEntity(
            combatId,
            casterId,
            targetId,
            sortEffet.effet.valeur,
            sortEffet.effet.type,
            gridContext.gridWidth,
            gridContext.gridHeight,
            gridContext.entities,
            gridContext.blockedCases
          );

          appliedEffects.push({
            entiteId: targetId,
            effetId: sortEffet.effetId,
            effetNom: sortEffet.effet.nom,
            duree: 0,
            isPushPull: true,
            pushPullResult: result,
          });
        }
      }
      continue;
    }

    if (sortEffet.surCible) {
      // Apply to all targets
      for (const targetId of targetIds) {
        await applyEffect(combatId, targetId, sortEffet.effetId, casterId);
        appliedEffects.push({
          entiteId: targetId,
          effetId: sortEffet.effetId,
          effetNom: sortEffet.effet.nom,
          duree: sortEffet.effet.duree,
        });
      }
    } else {
      // Apply to caster
      await applyEffect(combatId, casterId, sortEffet.effetId, casterId);
      appliedEffects.push({
        entiteId: casterId,
        effetId: sortEffet.effetId,
        effetNom: sortEffet.effet.nom,
        duree: sortEffet.effet.duree,
      });
    }
  }

  return appliedEffects;
}

/**
 * Remove all active effects from an entity (dispel)
 * Returns the number of effects removed
 */
export async function dispelEffects(combatId: number, entiteId: number): Promise<number> {
  const result = await prisma.effetActif.deleteMany({
    where: { combatId, entiteId },
  });
  return result.count;
}

/**
 * Get all active effects in a combat with full details
 */
export async function getAllActiveEffectsWithDetails(
  combatId: number
): Promise<Array<EffectDetails & { entiteId: number; activeEffectId: number }>> {
  const activeEffects = await prisma.effetActif.findMany({
    where: { combatId },
    include: { effet: true },
  });

  return activeEffects.map((ae) => ({
    activeEffectId: ae.id,
    entiteId: ae.entiteId,
    id: ae.effet.id,
    nom: ae.effet.nom,
    type: ae.effet.type,
    statCiblee: ae.effet.statCiblee,
    valeur: ae.effet.valeur,
    toursRestants: ae.toursRestants,
  }));
}

/**
 * Get resource modifiers (PA/PM/PO) from active effects
 */
export async function getResourceModifiers(
  combatId: number,
  entiteId: number
): Promise<{ paModifier: number; pmModifier: number; poModifier: number }> {
  const activeEffects = await getActiveEffectsForEntity(combatId, entiteId);

  let paModifier = 0;
  let pmModifier = 0;
  let poModifier = 0;

  for (const effect of activeEffects) {
    if (effect.type === 'DISPEL' || effect.type === 'POUSSEE' || effect.type === 'ATTIRANCE' || effect.type === 'POISON') continue;
    if (effect.statCiblee === 'PA') paModifier += effect.valeur;
    else if (effect.statCiblee === 'PM') pmModifier += effect.valeur;
    else if (effect.statCiblee === 'PO') poModifier += effect.valeur;
  }

  return { paModifier, pmModifier, poModifier };
}

/**
 * Apply poison damage to an entity at the start of their turn
 * Returns true if the entity died from poison
 */
export async function applyPoisonDamage(
  combatId: number,
  entiteId: number
): Promise<{ died: boolean; totalDamage: number }> {
  const poisonEffects = await prisma.effetActif.findMany({
    where: { combatId, entiteId },
    include: { effet: true },
  });

  const poisons = poisonEffects.filter(e => e.effet.type === 'POISON');
  if (poisons.length === 0) return { died: false, totalDamage: 0 };

  const entity = await prisma.combatEntite.findUnique({ where: { id: entiteId } });
  if (!entity || entity.pvActuels <= 0) return { died: false, totalDamage: 0 };

  let totalDamage = 0;
  for (const poison of poisons) {
    const min = poison.effet.valeurMin ?? poison.effet.valeur;
    const max = poison.effet.valeur;
    const damage = randomInt(Math.min(min, max), Math.max(min, max));
    totalDamage += damage;
  }

  const newPV = Math.max(0, entity.pvActuels - totalDamage);
  await prisma.combatEntite.update({
    where: { id: entiteId },
    data: { pvActuels: newPV },
  });

  return { died: newPV <= 0, totalDamage };
}

/**
 * Remove all effects cast by a specific entity (when they die)
 */
export async function removeEffectsByCaster(combatId: number, casterId: number): Promise<number> {
  const result = await prisma.effetActif.deleteMany({
    where: { combatId, lanceurId: casterId },
  });
  return result.count;
}

/**
 * Convert StatType enum to object key
 */
function statTypeToKey(statType: StatType): keyof ModifiedStats | null {
  const mapping: Partial<Record<StatType, keyof ModifiedStats>> = {
    FORCE: 'force',
    INTELLIGENCE: 'intelligence',
    DEXTERITE: 'dexterite',
    AGILITE: 'agilite',
    VIE: 'vie',
    CHANCE: 'chance',
  };
  return mapping[statType] || null;
}
