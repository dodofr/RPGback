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
 * Get all cells that a straight line from 'from' to 'to' passes through.
 * Uses Bresenham supercover variant: when the line passes exactly through
 * a corner between cells, BOTH adjacent cells are included (strict LOS).
 * This means a single entity on a diagonal corner can block line of sight.
 */
export function getLineOfSightCells(from: Position, to: Position): Position[] {
  const cells: Position[] = [];

  let dx = Math.abs(to.x - from.x);
  let dy = Math.abs(to.y - from.y);

  const sx = to.x > from.x ? 1 : (to.x < from.x ? -1 : 0);
  const sy = to.y > from.y ? 1 : (to.y < from.y ? -1 : 0);

  let x = from.x;
  let y = from.y;
  let error = dx - dy;

  dx *= 2;
  dy *= 2;

  while (true) {
    cells.push({ x, y });

    if (x === to.x && y === to.y) break;

    if (error > 0) {
      x += sx;
      error -= dy;
    } else if (error < 0) {
      y += sy;
      error += dx;
    } else {
      // Line passes exactly through a corner between 4 cells.
      // Both adjacent cells are potential blockers (strict LOS).
      cells.push({ x: x + sx, y });
      cells.push({ x, y: y + sy });
      x += sx;
      y += sy;
      error += dx - dy;
    }
  }

  return cells;
}

/**
 * Check if there is line of sight between two positions.
 * Traces a straight line (Bresenham supercover) and checks every
 * intermediate cell for blocking obstacles and living entities.
 * The source and destination cells are excluded from blocking checks.
 */
export function hasLineOfSight(
  from: Position,
  to: Position,
  occupiedPositions: EntityPosition[],
  blockedCases: CombatCaseState[] = []
): boolean {
  const cells = getLineOfSightCells(from, to);

  for (const pos of cells) {
    // Skip source (caster) and destination (target) positions
    if (pos.x === from.x && pos.y === from.y) continue;
    if (pos.x === to.x && pos.y === to.y) continue;

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
