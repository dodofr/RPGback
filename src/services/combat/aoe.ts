import { ZoneType } from '@prisma/client';
import { Position } from '../../types';
import { manhattanDistance, isInBounds } from '../../utils/formulas';

interface ZoneConfig {
  type: ZoneType;
  taille: number;
}

interface GridConfig {
  width: number;
  height: number;
}

/**
 * Get all cells affected by an AoE (Area of Effect)
 */
export function getAffectedCells(
  targetPosition: Position,
  zone: ZoneConfig,
  grid: GridConfig,
  casterPosition?: Position
): Position[] {
  const affected: Position[] = [];

  switch (zone.type) {
    case ZoneType.CASE:
      // Single cell
      if (isInBounds(targetPosition.x, targetPosition.y, grid.width, grid.height)) {
        affected.push({ ...targetPosition });
      }
      break;

    case ZoneType.CROIX:
      // Cross pattern: center + N/S/E/W up to size
      affected.push({ ...targetPosition });

      for (let i = 1; i <= zone.taille; i++) {
        // North
        if (isInBounds(targetPosition.x, targetPosition.y - i, grid.width, grid.height)) {
          affected.push({ x: targetPosition.x, y: targetPosition.y - i });
        }
        // South
        if (isInBounds(targetPosition.x, targetPosition.y + i, grid.width, grid.height)) {
          affected.push({ x: targetPosition.x, y: targetPosition.y + i });
        }
        // East
        if (isInBounds(targetPosition.x + i, targetPosition.y, grid.width, grid.height)) {
          affected.push({ x: targetPosition.x + i, y: targetPosition.y });
        }
        // West
        if (isInBounds(targetPosition.x - i, targetPosition.y, grid.width, grid.height)) {
          affected.push({ x: targetPosition.x - i, y: targetPosition.y });
        }
      }
      break;

    case ZoneType.CERCLE:
      // Circle: all cells within Manhattan distance <= size
      for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
          const distance = manhattanDistance(targetPosition.x, targetPosition.y, x, y);
          if (distance <= zone.taille) {
            affected.push({ x, y });
          }
        }
      }
      break;

    case ZoneType.LIGNE:
      // Line: from target in direction away from caster
      if (!casterPosition) {
        // If no caster position, just return target
        affected.push({ ...targetPosition });
        break;
      }

      // Determine direction
      const dx = targetPosition.x - casterPosition.x;
      const dy = targetPosition.y - casterPosition.y;

      // Normalize to get direction (-1, 0, or 1)
      const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      // If diagonal, prefer the dominant direction
      let finalDirX = dirX;
      let finalDirY = dirY;

      if (Math.abs(dx) > Math.abs(dy)) {
        finalDirY = 0;
      } else if (Math.abs(dy) > Math.abs(dx)) {
        finalDirX = 0;
      }

      // Add cells in line
      for (let i = 0; i <= zone.taille; i++) {
        const x = targetPosition.x + finalDirX * i;
        const y = targetPosition.y + finalDirY * i;

        if (isInBounds(x, y, grid.width, grid.height)) {
          affected.push({ x, y });
        }
      }
      break;

    case ZoneType.CONE:
      // Cone: fan shape from target away from caster
      // Simplified implementation: similar to line but wider
      if (!casterPosition) {
        affected.push({ ...targetPosition });
        break;
      }

      // Get direction
      const cdx = targetPosition.x - casterPosition.x;
      const cdy = targetPosition.y - casterPosition.y;

      const coneDirX = cdx === 0 ? 0 : cdx > 0 ? 1 : -1;
      const coneDirY = cdy === 0 ? 0 : cdy > 0 ? 1 : -1;

      // Determine primary direction
      let primaryX = coneDirX;
      let primaryY = coneDirY;

      if (Math.abs(cdx) > Math.abs(cdy)) {
        primaryY = 0;
      } else if (Math.abs(cdy) > Math.abs(cdx)) {
        primaryX = 0;
      }

      // Add cells in cone pattern
      for (let i = 0; i <= zone.taille; i++) {
        const baseX = targetPosition.x + primaryX * i;
        const baseY = targetPosition.y + primaryY * i;

        // Width increases with distance
        const width = i;

        for (let w = -width; w <= width; w++) {
          let x, y;

          if (primaryX !== 0) {
            x = baseX;
            y = baseY + w;
          } else {
            x = baseX + w;
            y = baseY;
          }

          if (isInBounds(x, y, grid.width, grid.height)) {
            // Avoid duplicates
            if (!affected.find((p) => p.x === x && p.y === y)) {
              affected.push({ x, y });
            }
          }
        }
      }
      break;

    case ZoneType.LIGNE_PERPENDICULAIRE: {
      // Perpendicular line centered on target, relative to caster→target direction
      if (!casterPosition) {
        affected.push({ ...targetPosition });
        break;
      }
      const lpdx = targetPosition.x - casterPosition.x;
      const lpdy = targetPosition.y - casterPosition.y;

      // Perpendicular direction: rotate 90 degrees
      let perpX: number, perpY: number;
      if (Math.abs(lpdx) > Math.abs(lpdy)) {
        // Primary direction is horizontal, perpendicular is vertical
        perpX = 0;
        perpY = 1;
      } else {
        // Primary direction is vertical, perpendicular is horizontal
        perpX = 1;
        perpY = 0;
      }

      affected.push({ ...targetPosition });
      for (let i = 1; i <= zone.taille; i++) {
        const x1 = targetPosition.x + perpX * i;
        const y1 = targetPosition.y + perpY * i;
        const x2 = targetPosition.x - perpX * i;
        const y2 = targetPosition.y - perpY * i;
        if (isInBounds(x1, y1, grid.width, grid.height)) {
          affected.push({ x: x1, y: y1 });
        }
        if (isInBounds(x2, y2, grid.width, grid.height)) {
          affected.push({ x: x2, y: y2 });
        }
      }
      break;
    }

    case ZoneType.DIAGONALE:
      // Diagonal cross (NE/NW/SE/SW) centered on target
      affected.push({ ...targetPosition });
      for (let i = 1; i <= zone.taille; i++) {
        const diags: [number, number][] = [
          [targetPosition.x + i, targetPosition.y - i], // NE
          [targetPosition.x - i, targetPosition.y - i], // NW
          [targetPosition.x + i, targetPosition.y + i], // SE
          [targetPosition.x - i, targetPosition.y + i], // SW
        ];
        for (const [dx, dy] of diags) {
          if (isInBounds(dx, dy, grid.width, grid.height)) {
            affected.push({ x: dx, y: dy });
          }
        }
      }
      break;

    case ZoneType.CARRE:
      // Square centered on target, side = 2*taille+1 (Chebyshev distance <= taille)
      for (let x = targetPosition.x - zone.taille; x <= targetPosition.x + zone.taille; x++) {
        for (let y = targetPosition.y - zone.taille; y <= targetPosition.y + zone.taille; y++) {
          if (isInBounds(x, y, grid.width, grid.height)) {
            affected.push({ x, y });
          }
        }
      }
      break;

    case ZoneType.ANNEAU:
      // Ring: only cells at exact Manhattan distance = taille from target
      for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
          if (manhattanDistance(targetPosition.x, targetPosition.y, x, y) === zone.taille) {
            affected.push({ x, y });
          }
        }
      }
      break;

    case ZoneType.CONE_INVERSE: {
      // Inverse cone: widens towards the caster instead of away
      if (!casterPosition) {
        affected.push({ ...targetPosition });
        break;
      }
      const cidx = targetPosition.x - casterPosition.x;
      const cidy = targetPosition.y - casterPosition.y;

      // Direction from target TOWARDS caster (inverse)
      let invPrimaryX = cidx === 0 ? 0 : cidx > 0 ? -1 : 1;
      let invPrimaryY = cidy === 0 ? 0 : cidy > 0 ? -1 : 1;

      if (Math.abs(cidx) > Math.abs(cidy)) {
        invPrimaryY = 0;
      } else if (Math.abs(cidy) > Math.abs(cidx)) {
        invPrimaryX = 0;
      }

      for (let i = 0; i <= zone.taille; i++) {
        const baseX = targetPosition.x + invPrimaryX * i;
        const baseY = targetPosition.y + invPrimaryY * i;
        const width = i;

        for (let w = -width; w <= width; w++) {
          let x, y;
          if (invPrimaryX !== 0) {
            x = baseX;
            y = baseY + w;
          } else {
            x = baseX + w;
            y = baseY;
          }

          if (isInBounds(x, y, grid.width, grid.height)) {
            if (!affected.find((p) => p.x === x && p.y === y)) {
              affected.push({ x, y });
            }
          }
        }
      }
      break;
    }
  }

  return affected;
}

/**
 * Get entities in affected cells
 */
export function getEntitiesInArea<T extends { positionX: number; positionY: number; pvActuels: number }>(
  affectedCells: Position[],
  entities: T[]
): T[] {
  return entities.filter(
    (entity) =>
      entity.pvActuels > 0 &&
      affectedCells.some((cell) => cell.x === entity.positionX && cell.y === entity.positionY)
  );
}
