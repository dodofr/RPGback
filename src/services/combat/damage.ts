import { StatType } from '@prisma/client';
import { randomInt, checkProbability } from '../../utils/random';
import { getStatValue, calculateStatMultiplier, calculateCritChance } from '../../utils/formulas';
import { DamageResult } from '../../types';

interface SpellData {
  degatsMin: number;
  degatsMax: number;
  degatsCritMin: number;
  degatsCritMax: number;
  chanceCritBase: number;
  statUtilisee: StatType;
}

interface EntityStats {
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  vie: number;
  chance: number;
}

/**
 * Calculate damage for an attack or spell
 *
 * Process:
 * 1. Roll random damage between degatsMin and degatsMax
 * 2. Apply stat multiplier: (stat / 100) + 1
 * 3. Check for critical hit: random < chanceCritBase + (chance / 100)
 * 4. If critical: roll between degatsCritMin and degatsCritMax * stat multiplier instead
 */
export function calculateDamage(spell: SpellData, attackerStats: EntityStats): DamageResult {
  // Get the relevant stat value
  const statValue = getStatValue(attackerStats, spell.statUtilisee);

  // Calculate stat multiplier
  const statMultiplier = calculateStatMultiplier(statValue);

  // Calculate critical chance
  const critChance = calculateCritChance(spell.chanceCritBase, attackerStats.chance);

  // Check for critical hit
  const isCritical = checkProbability(critChance);

  let baseDamage: number;
  let finalDamage: number;

  if (isCritical) {
    // Critical hit: roll between crit min and max
    baseDamage = randomInt(spell.degatsCritMin, spell.degatsCritMax);
    finalDamage = Math.floor(baseDamage * statMultiplier);
  } else {
    // Normal hit: roll between min and max
    baseDamage = randomInt(spell.degatsMin, spell.degatsMax);
    finalDamage = Math.floor(baseDamage * statMultiplier);
  }

  return {
    baseDamage,
    finalDamage,
    isCritical,
    statMultiplier,
  };
}

/**
 * Apply damage to an entity
 * Returns the new HP value (minimum 0)
 */
export function applyDamage(currentPV: number, damage: number): number {
  return Math.max(0, currentPV - damage);
}

/**
 * Check if entity is dead
 */
export function isDead(pvActuels: number): boolean {
  return pvActuels <= 0;
}

/**
 * Calculate healing (if needed in the future)
 */
export function calculateHealing(
  baseHeal: number,
  statValue: number,
  pvMax: number,
  pvActuels: number
): number {
  const multiplier = calculateStatMultiplier(statValue);
  const healAmount = Math.floor(baseHeal * multiplier);

  // Cannot heal beyond max
  return Math.min(healAmount, pvMax - pvActuels);
}
