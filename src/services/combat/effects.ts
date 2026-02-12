import { EffetType, StatType } from '@prisma/client';
import prisma from '../../config/database';
import { checkProbability } from '../../utils/random';

export interface EffectDetails {
  id: number;
  nom: string;
  type: EffetType;
  statCiblee: StatType;
  valeur: number;
  toursRestants: number;
}

export interface AppliedEffect {
  entiteId: number;
  effetId: number;
  effetNom: string;
  duree: number;
  isDispel?: boolean;
  removedCount?: number;
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

  // Apply each active effect (skip DISPEL effects — they don't modify stats)
  for (const effect of activeEffects) {
    if (effect.type === 'DISPEL') continue;
    const statKey = statTypeToKey(effect.statCiblee);
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
  effetId: number
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
      data: { toursRestants: effet.duree },
    });
  } else {
    // Create new active effect
    await prisma.effetActif.create({
      data: {
        combatId,
        entiteId,
        effetId,
        toursRestants: effet.duree,
      },
    });
  }
}

/**
 * Apply spell effects after spell execution
 * Returns list of applied effects
 */
export async function applySpellEffects(
  combatId: number,
  sortId: number,
  casterId: number,
  targetIds: number[]
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

    if (sortEffet.surCible) {
      // Apply to all targets
      for (const targetId of targetIds) {
        await applyEffect(combatId, targetId, sortEffet.effetId);
        appliedEffects.push({
          entiteId: targetId,
          effetId: sortEffet.effetId,
          effetNom: sortEffet.effet.nom,
          duree: sortEffet.effet.duree,
        });
      }
    } else {
      // Apply to caster
      await applyEffect(combatId, casterId, sortEffet.effetId);
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
 * Convert StatType enum to object key
 */
function statTypeToKey(statType: StatType): keyof ModifiedStats | null {
  const mapping: Record<StatType, keyof ModifiedStats> = {
    FORCE: 'force',
    INTELLIGENCE: 'intelligence',
    DEXTERITE: 'dexterite',
    AGILITE: 'agilite',
    VIE: 'vie',
    CHANCE: 'chance',
  };
  return mapping[statType] || null;
}
