import prisma from '../config/database';
import { CombatMode, MapType } from '@prisma/client';
import { randomInt, checkProbability } from '../utils/random';
import { combatService } from './combat/combat.service';

export class MapService {
  async findAll() {
    return prisma.map.findMany({
      include: {
        region: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    return prisma.map.findUnique({
      where: { id },
      include: {
        region: true,
        groupesEnnemis: {
          where: { vaincu: false },
          include: {
            membres: {
              include: {
                monstre: true,
              },
            },
          },
        },
        connectionsFrom: {
          include: {
            toMap: {
              select: { id: true, nom: true, type: true },
            },
            donjon: {
              select: { id: true, nom: true, description: true, niveauMin: true, niveauMax: true },
            },
          },
        },
      },
    });
  }

  async create(data: {
    nom: string;
    regionId: number;
    type: MapType;
    combatMode: CombatMode;
    largeur: number;
    hauteur: number;
  }) {
    return prisma.map.create({
      data: {
        nom: data.nom,
        regionId: data.regionId,
        type: data.type,
        combatMode: data.combatMode,
        largeur: data.largeur,
        hauteur: data.hauteur,
      },
      include: {
        region: true,
      },
    });
  }

  async update(id: number, data: Partial<{
    nom: string;
    type: MapType;
    combatMode: CombatMode;
    largeur: number;
    hauteur: number;
    nordMapId: number | null;
    sudMapId: number | null;
    estMapId: number | null;
    ouestMapId: number | null;
    imageUrl: string | null;
    nordExitX: number | null;
    nordExitY: number | null;
    sudExitX: number | null;
    sudExitY: number | null;
    estExitX: number | null;
    estExitY: number | null;
    ouestExitX: number | null;
    ouestExitY: number | null;
  }>) {
    return prisma.map.update({
      where: { id },
      data,
      include: { region: true },
    });
  }

  async delete(id: number) {
    // Delete related data
    await prisma.mapConnection.deleteMany({ where: { OR: [{ fromMapId: id }, { toMapId: id }] } });
    await prisma.groupeEnnemi.deleteMany({ where: { mapId: id } });
    // MapCase and MapSpawn are deleted via Cascade
    // Nullify directional references
    await prisma.map.updateMany({ where: { nordMapId: id }, data: { nordMapId: null } });
    await prisma.map.updateMany({ where: { sudMapId: id }, data: { sudMapId: null } });
    await prisma.map.updateMany({ where: { estMapId: id }, data: { estMapId: null } });
    await prisma.map.updateMany({ where: { ouestMapId: id }, data: { ouestMapId: null } });
    return prisma.map.delete({ where: { id } });
  }

  async deleteConnection(connId: number) {
    return prisma.mapConnection.delete({ where: { id: connId } });
  }

  async addConnection(data: {
    fromMapId: number;
    toMapId?: number | null;
    positionX: number;
    positionY: number;
    nom: string;
  }) {
    return prisma.mapConnection.create({
      data: {
        fromMapId: data.fromMapId,
        toMapId: data.toMapId ?? null,
        positionX: data.positionX,
        positionY: data.positionY,
        nom: data.nom,
      },
    });
  }

  async getAllPortals() {
    return prisma.mapConnection.findMany({
      where: { donjonId: null },
      include: {
        fromMap: { select: { id: true, nom: true, type: true } },
      },
      orderBy: [{ fromMap: { nom: 'asc' } }, { nom: 'asc' }],
    });
  }

  async updateWorldPositions(positions: { mapId: number; worldX: number; worldY: number }[]) {
    return prisma.$transaction(async (tx) => {
      // Update worldX/worldY for each map in the list
      for (const pos of positions) {
        await tx.map.update({
          where: { id: pos.mapId },
          data: { worldX: pos.worldX, worldY: pos.worldY },
        });
      }

      // Clear worldX/worldY for maps NOT in the list
      const placedIds = positions.map(p => p.mapId);
      if (placedIds.length > 0) {
        await tx.map.updateMany({
          where: { id: { notIn: placedIds }, worldX: { not: null } },
          data: { worldX: null, worldY: null },
        });
      } else {
        await tx.map.updateMany({
          where: { worldX: { not: null } },
          data: { worldX: null, worldY: null },
        });
      }

      // Clear all directional links
      await tx.map.updateMany({ data: { nordMapId: null, sudMapId: null, estMapId: null, ouestMapId: null } });

      // Rebuild directional links from adjacency
      // Build a lookup: "x,y" → mapId
      const posMap = new Map<string, number>();
      for (const pos of positions) {
        posMap.set(`${pos.worldX},${pos.worldY}`, pos.mapId);
      }

      for (const pos of positions) {
        const nord = posMap.get(`${pos.worldX},${pos.worldY - 1}`);
        const sud = posMap.get(`${pos.worldX},${pos.worldY + 1}`);
        const est = posMap.get(`${pos.worldX + 1},${pos.worldY}`);
        const ouest = posMap.get(`${pos.worldX - 1},${pos.worldY}`);

        const data: Record<string, number | null> = {};
        if (nord !== undefined) data.nordMapId = nord;
        if (sud !== undefined) data.sudMapId = sud;
        if (est !== undefined) data.estMapId = est;
        if (ouest !== undefined) data.ouestMapId = ouest;

        if (Object.keys(data).length > 0) {
          await tx.map.update({ where: { id: pos.mapId }, data });
        }
      }

      // Return all maps
      return tx.map.findMany({
        include: { region: true },
        orderBy: { id: 'asc' },
      });
    });
  }

  /**
   * Spawn enemy groups on a map (for MANUEL mode)
   * Creates 1-3 groups of 1-8 mixed monsters based on spawn configuration
   */
  async spawnEnemyGroups(mapId: number) {
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        region: {
          include: {
            monstres: {
              include: { monstre: true },
            },
          },
        },
        groupesEnnemis: {
          where: { vaincu: false },
        },
      },
    });

    if (!map) {
      throw new Error('Map not found');
    }

    // Never spawn monsters on VILLE or SAFE maps
    if (map.type === MapType.VILLE || map.type === MapType.SAFE) {
      return [];
    }

    const regionMonstres = map.region.monstres;
    if (regionMonstres.length === 0) {
      return [];
    }

    // Don't spawn if there are already active groups
    if (map.groupesEnnemis.length > 0) {
      return map.groupesEnnemis;
    }

    // Generate 1-3 groups
    const numGroups = randomInt(1, 3);
    const createdGroups = [];
    const usedPositions: Set<string> = new Set();

    for (let g = 0; g < numGroups; g++) {
      // Find unique position for this group
      let posX: number, posY: number;
      let attempts = 0;
      do {
        posX = randomInt(0, map.largeur - 1);
        posY = randomInt(0, map.hauteur - 1);
        attempts++;
      } while (usedPositions.has(`${posX},${posY}`) && attempts < 100);

      if (attempts >= 100) continue;
      usedPositions.add(`${posX},${posY}`);

      // Create the group
      const groupe = await prisma.groupeEnnemi.create({
        data: {
          mapId,
          positionX: posX,
          positionY: posY,
          respawnTime: 300,
        },
      });

      // Determine total monsters for this group (1-8)
      const totalMonstres = randomInt(1, 8);

      // Calculate total probability weight
      const totalWeight = regionMonstres.reduce((sum, rm) => sum + rm.probabilite, 0);

      // Select 1-4 monster types for the group
      const numTypes = Math.min(randomInt(1, 4), regionMonstres.length);
      const selectedMonstres: { rm: typeof regionMonstres[0]; count: number }[] = [];
      let remaining = totalMonstres;

      // Weighted random selection of monster types
      for (let i = 0; i < numTypes && remaining > 0; i++) {
        let roll = Math.random() * totalWeight;
        let selected = regionMonstres[0];

        for (const rm of regionMonstres) {
          roll -= rm.probabilite;
          if (roll <= 0) {
            selected = rm;
            break;
          }
        }

        const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
        selectedMonstres.push({ rm: selected, count });
        remaining -= count;
      }

      // Create group members
      for (const { rm, count } of selectedMonstres) {
        const niveau = randomInt(map.region.niveauMin, map.region.niveauMax);

        await prisma.groupeEnnemiMembre.create({
          data: {
            groupeEnnemiId: groupe.id,
            monstreId: rm.monstreId,
            quantite: count,
            niveau,
          },
        });
      }

      // Fetch the complete group with members
      const completeGroup = await prisma.groupeEnnemi.findUnique({
        where: { id: groupe.id },
        include: {
          membres: {
            include: { monstre: true },
          },
        },
      });

      if (completeGroup) {
        createdGroups.push(completeGroup);
      }
    }

    return createdGroups;
  }

  /**
   * Check if there's an enemy group at a position
   */
  async checkEnemyGroupAtPosition(mapId: number, x: number, y: number) {
    return prisma.groupeEnnemi.findFirst({
      where: {
        mapId,
        positionX: x,
        positionY: y,
        vaincu: false,
      },
      include: {
        membres: {
          include: { monstre: true },
        },
      },
    });
  }

  /**
   * Engage an enemy group on the map (MANUEL mode)
   * Creates a combat with all monsters in the group.
   * Pass either groupeId (group combat) or personnageId (solo combat).
   */
  async engageEnemyGroup(mapId: number, groupeEnnemiId: number, groupeId?: number, personnageId?: number) {
    const map = await this.findById(mapId);
    if (!map) {
      throw new Error('Map not found');
    }

    const groupeEnnemi = await prisma.groupeEnnemi.findUnique({
      where: { id: groupeEnnemiId },
      include: {
        membres: {
          include: { monstre: true },
        },
      },
    });

    if (!groupeEnnemi || groupeEnnemi.mapId !== mapId) {
      throw new Error('Enemy group not found on this map');
    }

    if (groupeEnnemi.vaincu) {
      throw new Error('Enemy group already defeated');
    }

    if (!groupeId && !personnageId) {
      throw new Error('Either groupeId or personnageId is required');
    }

    // Validate group or character exists
    if (groupeId) {
      const groupe = await prisma.groupe.findUnique({ where: { id: groupeId } });
      if (!groupe) throw new Error('Group not found');
    } else if (personnageId) {
      const char = await prisma.personnage.findUnique({ where: { id: personnageId } });
      if (!char) throw new Error('Character not found');
    }

    // Check if this is a dungeon combat — use monstresCaches if available
    const donjonRun = groupeId
      ? await prisma.donjonRun.findFirst({ where: { groupeId, termine: false } })
      : personnageId
        ? await prisma.donjonRun.findFirst({ where: { personnageId, termine: false } })
        : null;

    let monstres: {
      nom: string;
      force: number;
      intelligence: number;
      dexterite: number;
      agilite: number;
      vie: number;
      chance: number;
      pvMax: number;
      paMax: number;
      pmMax: number;
      monstreTemplateId?: number;
      niveau?: number;
      iaType?: string;
    }[];

    if (donjonRun?.monstresCaches) {
      // Use pre-calculated monsters (with boss boost etc.)
      monstres = donjonRun.monstresCaches as unknown as typeof monstres;
    } else {
      // Normal map: create monsters from GroupeEnnemiMembre templates
      monstres = [];
      for (const membre of groupeEnnemi.membres) {
        const membresFromTemplate = this.createMonstersFromTemplate(
          membre.monstre,
          membre.quantite,
          membre.niveau
        );
        monstres.push(...membresFromTemplate);
      }
    }

    // Create the combat
    const combat = await combatService.create({
      groupeId,
      personnageId,
      monstres,
      mapId,
    });

    // Mark enemy group as defeated
    await prisma.groupeEnnemi.update({
      where: { id: groupeEnnemiId },
      data: {
        vaincu: true,
        vainquuAt: new Date(),
      },
    });

    // Track combat in dungeon run
    if (donjonRun && combat) {
      await prisma.donjonRun.update({
        where: { id: donjonRun.id },
        data: { combatActuel: combat.id },
      });
    }

    return combat;
  }

  /**
   * Create monster definitions from template with level scaling
   */
  private createMonstersFromTemplate(
    template: {
      id: number;
      nom: string;
      force: number;
      intelligence: number;
      dexterite: number;
      agilite: number;
      vie: number;
      chance: number;
      pvBase: number;
      paBase: number;
      pmBase: number;
      niveauBase: number;
      iaType?: string;
    },
    quantity: number,
    niveau: number
  ) {
    const monstres = [];

    // Level scaling factor (10% per level difference)
    const levelDiff = niveau - template.niveauBase;
    const scaleFactor = 1 + levelDiff * 0.1;

    for (let i = 0; i < quantity; i++) {
      monstres.push({
        nom: quantity > 1 ? `${template.nom} ${i + 1}` : template.nom,
        force: Math.floor(template.force * scaleFactor),
        intelligence: Math.floor(template.intelligence * scaleFactor),
        dexterite: Math.floor(template.dexterite * scaleFactor),
        agilite: Math.floor(template.agilite * scaleFactor),
        vie: Math.floor(template.vie * scaleFactor),
        chance: Math.floor(template.chance * scaleFactor),
        pvMax: Math.floor(template.pvBase * scaleFactor),
        paMax: template.paBase,
        pmMax: template.pmBase,
        monstreTemplateId: template.id,
        niveau,
        iaType: template.iaType,
      });
    }

    return monstres;
  }

  /**
   * Respawn defeated enemy groups that have passed their respawn time
   */
  async processGroupRespawns(mapId: number) {
    const now = new Date();

    const toRespawn = await prisma.groupeEnnemi.findMany({
      where: {
        mapId,
        vaincu: true,
        respawnTime: { not: null },
        vainquuAt: { not: null },
      },
      include: {
        membres: { include: { monstre: true } },
      },
    });

    const map = await prisma.map.findUnique({ where: { id: mapId } });

    if (!map) {
      return [];
    }

    const respawned: Awaited<ReturnType<typeof prisma.groupeEnnemi.update>>[] = [];

    // Get current active group positions to avoid collisions
    const activeGroups = await prisma.groupeEnnemi.findMany({
      where: { mapId, vaincu: false },
    });
    const usedPositions = new Set(activeGroups.map(g => `${g.positionX},${g.positionY}`));

    for (const group of toRespawn) {
      if (group.vainquuAt && group.respawnTime) {
        const respawnAt = new Date(group.vainquuAt.getTime() + group.respawnTime * 1000);

        if (now >= respawnAt) {
          // Find new position
          let posX: number, posY: number;
          let attempts = 0;
          do {
            posX = randomInt(0, map.largeur - 1);
            posY = randomInt(0, map.hauteur - 1);
            attempts++;
          } while (usedPositions.has(`${posX},${posY}`) && attempts < 100);

          if (attempts >= 100) continue;
          usedPositions.add(`${posX},${posY}`);

          const updated = await prisma.groupeEnnemi.update({
            where: { id: group.id },
            data: {
              vaincu: false,
              vainquuAt: null,
              positionX: posX,
              positionY: posY,
            },
            include: {
              membres: { include: { monstre: true } },
            },
          });

          respawned.push(updated);
        }
      }
    }

    return respawned;
  }
}

export const mapService = new MapService();
