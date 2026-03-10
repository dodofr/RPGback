import prisma from '../config/database';
import { CombatMode, MapType } from '@prisma/client';
import { Direction } from '../types';
import { mapService } from './map.service';

export class CharacterNavigationService {
  /**
   * Enter a map with a solo character
   */
  async enterMap(charId: number, mapId: number, startX?: number, startY?: number) {
    const char = await prisma.personnage.findUnique({ where: { id: charId } });
    if (!char) throw new Error('Character not found');

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        region: true,
        groupesEnnemis: { where: { vaincu: false } },
      },
    });
    if (!map) throw new Error('Map not found');

    // Block direct access to dungeon rooms (characters must go through group+donjon)
    const donjonSalle = await prisma.donjonSalle.findFirst({ where: { mapId } });
    if (donjonSalle) throw new Error('Cannot enter dungeon room directly');

    // Auto-spawn enemy groups on WILDERNESS maps
    if (map.type === MapType.WILDERNESS && map.groupesEnnemis.filter(g => !g.vaincu).length === 0) {
      await mapService.spawnEnemyGroups(mapId);
    }

    const posX = startX ?? Math.floor(map.largeur * 0.1);
    const posY = startY ?? Math.floor(map.hauteur / 2);

    return prisma.personnage.update({
      where: { id: charId },
      data: { mapId, positionX: posX, positionY: posY },
      include: { race: true, map: { include: { region: true } } },
    });
  }

  /**
   * Move character on the current map; detects and engages enemies
   */
  async move(charId: number, x: number, y: number) {
    const char = await prisma.personnage.findUnique({
      where: { id: charId },
      include: { map: true },
    });
    if (!char) throw new Error('Character not found');
    if (!char.map) throw new Error('Character is not on any map');

    const map = char.map;

    // Validate bounds
    if (x < 0 || x >= map.largeur || y < 0 || y >= map.hauteur) {
      throw new Error('Position out of map bounds');
    }

    // Check blocked case
    const blockedCase = await prisma.mapCase.findFirst({
      where: {
        mapId: char.mapId!,
        x,
        y,
        OR: [{ bloqueDeplacement: true }, { estExclue: true }],
      },
    });
    if (blockedCase) throw new Error('Cette case est bloquée');

    // Update character position
    await prisma.personnage.update({
      where: { id: charId },
      data: { positionX: x, positionY: y },
    });

    let combat = null;

    if (map.combatMode === CombatMode.AUTO) {
      const enemies = await prisma.groupeEnnemi.findMany({
        where: { mapId: char.mapId!, vaincu: false },
      });
      const nearby = enemies.filter(
        ge => Math.abs(ge.positionX - x) + Math.abs(ge.positionY - y) <= 4
      );
      if (nearby.length > 0) {
        const closest = nearby.reduce((a, b) =>
          Math.abs(a.positionX - x) + Math.abs(a.positionY - y) <=
          Math.abs(b.positionX - x) + Math.abs(b.positionY - y)
            ? a : b
        );
        combat = await mapService.engageEnemyGroup(map.id, closest.id, undefined, charId);
      }
    } else if (map.combatMode === CombatMode.MANUEL) {
      const enemyGroup = await mapService.checkEnemyGroupAtPosition(map.id, x, y);
      if (enemyGroup) {
        combat = await mapService.engageEnemyGroup(map.id, enemyGroup.id, undefined, charId);
      }
    }

    // Check if on a connection
    const connection = await prisma.mapConnection.findFirst({
      where: { fromMapId: map.id, positionX: x, positionY: y },
      include: { toMap: { select: { id: true, nom: true, type: true } } },
    });

    const updatedChar = await prisma.personnage.findUnique({
      where: { id: charId },
      include: { race: true, map: { include: { region: true } } },
    });

    return { character: updatedChar, combat, connection };
  }

  /**
   * Move to another map by direction
   */
  async moveByDirection(charId: number, direction: Direction) {
    const char = await prisma.personnage.findUnique({
      where: { id: charId },
      include: { map: true },
    });
    if (!char) throw new Error('Character not found');
    if (!char.map) throw new Error('Character is not on any map');

    const directionFieldMap: Record<Direction, 'nordMapId' | 'sudMapId' | 'estMapId' | 'ouestMapId'> = {
      NORD: 'nordMapId',
      SUD: 'sudMapId',
      EST: 'estMapId',
      OUEST: 'ouestMapId',
    };

    const destinationMapId = char.map[directionFieldMap[direction]];
    if (!destinationMapId) throw new Error(`No exit in direction ${direction}`);

    const donjonSalle = await prisma.donjonSalle.findFirst({ where: { mapId: destinationMapId } });
    if (donjonSalle) throw new Error('Cannot navigate directly to a dungeon room');

    return this.enterMap(charId, destinationMapId);
  }

  /**
   * Use a portal connection
   */
  async useConnection(charId: number, connectionId: number, destinationConnectionId?: number, difficulte?: number) {
    const char = await prisma.personnage.findUnique({ where: { id: charId } });
    if (!char) throw new Error('Character not found');

    const connection = await prisma.mapConnection.findUnique({
      where: { id: connectionId },
      include: { fromMap: true, toMap: true },
    });
    if (!connection) throw new Error('Connection not found');

    if (char.mapId !== connection.fromMapId) throw new Error('Character is not on the source map');
    if (char.positionX !== connection.positionX || char.positionY !== connection.positionY) {
      throw new Error('Character is not at the connection position');
    }

    // Dungeon portals: enter solo dungeon
    if (connection.donjonId) {
      if (!difficulte || ![4, 6, 8].includes(difficulte)) {
        throw new Error('difficulte must be 4, 6 or 8 for dungeon portals');
      }
      const { donjonService } = await import('./donjon.service');
      return donjonService.enterDungeon(connection.donjonId, { personnageId: charId }, difficulte);
    }

    if (!destinationConnectionId) {
      throw new Error('destinationConnectionId required for non-dungeon portals');
    }
    const dest = await prisma.mapConnection.findUnique({ where: { id: destinationConnectionId } });
    if (!dest) throw new Error('Destination portal not found');

    return this.enterMap(charId, dest.fromMapId, dest.positionX, dest.positionY);
  }

  /**
   * Leave current map
   */
  async leaveMap(charId: number) {
    const char = await prisma.personnage.findUnique({ where: { id: charId } });
    if (!char) throw new Error('Character not found');

    const activeRun = await prisma.donjonRun.findFirst({ where: { personnageId: charId, termine: false } });
    if (activeRun) throw new Error('Cannot leave during dungeon. Use abandon.');

    const map5 = await prisma.map.findUnique({ where: { id: 5 } });
    const posX = map5 ? Math.floor(map5.largeur * 0.1) : 0;
    const posY = map5 ? Math.floor(map5.hauteur / 2) : 0;

    return prisma.personnage.update({
      where: { id: charId },
      data: { mapId: 5, positionX: posX, positionY: posY },
      include: { race: true },
    });
  }
}

export const characterNavigationService = new CharacterNavigationService();
