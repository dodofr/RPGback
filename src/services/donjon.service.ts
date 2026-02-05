import prisma from '../config/database';
import { CombatMode, MapType } from '@prisma/client';
import { randomInt } from '../utils/random';
import { combatService } from './combat/combat.service';

export class DonjonService {
  /**
   * Enter a dungeon with a group
   * Creates a DonjonRun, teleports group to first room, spawns enemies
   */
  async enterDungeon(donjonId: number, groupeId: number, difficulte: number) {
    // Validate difficulty (4, 6, or 8)
    if (![4, 6, 8].includes(difficulte)) {
      throw new Error('Difficulty must be 4, 6, or 8');
    }

    // Check if group exists
    const groupe = await prisma.groupe.findUnique({
      where: { id: groupeId },
      include: {
        personnages: {
          include: {
            personnage: true,
          },
        },
        donjonRun: true,
      },
    });

    if (!groupe) {
      throw new Error('Group not found');
    }

    if (groupe.personnages.length === 0) {
      throw new Error('Group has no characters');
    }

    // Check if group already has an active run
    if (groupe.donjonRun && !groupe.donjonRun.termine) {
      throw new Error('Group already has an active dungeon run');
    }

    // Check if dungeon exists
    const donjon = await prisma.donjon.findUnique({
      where: { id: donjonId },
      include: {
        salles: {
          orderBy: { ordre: 'asc' },
          include: { map: true },
        },
        boss: true,
        region: true,
      },
    });

    if (!donjon) {
      throw new Error('Dungeon not found');
    }

    if (donjon.salles.length < 4) {
      throw new Error('Dungeon is not properly configured (needs 4 rooms)');
    }

    // Delete any existing finished run for this group
    if (groupe.donjonRun) {
      await prisma.donjonRun.delete({
        where: { id: groupe.donjonRun.id },
      });
    }

    // Get first room
    const firstRoom = donjon.salles.find(s => s.ordre === 1);
    if (!firstRoom) {
      throw new Error('First room not found');
    }

    // Create the dungeon run
    const run = await prisma.donjonRun.create({
      data: {
        donjonId,
        groupeId,
        salleActuelle: 1,
        difficulte,
        termine: false,
        victoire: null,
      },
    });

    // Teleport group to first room
    await prisma.groupe.update({
      where: { id: groupeId },
      data: {
        mapId: firstRoom.mapId,
        positionX: Math.floor(firstRoom.map.largeur * 0.1),
        positionY: Math.floor(firstRoom.map.hauteur / 2),
      },
    });

    // Trigger the first combat
    const combat = await this.triggerDungeonCombat(run.id);

    // Get updated run with all relations
    const updatedRun = await prisma.donjonRun.findUnique({
      where: { id: run.id },
      include: {
        donjon: {
          include: {
            salles: {
              orderBy: { ordre: 'asc' },
              include: { map: true },
            },
            boss: true,
          },
        },
        groupe: {
          include: {
            personnages: {
              include: {
                personnage: true,
              },
            },
            map: true,
          },
        },
      },
    });

    return {
      run: updatedRun,
      combat,
      salle: firstRoom,
    };
  }

  /**
   * Advance to the next room after winning a combat
   */
  async advanceToNextRoom(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: {
        donjon: {
          include: {
            salles: {
              orderBy: { ordre: 'asc' },
              include: { map: true },
            },
            boss: true,
          },
        },
        groupe: true,
      },
    });

    if (!run) {
      throw new Error('Dungeon run not found');
    }

    if (run.termine) {
      throw new Error('Dungeon run is already finished');
    }

    const nextRoomNumber = run.salleActuelle + 1;

    // Check if dungeon is completed (was on room 4)
    if (nextRoomNumber > 4) {
      // Victory! Mark run as complete
      await prisma.donjonRun.update({
        where: { id: runId },
        data: {
          termine: true,
          victoire: true,
          combatActuel: null,
        },
      });

      // Teleport group out of dungeon
      await prisma.groupe.update({
        where: { id: run.groupeId },
        data: {
          mapId: null,
          positionX: 0,
          positionY: 0,
        },
      });

      return {
        completed: true,
        victoire: true,
        message: 'Dungeon completed! Congratulations!',
      };
    }

    // Get next room
    const nextRoom = run.donjon.salles.find(s => s.ordre === nextRoomNumber);
    if (!nextRoom) {
      throw new Error(`Room ${nextRoomNumber} not found`);
    }

    // Update run to next room
    await prisma.donjonRun.update({
      where: { id: runId },
      data: {
        salleActuelle: nextRoomNumber,
        combatActuel: null,
      },
    });

    // Teleport group to next room
    await prisma.groupe.update({
      where: { id: run.groupeId },
      data: {
        mapId: nextRoom.mapId,
        positionX: Math.floor(nextRoom.map.largeur * 0.1),
        positionY: Math.floor(nextRoom.map.hauteur / 2),
      },
    });

    // Trigger combat in new room
    const combat = await this.triggerDungeonCombat(runId);

    return {
      completed: false,
      salleActuelle: nextRoomNumber,
      salle: nextRoom,
      combat,
      message: `Advanced to room ${nextRoomNumber}`,
    };
  }

  /**
   * Spawn enemies for a dungeon combat
   * Returns array of monster definitions
   */
  private async spawnDungeonEnemies(
    donjon: {
      niveauMin: number;
      niveauMax: number;
      boss: {
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
        xpRecompense: number;
      };
      salles: Array<{
        mapId: number;
        map: {
          spawns?: Array<{
            monstreId: number;
            monstre: {
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
              xpRecompense: number;
            };
            probabilite: number;
          }>;
        };
      }>;
    },
    difficulte: number,
    isBoss: boolean,
    mapId: number
  ) {
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

    if (isBoss) {
      // Spawn the boss with boosted stats (+50%) and XP (×3)
      const boss = donjon.boss;
      const niveau = donjon.niveauMax;
      const levelDiff = niveau - boss.niveauBase;
      const scaleFactor = 1 + levelDiff * 0.1;
      const bossBoost = 1.5; // +50% stats for boss

      monstres.push({
        nom: `${boss.nom} (Boss)`,
        force: Math.floor(boss.force * scaleFactor * bossBoost),
        intelligence: Math.floor(boss.intelligence * scaleFactor * bossBoost),
        dexterite: Math.floor(boss.dexterite * scaleFactor * bossBoost),
        agilite: Math.floor(boss.agilite * scaleFactor * bossBoost),
        vie: Math.floor(boss.vie * scaleFactor * bossBoost),
        chance: Math.floor(boss.chance * scaleFactor * bossBoost),
        pvMax: Math.floor(boss.pvBase * scaleFactor * bossBoost),
        paMax: boss.paBase,
        pmMax: boss.pmBase,
      });
    } else {
      // Get spawn configuration from the map
      const mapWithSpawns = await prisma.map.findUnique({
        where: { id: mapId },
        include: {
          spawns: {
            include: { monstre: true },
          },
        },
      });

      if (!mapWithSpawns || mapWithSpawns.spawns.length === 0) {
        // Fallback: use spawns from any room in the dungeon
        const anyRoomWithSpawns = donjon.salles.find(
          s => s.map.spawns && s.map.spawns.length > 0
        );
        if (!anyRoomWithSpawns?.map.spawns) {
          throw new Error('No spawn configuration found for dungeon');
        }
      }

      const spawns = mapWithSpawns?.spawns || [];
      if (spawns.length === 0) {
        throw new Error('No spawn configuration found for this room');
      }

      // Calculate total probability weight
      const totalWeight = spawns.reduce((sum, s) => sum + s.probabilite, 0);

      // Generate exactly 'difficulte' number of monsters
      let remaining = difficulte;
      const numTypes = Math.min(randomInt(1, 4), spawns.length);

      for (let i = 0; i < numTypes && remaining > 0; i++) {
        // Weighted random selection
        let roll = Math.random() * totalWeight;
        let selectedSpawn = spawns[0];

        for (const spawn of spawns) {
          roll -= spawn.probabilite;
          if (roll <= 0) {
            selectedSpawn = spawn;
            break;
          }
        }

        const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
        const niveau = randomInt(donjon.niveauMin, donjon.niveauMax);

        // Create monsters from template
        const template = selectedSpawn.monstre;
        const levelDiff = niveau - template.niveauBase;
        const scaleFactor = 1 + levelDiff * 0.1;

        for (let j = 0; j < count; j++) {
          monstres.push({
            nom: count > 1 ? `${template.nom} ${monstres.length + 1}` : template.nom,
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

        remaining -= count;
      }
    }

    return monstres;
  }

  /**
   * Trigger a dungeon combat for the current room
   */
  async triggerDungeonCombat(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: {
        donjon: {
          include: {
            salles: {
              orderBy: { ordre: 'asc' },
              include: {
                map: {
                  include: {
                    spawns: {
                      include: { monstre: true },
                    },
                  },
                },
              },
            },
            boss: true,
          },
        },
        groupe: {
          include: {
            map: true,
          },
        },
      },
    });

    if (!run) {
      throw new Error('Dungeon run not found');
    }

    if (run.termine) {
      throw new Error('Dungeon run is already finished');
    }

    // Get current room
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (!currentRoom) {
      throw new Error(`Room ${run.salleActuelle} not found`);
    }

    const isBoss = run.salleActuelle === 4;

    // Spawn enemies
    const monstres = await this.spawnDungeonEnemies(
      run.donjon as any,
      run.difficulte,
      isBoss,
      currentRoom.mapId
    );

    // Create combat
    const combat = await combatService.create({
      groupeId: run.groupeId,
      monstres,
      mapId: currentRoom.mapId,
    });

    // Update run with current combat ID
    await prisma.donjonRun.update({
      where: { id: runId },
      data: {
        combatActuel: combat?.id ?? null,
      },
    });

    return combat;
  }

  /**
   * Mark dungeon as failed and eject group
   */
  async failDungeon(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: { groupe: true },
    });

    if (!run) {
      throw new Error('Dungeon run not found');
    }

    // Mark run as failed
    await prisma.donjonRun.update({
      where: { id: runId },
      data: {
        termine: true,
        victoire: false,
        combatActuel: null,
      },
    });

    // Eject group from dungeon
    await prisma.groupe.update({
      where: { id: run.groupeId },
      data: {
        mapId: null,
        positionX: 0,
        positionY: 0,
      },
    });

    return {
      success: true,
      message: 'Dungeon run failed. Group has been ejected.',
    };
  }

  /**
   * Abandon a dungeon run voluntarily
   */
  async abandonDungeon(groupeId: number) {
    const run = await prisma.donjonRun.findFirst({
      where: {
        groupeId,
        termine: false,
      },
    });

    if (!run) {
      throw new Error('No active dungeon run found for this group');
    }

    // Mark run as abandoned (failed)
    await prisma.donjonRun.update({
      where: { id: run.id },
      data: {
        termine: true,
        victoire: false,
        combatActuel: null,
      },
    });

    // Eject group from dungeon
    await prisma.groupe.update({
      where: { id: groupeId },
      data: {
        mapId: null,
        positionX: 0,
        positionY: 0,
      },
    });

    return {
      success: true,
      message: 'Dungeon run abandoned. Group has been ejected.',
    };
  }

  /**
   * Get the current dungeon state for a group
   */
  async getDungeonState(groupeId: number) {
    const run = await prisma.donjonRun.findFirst({
      where: {
        groupeId,
        termine: false,
      },
      include: {
        donjon: {
          include: {
            salles: {
              orderBy: { ordre: 'asc' },
              include: { map: true },
            },
            boss: true,
            region: true,
          },
        },
        groupe: {
          include: {
            personnages: {
              include: {
                personnage: true,
              },
            },
            map: true,
          },
        },
      },
    });

    if (!run) {
      return null;
    }

    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);

    return {
      run: {
        id: run.id,
        donjonId: run.donjonId,
        groupeId: run.groupeId,
        salleActuelle: run.salleActuelle,
        difficulte: run.difficulte,
        termine: run.termine,
        victoire: run.victoire,
        combatActuel: run.combatActuel,
      },
      donjon: run.donjon,
      salle: currentRoom,
      groupe: run.groupe,
    };
  }

  /**
   * Get a run by combat ID (for engine integration)
   */
  async getRunByCombatId(combatId: number) {
    return prisma.donjonRun.findFirst({
      where: {
        combatActuel: combatId,
        termine: false,
      },
    });
  }

  /**
   * List all dungeons
   */
  async findAll() {
    return prisma.donjon.findMany({
      include: {
        region: true,
        boss: true,
        salles: {
          orderBy: { ordre: 'asc' },
          include: { map: true },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get dungeon by ID
   */
  async findById(id: number) {
    return prisma.donjon.findUnique({
      where: { id },
      include: {
        region: true,
        boss: true,
        salles: {
          orderBy: { ordre: 'asc' },
          include: { map: true },
        },
      },
    });
  }
}

export const donjonService = new DonjonService();
