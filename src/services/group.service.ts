import prisma from '../config/database';
import { CombatMode, MapType } from '@prisma/client';
import { CreateGroupRequest, Direction } from '../types';
import { mapService } from './map.service';
import { donjonService } from './donjon.service';

export class GroupService {
  async create(data: CreateGroupRequest) {
    // Validate leader belongs to the player
    const leader = await prisma.personnage.findUnique({
      where: { id: data.leaderId },
    });
    if (!leader) throw new Error('Leader character not found');
    if (leader.joueurId !== data.joueurId) throw new Error('Leader does not belong to this player');

    // Validate leader is on a map
    if (!leader.mapId) throw new Error('Leader must be on a map to create a group');

    // Validate leader is not already in another group
    const existingMembership = await prisma.groupePersonnage.findFirst({
      where: { personnageId: data.leaderId },
    });
    if (existingMembership) throw new Error('Leader is already in a group');

    const group = await prisma.groupe.create({
      data: {
        nom: data.nom,
        joueurId: data.joueurId,
        leaderId: data.leaderId,
      },
    });

    // Add leader as first member
    await prisma.groupePersonnage.create({
      data: { groupeId: group.id, personnageId: data.leaderId },
    });

    return this.findById(group.id);
  }

  private addImageUrl<T extends { sexe: string; race?: { imageUrlHomme?: string | null; imageUrlFemme?: string | null } | null }>(p: T) {
    const imageUrl = p.sexe === 'FEMME'
      ? (p.race?.imageUrlFemme ?? p.race?.imageUrlHomme ?? null)
      : (p.race?.imageUrlHomme ?? null);
    return { ...p, imageUrl };
  }

  async findById(id: number) {
    const group = await prisma.groupe.findUnique({
      where: { id },
      include: {
        joueur: true,
        leader: {
          include: {
            race: true,
            map: true,
          },
        },
        personnages: {
          include: {
            personnage: {
              include: {
                race: true,
                map: true,
              },
            },
          },
        },
      },
    });
    if (!group) return null;
    return {
      ...group,
      leader: group.leader ? this.addImageUrl(group.leader) : group.leader,
      personnages: group.personnages.map(gp => ({
        ...gp,
        personnage: this.addImageUrl(gp.personnage),
      })),
    };
  }

  async findAll() {
    const groups = await prisma.groupe.findMany({
      include: {
        leader: {
          include: { race: true, map: true },
        },
        personnages: {
          include: {
            personnage: {
              include: { race: true, map: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
    return groups.map(group => ({
      ...group,
      leader: group.leader ? this.addImageUrl(group.leader) : group.leader,
      personnages: group.personnages.map(gp => ({
        ...gp,
        personnage: this.addImageUrl(gp.personnage),
      })),
    }));
  }

  async addCharacter(groupId: number, characterId: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: {
        leader: true,
      },
    });
    if (!group) throw new Error('Group not found');
    if (!group.leader) throw new Error('Group has no leader');

    const character = await prisma.personnage.findUnique({
      where: { id: characterId },
    });
    if (!character) throw new Error('Character not found');

    // Same player only
    if (character.joueurId !== group.joueurId) {
      throw new Error('Character does not belong to this player');
    }

    // Must be on the same map as leader
    if (character.mapId !== group.leader.mapId) {
      throw new Error('Character must be on the same map as the group leader');
    }

    // Not already in this group
    const existing = await prisma.groupePersonnage.findUnique({
      where: { groupeId_personnageId: { groupeId: groupId, personnageId: characterId } },
    });
    if (existing) throw new Error('Character already in group');

    // Not already in any other group
    const otherMembership = await prisma.groupePersonnage.findFirst({
      where: { personnageId: characterId },
    });
    if (otherMembership) throw new Error('Character is already in a group');

    // Check group size (max 6)
    const currentSize = await prisma.groupePersonnage.count({ where: { groupeId: groupId } });
    if (currentSize >= 6) throw new Error('Group is full (max 6 characters)');

    // Move character to leader's position
    await prisma.personnage.update({
      where: { id: characterId },
      data: {
        positionX: group.leader.positionX,
        positionY: group.leader.positionY,
      },
    });

    await prisma.groupePersonnage.create({
      data: { groupeId: groupId, personnageId: characterId },
    });

    return this.findById(groupId);
  }

  async removeCharacter(groupId: number, characterId: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { personnages: true },
    });
    if (!group) throw new Error('Group not found');

    const existing = await prisma.groupePersonnage.findUnique({
      where: { groupeId_personnageId: { groupeId: groupId, personnageId: characterId } },
    });
    if (!existing) throw new Error('Character not in group');

    await prisma.groupePersonnage.delete({
      where: { groupeId_personnageId: { groupeId: groupId, personnageId: characterId } },
    });

    // If removed character was the leader, transfer leadership to next member
    if (group.leaderId === characterId) {
      const remaining = group.personnages.filter(gp => gp.personnageId !== characterId);
      if (remaining.length > 0) {
        await prisma.groupe.update({
          where: { id: groupId },
          data: { leaderId: remaining[0].personnageId },
        });
      } else {
        // No more members — remove group
        await prisma.groupe.delete({ where: { id: groupId } });
        return null;
      }
    }

    return this.findById(groupId);
  }

  async move(groupId: number, x: number, y: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: {
        leader: { include: { map: true } },
        personnages: true,
      },
    });

    if (!group) throw new Error('Group not found');
    if (!group.leader) throw new Error('Group has no leader');
    if (!group.leader.map) throw new Error('Group is not on any map');

    const map = group.leader.map;

    // Validate bounds
    if (x < 0 || x >= map.largeur || y < 0 || y >= map.hauteur) {
      throw new Error('Position out of map bounds');
    }

    // Check for blocked case
    const blockedCase = await prisma.mapCase.findFirst({
      where: {
        mapId: group.leader.mapId!,
        x,
        y,
        OR: [{ bloqueDeplacement: true }, { estExclue: true }],
      },
    });
    if (blockedCase) throw new Error('Cette case est bloquée');

    // Update position for ALL members (leader + others)
    const memberIds = group.personnages.map(gp => gp.personnageId);
    await prisma.personnage.updateMany({
      where: { id: { in: memberIds } },
      data: { positionX: x, positionY: y },
    });

    let combat = null;

    if (map.combatMode === CombatMode.AUTO) {
      const enemies = await prisma.groupeEnnemi.findMany({
        where: { mapId: group.leader.mapId!, vaincu: false },
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
        combat = await mapService.engageEnemyGroup(map.id, closest.id, groupId);
      }
    } else if (map.combatMode === CombatMode.MANUEL) {
      const enemyGroup = await mapService.checkEnemyGroupAtPosition(map.id, x, y);
      if (enemyGroup) {
        combat = await mapService.engageEnemyGroup(map.id, enemyGroup.id, groupId);
      }
    }

    // Check if on a connection
    let connection = null;
    connection = await prisma.mapConnection.findFirst({
      where: { fromMapId: map.id, positionX: x, positionY: y },
      include: {
        toMap: { select: { id: true, nom: true, type: true } },
      },
    });

    const updatedGroup = await this.findById(groupId);
    return { group: updatedGroup, combat, connection };
  }

  /**
   * Enter a map — updates mapId/positionX/positionY for ALL members
   */
  async enterMap(groupId: number, mapId: number, startX?: number, startY?: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { personnages: true },
    });
    if (!group) throw new Error('Group not found');

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        region: true,
        groupesEnnemis: { where: { vaincu: false } },
      },
    });
    if (!map) throw new Error('Map not found');

    // Block direct access to dungeon rooms without an active run
    const donjonSalle = await prisma.donjonSalle.findFirst({ where: { mapId } });
    if (donjonSalle) {
      const activeRun = await prisma.donjonRun.findFirst({
        where: { groupeId: groupId, termine: false, donjonId: donjonSalle.donjonId },
      });
      if (!activeRun) throw new Error('Cannot enter dungeon room without active run');
      const currentSalle = await prisma.donjonSalle.findFirst({
        where: { donjonId: donjonSalle.donjonId, ordre: activeRun.salleActuelle },
      });
      if (!currentSalle || currentSalle.mapId !== mapId) throw new Error('Cannot enter this dungeon room');
    }

    // Auto-spawn enemy groups on WILDERNESS maps
    if (map.type === MapType.WILDERNESS && map.groupesEnnemis.filter(g => !g.vaincu).length === 0) {
      await mapService.spawnEnemyGroups(mapId);
    }

    const posX = startX ?? Math.floor(map.largeur * 0.1);
    const posY = startY ?? Math.floor(map.hauteur / 2);

    // Update all members
    const memberIds = group.personnages.map(gp => gp.personnageId);
    await prisma.personnage.updateMany({
      where: { id: { in: memberIds } },
      data: { mapId, positionX: posX, positionY: posY },
    });

    return this.findById(groupId);
  }

  /**
   * Use a connection to travel to another map
   */
  async useConnection(groupId: number, connectionId: number, difficulte?: number, destinationConnectionId?: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { leader: true },
    });
    if (!group) throw new Error('Group not found');
    if (!group.leader) throw new Error('Group has no leader');

    const connection = await prisma.mapConnection.findUnique({
      where: { id: connectionId },
      include: { fromMap: true, toMap: true },
    });
    if (!connection) throw new Error('Connection not found');

    // Verify leader is on source map and at connection position
    if (group.leader.mapId !== connection.fromMapId) {
      throw new Error('Group is not on the source map');
    }
    if (group.leader.positionX !== connection.positionX || group.leader.positionY !== connection.positionY) {
      throw new Error('Group is not at the connection position');
    }

    if (connection.donjonId) {
      if (!difficulte || ![4, 6, 8].includes(difficulte)) {
        throw new Error('Difficulty required for dungeon portal (4, 6, or 8)');
      }
      return donjonService.enterDungeon(connection.donjonId, { groupeId: groupId }, difficulte);
    }

    if (!destinationConnectionId) {
      throw new Error('destinationConnectionId required for non-dungeon portals');
    }
    const dest = await prisma.mapConnection.findUnique({ where: { id: destinationConnectionId } });
    if (!dest) throw new Error('Destination portal not found');

    return this.enterMap(groupId, dest.fromMapId, dest.positionX, dest.positionY);
  }

  /**
   * Leave current map — sets mapId=null for ALL members
   */
  async leaveMap(groupId: number) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { personnages: true },
    });
    if (!group) throw new Error('Group not found');

    // Block leaving during active dungeon run
    const activeRun = await prisma.donjonRun.findFirst({ where: { groupeId: groupId, termine: false } });
    if (activeRun) throw new Error('Cannot leave during dungeon. Use abandon.');

    const memberIds = group.personnages.map(gp => gp.personnageId);
    await prisma.personnage.updateMany({
      where: { id: { in: memberIds } },
      data: { mapId: null, positionX: 0, positionY: 0 },
    });

    return this.findById(groupId);
  }

  /**
   * Move to another map by direction
   */
  async moveByDirection(groupId: number, direction: Direction) {
    const group = await prisma.groupe.findUnique({
      where: { id: groupId },
      include: { leader: { include: { map: true } } },
    });
    if (!group) throw new Error('Group not found');
    if (!group.leader) throw new Error('Group has no leader');
    if (!group.leader.map) throw new Error('Group is not on any map');

    const directionFieldMap: Record<Direction, 'nordMapId' | 'sudMapId' | 'estMapId' | 'ouestMapId'> = {
      NORD: 'nordMapId',
      SUD: 'sudMapId',
      EST: 'estMapId',
      OUEST: 'ouestMapId',
    };

    const destinationMapId = group.leader.map[directionFieldMap[direction]];
    if (!destinationMapId) throw new Error(`No exit in direction ${direction}`);

    // Block navigation to dungeon rooms
    const donjonSalle = await prisma.donjonSalle.findFirst({ where: { mapId: destinationMapId } });
    if (donjonSalle) throw new Error('Cannot navigate directly to a dungeon room');

    return this.enterMap(groupId, destinationMapId);
  }

  async delete(id: number) {
    // Block if active dungeon run
    const activeRun = await prisma.donjonRun.findFirst({ where: { groupeId: id, termine: false } });
    if (activeRun) throw new Error('Cannot delete group during active dungeon run');

    // Characters keep their positions — just delete the group membership and group
    await prisma.groupePersonnage.deleteMany({ where: { groupeId: id } });
    return prisma.groupe.delete({ where: { id } });
  }
}

export const groupService = new GroupService();
