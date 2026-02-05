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
        ennemisActifs: {
          where: { vaincu: false },
          include: {
            monstre: true,
          },
        },
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
          },
        },
        spawns: {
          include: {
            monstre: true,
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
    tauxRencontre?: number;
  }) {
    return prisma.map.create({
      data: {
        nom: data.nom,
        regionId: data.regionId,
        type: data.type,
        combatMode: data.combatMode,
        largeur: data.largeur,
        hauteur: data.hauteur,
        tauxRencontre: data.tauxRencontre ?? 0.2,
      },
      include: {
        region: true,
      },
    });
  }

  async addConnection(data: {
    fromMapId: number;
    toMapId: number;
    positionX: number;
    positionY: number;
    nom: string;
  }) {
    return prisma.mapConnection.create({
      data: {
        fromMapId: data.fromMapId,
        toMapId: data.toMapId,
        positionX: data.positionX,
        positionY: data.positionY,
        nom: data.nom,
      },
    });
  }

  async addSpawn(data: {
    mapId: number;
    monstreId: number;
    probabilite?: number;
    quantiteMin?: number;
    quantiteMax?: number;
  }) {
    return prisma.zoneSpawn.create({
      data: {
        mapId: data.mapId,
        monstreId: data.monstreId,
        probabilite: data.probabilite ?? 1.0,
        quantiteMin: data.quantiteMin ?? 1,
        quantiteMax: data.quantiteMax ?? 3,
      },
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
        spawns: {
          include: { monstre: true },
        },
        region: true,
        groupesEnnemis: {
          where: { vaincu: false },
        },
      },
    });

    if (!map) {
      throw new Error('Map not found');
    }

    if (map.spawns.length === 0) {
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

      if (attempts >= 100) continue; // Skip if can't find unique position
      usedPositions.add(`${posX},${posY}`);

      // Create the group
      const groupe = await prisma.groupeEnnemi.create({
        data: {
          mapId,
          positionX: posX,
          positionY: posY,
          respawnTime: 300, // 5 minutes default
        },
      });

      // Determine total monsters for this group (1-8)
      const totalMonstres = randomInt(1, 8);

      // Calculate total probability weight
      const totalWeight = map.spawns.reduce((sum, s) => sum + s.probabilite, 0);

      // Select 1-4 monster types for the group
      const numTypes = Math.min(randomInt(1, 4), map.spawns.length);
      const selectedSpawns: { spawn: typeof map.spawns[0]; count: number }[] = [];
      let remaining = totalMonstres;

      // Weighted random selection of monster types
      for (let i = 0; i < numTypes && remaining > 0; i++) {
        let roll = Math.random() * totalWeight;
        let selectedSpawn = map.spawns[0];

        for (const spawn of map.spawns) {
          roll -= spawn.probabilite;
          if (roll <= 0) {
            selectedSpawn = spawn;
            break;
          }
        }

        // Determine count for this type
        const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
        selectedSpawns.push({ spawn: selectedSpawn, count });
        remaining -= count;
      }

      // Create group members
      for (const { spawn, count } of selectedSpawns) {
        const niveau = randomInt(map.region.niveauMin, map.region.niveauMax);

        await prisma.groupeEnnemiMembre.create({
          data: {
            groupeEnnemiId: groupe.id,
            monstreId: spawn.monstreId,
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
   * Creates a combat with all monsters in the group
   */
  async engageEnemyGroup(mapId: number, groupeEnnemiId: number, groupeId: number) {
    const map = await this.findById(mapId);
    if (!map) {
      throw new Error('Map not found');
    }

    if (map.combatMode !== CombatMode.MANUEL) {
      throw new Error('Cannot manually engage enemies in AUTO mode');
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

    // Get player group
    const groupe = await prisma.groupe.findUnique({
      where: { id: groupeId },
      include: {
        personnages: {
          include: {
            personnage: true,
          },
        },
      },
    });

    if (!groupe) {
      throw new Error('Group not found');
    }

    // Create monsters array for combat from all group members
    const monstres: {
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
    }[] = [];

    for (const membre of groupeEnnemi.membres) {
      const membresFromTemplate = this.createMonstersFromTemplate(
        membre.monstre,
        membre.quantite,
        membre.niveau
      );
      monstres.push(...membresFromTemplate);
    }

    // Create the combat
    const combat = await combatService.create({
      groupeId,
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

    return combat;
  }

  /**
   * @deprecated Use spawnEnemyGroups instead
   * Spawn enemies on a map (for MANUEL mode)
   * Creates visible enemies based on spawn configuration
   */
  async spawnEnemies(mapId: number) {
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        spawns: {
          include: { monstre: true },
        },
        region: true,
      },
    });

    if (!map) {
      throw new Error('Map not found');
    }

    // Clear existing non-defeated enemies
    await prisma.mapEnnemi.deleteMany({
      where: { mapId, vaincu: false },
    });

    const createdEnemies = [];

    for (const spawn of map.spawns) {
      // Determine quantity
      const quantity = randomInt(spawn.quantiteMin, spawn.quantiteMax);

      for (let i = 0; i < quantity; i++) {
        // Random position on map
        const posX = randomInt(0, map.largeur - 1);
        const posY = randomInt(0, map.hauteur - 1);

        // Random level within region range
        const niveau = randomInt(map.region.niveauMin, map.region.niveauMax);

        const enemy = await prisma.mapEnnemi.create({
          data: {
            mapId,
            monstreId: spawn.monstreId,
            positionX: posX,
            positionY: posY,
            quantite: 1,
            niveau,
            respawnTime: 300, // 5 minutes default
          },
          include: { monstre: true },
        });

        createdEnemies.push(enemy);
      }
    }

    return createdEnemies;
  }

  /**
   * Engage an enemy on the map (MANUEL mode)
   * Creates a combat with the enemy group
   */
  async engageEnemy(mapId: number, ennemiId: number, groupeId: number) {
    const map = await this.findById(mapId);
    if (!map) {
      throw new Error('Map not found');
    }

    if (map.combatMode !== CombatMode.MANUEL) {
      throw new Error('Cannot manually engage enemies in AUTO mode');
    }

    const ennemi = await prisma.mapEnnemi.findUnique({
      where: { id: ennemiId },
      include: { monstre: true },
    });

    if (!ennemi || ennemi.mapId !== mapId) {
      throw new Error('Enemy not found on this map');
    }

    if (ennemi.vaincu) {
      throw new Error('Enemy already defeated');
    }

    // Get group
    const groupe = await prisma.groupe.findUnique({
      where: { id: groupeId },
      include: {
        personnages: {
          include: {
            personnage: true,
          },
        },
      },
    });

    if (!groupe) {
      throw new Error('Group not found');
    }

    // Create monsters array for combat
    const monstres = this.createMonstersFromTemplate(ennemi.monstre, ennemi.quantite, ennemi.niveau);

    // Create the combat
    const combat = await combatService.create({
      groupeId,
      monstres,
      mapId,
    });

    // Mark enemy as engaged (will be marked defeated after combat)
    await prisma.mapEnnemi.update({
      where: { id: ennemiId },
      data: {
        vaincu: true,
        vainquuAt: new Date(),
      },
    });

    return combat;
  }

  /**
   * Check for random encounter (AUTO mode)
   * Returns combat state if encounter triggered, null otherwise
   * Creates a group of 1-8 mixed monsters
   */
  async checkRandomEncounter(mapId: number, groupeId: number) {
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        spawns: {
          include: { monstre: true },
        },
        region: true,
      },
    });

    if (!map) {
      throw new Error('Map not found');
    }

    if (map.combatMode !== CombatMode.AUTO) {
      return null; // No random encounters in MANUEL mode
    }

    if (map.type === MapType.SAFE || map.type === MapType.VILLE) {
      return null; // No encounters in safe zones
    }

    // Check encounter probability
    if (!checkProbability(map.tauxRencontre)) {
      return null; // No encounter this time
    }

    if (map.spawns.length === 0) {
      return null; // No spawns configured
    }

    // Calculate total probability weight
    const totalWeight = map.spawns.reduce((sum, s) => sum + s.probabilite, 0);

    // Determine total monsters for this encounter (1-8)
    const totalMonstres = randomInt(1, 8);

    // Select 1-4 monster types for the group
    const numTypes = Math.min(randomInt(1, 4), map.spawns.length);
    const monstres: {
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
    }[] = [];
    let remaining = totalMonstres;

    // Weighted random selection of monster types
    for (let i = 0; i < numTypes && remaining > 0; i++) {
      let roll = Math.random() * totalWeight;
      let selectedSpawn = map.spawns[0];

      for (const spawn of map.spawns) {
        roll -= spawn.probabilite;
        if (roll <= 0) {
          selectedSpawn = spawn;
          break;
        }
      }

      // Determine count for this type
      const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
      const niveau = randomInt(map.region.niveauMin, map.region.niveauMax);

      // Create monsters from template
      const typeMonstres = this.createMonstersFromTemplate(selectedSpawn.monstre, count, niveau);
      monstres.push(...typeMonstres);

      remaining -= count;
    }

    // Create combat
    const combat = await combatService.create({
      groupeId,
      monstres,
      mapId,
    });

    return combat;
  }

  /**
   * Create monster definitions from template with level scaling
   */
  private createMonstersFromTemplate(
    template: {
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
      });
    }

    return monstres;
  }

  /**
   * Respawn defeated enemies that have passed their respawn time
   */
  async processRespawns(mapId: number) {
    const now = new Date();

    const toRespawn = await prisma.mapEnnemi.findMany({
      where: {
        mapId,
        vaincu: true,
        respawnTime: { not: null },
        vainquuAt: { not: null },
      },
      include: { monstre: true },
    });

    const respawned = [];

    for (const enemy of toRespawn) {
      if (enemy.vainquuAt && enemy.respawnTime) {
        const respawnAt = new Date(enemy.vainquuAt.getTime() + enemy.respawnTime * 1000);

        if (now >= respawnAt) {
          // Respawn: reset vaincu status and randomize position
          const map = await prisma.map.findUnique({ where: { id: mapId } });

          if (map) {
            const updated = await prisma.mapEnnemi.update({
              where: { id: enemy.id },
              data: {
                vaincu: false,
                vainquuAt: null,
                positionX: randomInt(0, map.largeur - 1),
                positionY: randomInt(0, map.hauteur - 1),
              },
              include: { monstre: true },
            });

            respawned.push(updated);
          }
        }
      }
    }

    return respawned;
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
