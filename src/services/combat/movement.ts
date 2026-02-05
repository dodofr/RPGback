import { Position } from '../../types';
import { manhattanDistance, isInBounds } from '../../utils/formulas';
import { CombatCaseState, isBlockedForMovement, isBlockedForLOS } from './grid';

interface GridConfig {
  width: number;
  height: number;
}

interface EntityPosition {
  id: number;
  positionX: number;
  positionY: number;
  pvActuels: number;
}

/**
 * Calculate the cost to move from one position to another
 * Uses Manhattan distance (no diagonal movement)
 */
export function calculateMovementCost(from: Position, to: Position): number {
  return manhattanDistance(from.x, from.y, to.x, to.y);
}

/**
 * Check if a move is valid
 */
export function canMove(
  from: Position,
  to: Position,
  pmAvailable: number,
  grid: GridConfig,
  occupiedPositions: EntityPosition[],
  blockedCases: CombatCaseState[] = []
): { valid: boolean; reason?: string; cost?: number } {
  // Check if destination is in bounds
  if (!isInBounds(to.x, to.y, grid.width, grid.height)) {
    return { valid: false, reason: 'Destination out of bounds' };
  }

  // Check if destination is blocked by an obstacle
  if (isBlockedForMovement(to.x, to.y, blockedCases)) {
    return { valid: false, reason: 'Destination is blocked by an obstacle' };
  }

  // Calculate movement cost
  const cost = calculateMovementCost(from, to);

  // Check if enough PM
  if (cost > pmAvailable) {
    return { valid: false, reason: `Not enough PM (need ${cost}, have ${pmAvailable})` };
  }

  // Check if destination is occupied by a living entity
  const occupant = occupiedPositions.find(
    (e) => e.positionX === to.x && e.positionY === to.y && e.pvActuels > 0
  );

  if (occupant) {
    return { valid: false, reason: 'Destination is occupied' };
  }

  return { valid: true, cost };
}

/**
 * Get all valid move destinations for an entity
 */
export function getValidMoveDestinations(
  from: Position,
  pmAvailable: number,
  grid: GridConfig,
  occupiedPositions: EntityPosition[],
  blockedCases: CombatCaseState[] = []
): Position[] {
  const validPositions: Position[] = [];

  // Check all positions within PM range
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const to = { x, y };
      const result = canMove(from, to, pmAvailable, grid, occupiedPositions, blockedCases);

      if (result.valid && (x !== from.x || y !== from.y)) {
        validPositions.push(to);
      }
    }
  }

  return validPositions;
}

/**
 * Find path between two positions (simple implementation)
 * Returns array of positions to traverse
 */
export function findPath(from: Position, to: Position): Position[] {
  const path: Position[] = [];
  let current = { ...from };

  // Simple pathfinding: move horizontally then vertically
  while (current.x !== to.x) {
    current.x += current.x < to.x ? 1 : -1;
    path.push({ ...current });
  }

  while (current.y !== to.y) {
    current.y += current.y < to.y ? 1 : -1;
    path.push({ ...current });
  }

  return path;
}

/**
 * Check if there is line of sight between two positions
 * Checks path for blocking obstacles and entities
 */
export function hasLineOfSight(
  from: Position,
  to: Position,
  occupiedPositions: EntityPosition[],
  blockedCases: CombatCaseState[] = []
): boolean {
  const path = findPath(from, to);

  // Check all positions except the destination
  for (let i = 0; i < path.length - 1; i++) {
    const pos = path[i];

    // Check for blocking obstacle
    if (isBlockedForLOS(pos.x, pos.y, blockedCases)) {
      return false;
    }

    // Check for blocking entity
    const blocked = occupiedPositions.find(
      (e) => e.positionX === pos.x && e.positionY === pos.y && e.pvActuels > 0
    );
    if (blocked) {
      return false;
    }
  }

  return true;
}
