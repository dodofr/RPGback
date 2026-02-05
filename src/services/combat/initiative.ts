import { randomInt } from '../../utils/random';

interface EntityWithAgilite {
  id: number;
  agilite: number;
}

interface EntityWithTeam extends EntityWithAgilite {
  equipe: number;
}

interface InitiativeResult {
  id: number;
  initiative: number;
  ordreJeu: number;
}

/**
 * Calculate initiative for a single entity
 * Formula: agilite + random(1-20)
 */
export function calculateInitiative(agilite: number): number {
  return agilite + randomInt(1, 20);
}

/**
 * Calculate initiative order for all entities
 * Returns entities sorted by initiative (highest first)
 */
export function calculateInitiativeOrder(entities: EntityWithAgilite[]): InitiativeResult[] {
  // Calculate initiative for each entity
  const withInitiative = entities.map((entity) => ({
    id: entity.id,
    initiative: calculateInitiative(entity.agilite),
  }));

  // Sort by initiative (descending)
  withInitiative.sort((a, b) => b.initiative - a.initiative);

  // Assign play order
  return withInitiative.map((entity, index) => ({
    ...entity,
    ordreJeu: index + 1,
  }));
}

/**
 * Calculate alternating initiative order for balanced team play
 *
 * Logic:
 * 1. Calculate initiative for each entity: INIT = AGILITE + random(1-20)
 * 2. Separate and sort each team by initiative (descending)
 * 3. Alternate: Player[0] → Enemy[0] → Player[1] → Enemy[1] → ...
 * 4. Remaining members of the larger team play at the end
 *
 * Example (3 players vs 5 monsters):
 * Players sorted: P1(25), P2(20), P3(15)
 * Monsters sorted: M1(22), M2(18), M3(16), M4(12), M5(8)
 * Final order: P1 → M1 → P2 → M2 → P3 → M3 → M4 → M5
 */
export function calculateAlternatingInitiativeOrder(entities: EntityWithTeam[]): InitiativeResult[] {
  // Calculate initiative for each entity
  const withInitiative = entities.map((entity) => ({
    id: entity.id,
    equipe: entity.equipe,
    initiative: calculateInitiative(entity.agilite),
  }));

  // Separate teams (team 0 = players, team 1 = enemies)
  const team0 = withInitiative.filter((e) => e.equipe === 0);
  const team1 = withInitiative.filter((e) => e.equipe === 1);

  // Sort each team by initiative (descending)
  team0.sort((a, b) => b.initiative - a.initiative);
  team1.sort((a, b) => b.initiative - a.initiative);

  // Build alternating order
  const alternatingOrder: typeof withInitiative = [];
  const maxLength = Math.max(team0.length, team1.length);

  for (let i = 0; i < maxLength; i++) {
    // Add player at position i (if exists)
    if (i < team0.length) {
      alternatingOrder.push(team0[i]);
    }
    // Add enemy at position i (if exists)
    if (i < team1.length) {
      alternatingOrder.push(team1[i]);
    }
  }

  // Assign play order (1-indexed)
  return alternatingOrder.map((entity, index) => ({
    id: entity.id,
    initiative: entity.initiative,
    ordreJeu: index + 1,
  }));
}

/**
 * Get the next entity in the turn order
 */
export function getNextEntity<T extends { ordreJeu: number; pvActuels: number }>(
  entities: T[],
  currentOrdre: number
): T | null {
  // Filter out dead entities
  const aliveEntities = entities.filter((e) => e.pvActuels > 0);

  if (aliveEntities.length === 0) {
    return null;
  }

  // Sort by play order
  aliveEntities.sort((a, b) => a.ordreJeu - b.ordreJeu);

  // Find next entity after current
  const nextEntity = aliveEntities.find((e) => e.ordreJeu > currentOrdre);

  // If no next entity, wrap around to first
  return nextEntity || aliveEntities[0];
}

/**
 * Check if it's a new round (all entities have played)
 */
export function isNewRound(
  currentOrdre: number,
  maxOrdre: number,
  aliveCount: number
): boolean {
  return currentOrdre >= maxOrdre || aliveCount === 0;
}
