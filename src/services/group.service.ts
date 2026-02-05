import prisma from '../config/database';
import { CombatMode, MapType } from '@prisma/client';
import { CreateGroupRequest } from '../types';
import { mapService } from './map.service';

export class GroupService {
  async create(data: CreateGroupRequest) {
    return prisma.groupe.create({
      data: {
        nom: data.nom,
        joueurId: data.joueurId,
      },
      include: {
        personnages: {
          include: {
            personnage: {
              include: {
                race: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: number) {
    return prisma.groupe.findUnique({
      where: { id },
      include: {
        joueur: true,
        personnages: {
          include: {
            personnage: {
              include: {
                race: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll() {
    return prisma.groupe.findMany({
      include: {
        personnages: {
          include: {
            personnage: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async addCharacter(groupId: number, characterId: number) {
    // Check if character exists
    const character = await prisma.personnage.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    // Check if group exists
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if character belongs to the same player
    if (character.joueurId !== group.joueurId) {
      throw new Error('Character does not belong to this player');
    }

    // Check if character is already in group
    const existing = await prisma.groupePersonnage.findUnique({
      where: {
        groupeId_personnageId: {
          groupeId: groupId,
          personnageId: characterId,
        },
      },
    });

    if (existing) {
      throw new Error('Character already in group');
    }

    // Check group size (max 6 characters)
    const currentSize = await prisma.groupePersonnage.count({
      where: { groupeId: groupId },
    });

    if (currentSize >= 6) {
      throw new Error('Group is full (max 6 characters)');
    }

    await prisma.groupePersonnage.create({
      data: {
        groupeId: groupId,
        personnageId: characterId,
      },
    });

    return this.findById(groupId);
  }

  async removeCharacter(groupId: number, characterId: number) {
    const existing = await prisma.groupePersonnage.findUnique({
      where: {
        groupeId_personnageId: {
          groupeId: groupId,
          personnageId: characterId,
        },
      },
    });

    if (!existing) {
      throw new Error('Character not in group');
    }

    await prisma.groupePersonnage.delete({
      where: {
        groupeId_personnageId: {
          groupeId: groupId,
          personnageId: characterId,
        },
      },
    });

    return this.findById(groupId);
  }

  async move(groupId: number, x: number, y: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { map: true },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    // Validate position if on a map
    if (group.map) {
      if (x < 0 || x >= group.map.largeur || y < 0 || y >= group.map.hauteur) {
        throw new Error('Position out of map bounds');
      }
    }

    // Update position
    const updatedGroup = await prisma.groupe.update({
      where: { id: groupId },
      data: {
        positionX: x,
        positionY: y,
      },
      include: {
        personnages: {
          include: {
            personnage: true,
          },
        },
        map: {
          include: {
            region: true,
          },
        },
      },
    });

    let combat = null;

    if (group.map) {
      if (group.map.combatMode === CombatMode.AUTO) {
        // Check for random encounter if on AUTO map
        combat = await mapService.checkRandomEncounter(group.map.id, groupId);
      } else if (group.map.combatMode === CombatMode.MANUEL) {
        // Check if there's an enemy group at this position (MANUEL mode)
        const enemyGroup = await mapService.checkEnemyGroupAtPosition(group.map.id, x, y);
        if (enemyGroup) {
          // Auto-engage the enemy group
          combat = await mapService.engageEnemyGroup(group.map.id, enemyGroup.id, groupId);
        }
      }
    }

    // Check if on a connection to another map
    let connection = null;
    if (group.map) {
      connection = await prisma.mapConnection.findFirst({
        where: {
          fromMapId: group.map.id,
          positionX: x,
          positionY: y,
        },
        include: {
          toMap: {
            select: { id: true, nom: true, type: true },
          },
        },
      });
    }

    return {
      group: updatedGroup,
      combat,
      connection,
    };
  }

  /**
   * Enter a map
   */
  async enterMap(groupId: number, mapId: number, startX?: number, startY?: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        region: true,
        groupesEnnemis: {
          where: { vaincu: false },
        },
      },
    });

    if (!map) {
      throw new Error('Map not found');
    }

    // Auto-spawn enemy groups on MANUEL maps if none exist
    if (map.combatMode === CombatMode.MANUEL && map.groupesEnnemis.length === 0) {
      await mapService.spawnEnemyGroups(mapId);
    }

    // Default starting position (center-left of map)
    const posX = startX ?? Math.floor(map.largeur * 0.1);
    const posY = startY ?? Math.floor(map.hauteur / 2);

    return prisma.groupe.update({
      where: { id: groupId },
      data: {
        mapId: mapId,
        positionX: posX,
        positionY: posY,
      },
      include: {
        personnages: {
          include: {
            personnage: {
              include: {
                race: true,
              },
            },
          },
        },
        map: {
          include: {
            region: true,
            ennemisActifs: {
              where: { vaincu: false },
              include: { monstre: true },
            },
            groupesEnnemis: {
              where: { vaincu: false },
              include: {
                membres: {
                  include: { monstre: true },
                },
              },
            },
            connectionsFrom: {
              include: {
                toMap: {
                  select: { id: true, nom: true, type: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Use a connection to travel to another map
   */
  async useConnection(groupId: number, connectionId: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { map: true },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const connection = await prisma.mapConnection.findUnique({
      where: { id: connectionId },
      include: {
        fromMap: true,
        toMap: true,
      },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Verify group is on the source map and at the connection position
    if (group.mapId !== connection.fromMapId) {
      throw new Error('Group is not on the source map');
    }

    if (group.positionX !== connection.positionX || group.positionY !== connection.positionY) {
      throw new Error('Group is not at the connection position');
    }

    // Move to destination map
    return this.enterMap(groupId, connection.toMapId);
  }

  /**
   * Leave current map (return to world/region view)
   */
  async leaveMap(groupId: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    return prisma.groupe.update({
      where: { id: groupId },
      data: {
        mapId: null,
        positionX: 0,
        positionY: 0,
      },
      include: {
        personnages: {
          include: {
            personnage: true,
          },
        },
      },
    });
  }

  async delete(id: number) {
    // First remove all characters from group
    await prisma.groupePersonnage.deleteMany({
      where: { groupeId: id },
    });

    return prisma.groupe.delete({
      where: { id },
    });
  }
}

export const groupService = new GroupService();
