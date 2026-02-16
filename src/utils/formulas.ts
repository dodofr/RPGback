import { StatType } from '@prisma/client';

/**
 * Calculate PV (health points) from vie
 * Formula: 50 + (vie * 5)
 */
export function calculatePV(vie: number): number {
  return 50 + vie * 5;
}

/**
 * Calculate base PA (action points)
 * Base: 6 PA
 */
export function calculateBasePA(): number {
  return 6;
}

/**
 * Calculate base PM (movement points)
 * Base: 3 PM
 */
export function calculateBasePM(): number {
  return 3;
}

/**
 * Calculate base PO (range bonus)
 * Base: 0 PO
 */
export function calculateBasePO(): number {
  return 0;
}

/**
 * Get stat value by stat type from an object with stat properties
 */
export function getStatValue(
  stats: {
    force: number;
    intelligence: number;
    dexterite: number;
    agilite: number;
    vie: number;
    chance: number;
  },
  statType: StatType
): number {
  switch (statType) {
    case StatType.FORCE:
      return stats.force;
    case StatType.INTELLIGENCE:
      return stats.intelligence;
    case StatType.DEXTERITE:
      return stats.dexterite;
    case StatType.AGILITE:
      return stats.agilite;
    case StatType.VIE:
      return stats.vie;
    case StatType.CHANCE:
      return stats.chance;
    default:
      return 0;
  }
}

/**
 * Calculate stat multiplier for damage
 * Formula: (stat / 100) + 1
 */
export function calculateStatMultiplier(statValue: number): number {
  return statValue / 100 + 1;
}

/**
 * Calculate critical chance
 * Formula: chanceCritBase + (chance / 5000) + (bonusCritique / 100)
 * - chance / 5000 : marginal contribution (100 chance = +2%)
 * - bonusCritique / 100 : equipment + effects (integer, 10 = +10%)
 */
export function calculateCritChance(chanceCritBase: number, chance: number, bonusCritique: number = 0): number {
  const raw = chanceCritBase + (chance / 5000) + (bonusCritique / 100);
  return Math.min(0.50, raw);
}

/**
 * Calculate AoE damage reduction based on distance from center
 * -15% per Manhattan distance, minimum 10%
 */
export function calculateAoEReduction(distance: number): number {
  return Math.max(0.10, 1 - distance * 0.15);
}

/**
 * Calculate experience needed for next level
 * Formula: level² * 50
 */
export function experienceForNextLevel(level: number): number {
  return level * level * 50;
}

/**
 * Check if a character can level up
 */
export function canLevelUp(niveau: number, experience: number): boolean {
  return experience >= experienceForNextLevel(niveau);
}

/**
 * Get stat points earned per level
 */
export function statsPointsPerLevel(): number {
  return 10;
}

/**
 * Calculate Manhattan distance between two points
 */
export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Check if position is within grid bounds
 */
export function isInBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}
