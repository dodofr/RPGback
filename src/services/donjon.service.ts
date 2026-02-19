import prisma from '../config/database';
import { CombatMode, MapType, Prisma } from '@prisma/client';
import { randomInt } from '../utils/random';

export class DonjonService {
  /**
   * Enter a dungeon with a group
   * Creates a DonjonRun, teleports group to first room, spawns visible enemies
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

    // Check if dungeon exists (include region for monster spawning)
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

    // Save origin map for return after dungeon
    const mapOrigineId = groupe.mapId;

    // Create the dungeon run
    const run = await prisma.donjonRun.create({
      data: {
        donjonId,
        groupeId,
        salleActuelle: 1,
        difficulte,
        termine: false,
        victoire: null,
        mapOrigineId,
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

    // Spawn visible enemies (instead of auto-starting combat)
    const groupeEnnemi = await this.spawnDungeonGroupeEnnemi(run.id);

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
      salle: firstRoom,
      groupeEnnemi,
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

    // Clean up enemies from current room
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (currentRoom) {
      await this.cleanupDungeonEnemies(currentRoom.mapId);
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
          monstresCaches: Prisma.DbNull,
        },
      });

      // Teleport group back to origin map (or null if no origin)
      await prisma.groupe.update({
        where: { id: run.groupeId },
        data: {
          mapId: run.mapOrigineId ?? null,
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
        monstresCaches: Prisma.DbNull,
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

    // Spawn visible enemies in new room
    const groupeEnnemi = await this.spawnDungeonGroupeEnnemi(runId);

    return {
      completed: false,
      salleActuelle: nextRoomNumber,
      salle: nextRoom,
      groupeEnnemi,
      message: `Advanced to room ${nextRoomNumber}`,
    };
  }

  /**
   * Spawn a visible GroupeEnnemi on the current dungeon room map
   * Stores monstresCaches in the run for later use by engageEnemyGroup
   */
  async spawnDungeonGroupeEnnemi(runId: number) {
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
            region: true,
          },
        },
      },
    });

    if (!run) {
      throw new Error('Dungeon run not found');
    }

    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (!currentRoom) {
      throw new Error(`Room ${run.salleActuelle} not found`);
    }

    const isBoss = run.salleActuelle === 4;

    // Generate monster data — use fixed compositions if defined, fall back to random
    const monstres = await this.spawnDungeonEnemies(
      run.donjon,
      run.difficulte,
      isBoss,
      currentRoom.id
    );

    // Clean up any existing enemies on this room map
    await this.cleanupDungeonEnemies(currentRoom.mapId);

    // Group monsters by (monstreTemplateId, niveau) for GroupeEnnemiMembre
    const monstreGroups = new Map<string, { monstreTemplateId: number; niveau: number; count: number }>();
    for (const m of monstres) {
      const key = `${m.monstreTemplateId}-${m.niveau}`;
      const existing = monstreGroups.get(key);
      if (existing) {
        existing.count++;
      } else {
        monstreGroups.set(key, { monstreTemplateId: m.monstreTemplateId, niveau: m.niveau, count: 1 });
      }
    }

    // Create visible GroupeEnnemi on the map
    const posX = Math.floor(currentRoom.map.largeur * 0.8);
    const posY = Math.floor(currentRoom.map.hauteur / 2);

    const groupeEnnemi = await prisma.groupeEnnemi.create({
      data: {
        mapId: currentRoom.mapId,
        positionX: posX,
        positionY: posY,
      },
    });

    // Create members
    for (const group of monstreGroups.values()) {
      await prisma.groupeEnnemiMembre.create({
        data: {
          groupeEnnemiId: groupeEnnemi.id,
          monstreId: group.monstreTemplateId,
          quantite: group.count,
          niveau: group.niveau,
        },
      });
    }

    // Store the full monster data in monstresCaches for combat creation
    await prisma.donjonRun.update({
      where: { id: runId },
      data: {
        monstresCaches: monstres as unknown as any,
      },
    });

    // Return the complete group with members
    return prisma.groupeEnnemi.findUnique({
      where: { id: groupeEnnemi.id },
      include: {
        membres: {
          include: { monstre: true },
        },
      },
    });
  }

  /**
   * Clean up all enemy groups on a dungeon room map
   */
  async cleanupDungeonEnemies(mapId: number) {
    // Delete members first (cascade would handle it, but being explicit)
    const groups = await prisma.groupeEnnemi.findMany({ where: { mapId } });
    for (const g of groups) {
      await prisma.groupeEnnemiMembre.deleteMany({ where: { groupeEnnemiId: g.id } });
    }
    await prisma.groupeEnnemi.deleteMany({ where: { mapId } });
  }

  /**
   * Spawn enemies for a dungeon combat.
   * Priority: fixed compositions (DonjonSalleComposition) if defined for this salle+difficulte.
   * Fallback: rooms 1-3 = region monsters at niveauMax; room 4 = 1 boss + regulars.
   */
  private async spawnDungeonEnemies(
    donjon: {
      niveauMin: number;
      niveauMax: number;
      bossId?: number;
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
        iaType?: string;
      };
      region: {
        id: number;
        niveauMax: number;
      };
    },
    difficulte: number,
    isBoss: boolean,
    salleId?: number
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
      monstreTemplateId: number;
      niveau: number;
      iaType?: string;
    }[] = [];

    // ── Priority: fixed compositions if defined for this salle + difficulte ──
    if (salleId) {
      const compositions = await prisma.donjonSalleComposition.findMany({
        where: { salleId, difficulte },
        include: { monstre: true },
      });

      if (compositions.length > 0) {
        let entryIndex = 1;
        for (const comp of compositions) {
          const template = comp.monstre;
          const niveau = comp.niveau;
          const levelDiff = niveau - template.niveauBase;
          const sf = Math.max(1, 1 + levelDiff * 0.1);
          const isBossEntry = template.id === donjon.boss.id;
          const bossBoost = isBossEntry ? 1.5 : 1;

          for (let j = 0; j < comp.quantite; j++) {
            const suffix = comp.quantite > 1 ? ` ${entryIndex}` : '';
            const nom = isBossEntry ? `${template.nom} (Boss)` : `${template.nom}${suffix}`;
            monstres.push({
              nom,
              force: Math.floor(template.force * sf * bossBoost),
              intelligence: Math.floor(template.intelligence * sf * bossBoost),
              dexterite: Math.floor(template.dexterite * sf * bossBoost),
              agilite: Math.floor(template.agilite * sf * bossBoost),
              vie: Math.floor(template.vie * sf * bossBoost),
              chance: Math.floor(template.chance * sf * bossBoost),
              pvMax: Math.floor(template.pvBase * sf * bossBoost),
              paMax: template.paBase,
              pmMax: template.pmBase,
              monstreTemplateId: template.id,
              niveau,
              iaType: template.iaType,
            });
            if (!isBossEntry) entryIndex++;
          }
        }
        return monstres;
      }
    }

    // ── Fallback: random region-based spawning ──
    // Get region monsters
    const regionMonstres = await prisma.regionMonstre.findMany({
      where: { regionId: donjon.region.id },
      include: { monstre: true },
    });

    if (regionMonstres.length === 0) {
      throw new Error('No monsters configured for this region');
    }

    const totalWeight = regionMonstres.reduce((sum, rm) => sum + rm.probabilite, 0);

    if (isBoss) {
      // Boss room: 1 boss at niveauMax + random(5,10), boosted 1.5x
      const boss = donjon.boss;
      const bossNiveau = donjon.region.niveauMax + randomInt(5, 10);
      const levelDiff = bossNiveau - boss.niveauBase;
      const scaleFactor = 1 + levelDiff * 0.1;
      const bossBoost = 1.5;

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
        monstreTemplateId: boss.id,
        niveau: bossNiveau,
        iaType: boss.iaType,
      });

      // Add (difficulte - 1) regular monsters at niveauMax
      const regularCount = difficulte - 1;
      if (regularCount > 0) {
        const numTypes = Math.min(randomInt(1, 4), regionMonstres.length);
        let remaining = regularCount;

        for (let i = 0; i < numTypes && remaining > 0; i++) {
          let roll = Math.random() * totalWeight;
          let selected = regionMonstres[0];
          for (const rm of regionMonstres) {
            roll -= rm.probabilite;
            if (roll <= 0) { selected = rm; break; }
          }

          const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
          const template = selected.monstre;
          const niveau = donjon.region.niveauMax;
          const ld = niveau - template.niveauBase;
          const sf = 1 + ld * 0.1;

          for (let j = 0; j < count; j++) {
            monstres.push({
              nom: count > 1 ? `${template.nom} ${monstres.length + 1}` : template.nom,
              force: Math.floor(template.force * sf),
              intelligence: Math.floor(template.intelligence * sf),
              dexterite: Math.floor(template.dexterite * sf),
              agilite: Math.floor(template.agilite * sf),
              vie: Math.floor(template.vie * sf),
              chance: Math.floor(template.chance * sf),
              pvMax: Math.floor(template.pvBase * sf),
              paMax: template.paBase,
              pmMax: template.pmBase,
              monstreTemplateId: template.id,
              niveau,
              iaType: template.iaType,
            });
          }
          remaining -= count;
        }
      }
    } else {
      // Regular rooms: monsters at region niveauMax
      const niveau = donjon.region.niveauMax;
      let remaining = difficulte;
      const numTypes = Math.min(randomInt(1, 4), regionMonstres.length);

      for (let i = 0; i < numTypes && remaining > 0; i++) {
        let roll = Math.random() * totalWeight;
        let selected = regionMonstres[0];
        for (const rm of regionMonstres) {
          roll -= rm.probabilite;
          if (roll <= 0) { selected = rm; break; }
        }

        const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
        const template = selected.monstre;
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
            monstreTemplateId: template.id,
            niveau,
            iaType: template.iaType,
          });
        }
        remaining -= count;
      }
    }

    return monstres;
  }

  /**
   * Mark dungeon as failed and eject group to origin map
   */
  async failDungeon(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: {
        groupe: true,
        donjon: {
          include: {
            salles: { orderBy: { ordre: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      throw new Error('Dungeon run not found');
    }

    // Clean up enemies from current room
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (currentRoom) {
      await this.cleanupDungeonEnemies(currentRoom.mapId);
    }

    // Mark run as failed
    await prisma.donjonRun.update({
      where: { id: runId },
      data: {
        termine: true,
        victoire: false,
        combatActuel: null,
        monstresCaches: Prisma.DbNull,
      },
    });

    // Eject group to origin map
    await prisma.groupe.update({
      where: { id: run.groupeId },
      data: {
        mapId: run.mapOrigineId ?? null,
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
      include: {
        donjon: {
          include: {
            salles: { orderBy: { ordre: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      throw new Error('No active dungeon run found for this group');
    }

    // Cancel active combat if any
    if (run.combatActuel) {
      const combat = await prisma.combat.findUnique({ where: { id: run.combatActuel } });
      if (combat && combat.status === 'EN_COURS') {
        await prisma.combat.update({
          where: { id: run.combatActuel },
          data: { status: 'ABANDONNE' },
        });
        // Clean up combat effects, cooldowns and invocations
        await prisma.effetActif.deleteMany({ where: { combatId: run.combatActuel } });
        await prisma.sortCooldown.deleteMany({ where: { combatId: run.combatActuel } });
        await prisma.combatEntite.updateMany({
          where: { combatId: run.combatActuel, invocateurId: { not: null }, pvActuels: { gt: 0 } },
          data: { pvActuels: 0 },
        });
      }
    }

    // Clean up enemies from current room
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (currentRoom) {
      await this.cleanupDungeonEnemies(currentRoom.mapId);
    }

    // Mark run as abandoned (failed)
    await prisma.donjonRun.update({
      where: { id: run.id },
      data: {
        termine: true,
        victoire: false,
        combatActuel: null,
        monstresCaches: Prisma.DbNull,
      },
    });

    // Eject group to origin map
    await prisma.groupe.update({
      where: { id: groupeId },
      data: {
        mapId: run.mapOrigineId ?? null,
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

    // Include active enemy group on current room
    let groupeEnnemi = null;
    if (currentRoom) {
      groupeEnnemi = await prisma.groupeEnnemi.findFirst({
        where: {
          mapId: currentRoom.mapId,
          vaincu: false,
        },
        include: {
          membres: {
            include: { monstre: true },
          },
        },
      });
    }

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
      groupeEnnemi,
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
   * Set or update the portal (MapConnection) for a dungeon
   */
  async setPortail(donjonId: number, data: {
    fromMapId: number;
    positionX: number;
    positionY: number;
    nom?: string;
  }) {
    // Verify dungeon exists and has at least 1 room
    const donjon = await prisma.donjon.findUnique({
      where: { id: donjonId },
      include: {
        salles: { orderBy: { ordre: 'asc' } },
      },
    });

    if (!donjon) {
      throw new Error('Dungeon not found');
    }

    const firstRoom = donjon.salles.find(s => s.ordre === 1);
    if (!firstRoom) {
      throw new Error('Dungeon has no rooms configured');
    }

    const nom = data.nom ?? "Entr\u00e9e du donjon";

    // Check if portal already exists for this dungeon
    const existing = await prisma.mapConnection.findFirst({
      where: { donjonId },
    });

    if (existing) {
      // Update existing portal
      return prisma.mapConnection.update({
        where: { id: existing.id },
        data: {
          fromMapId: data.fromMapId,
          toMapId: firstRoom.mapId,
          positionX: data.positionX,
          positionY: data.positionY,
          nom,
        },
        include: {
          donjon: { select: { id: true, nom: true, description: true, niveauMin: true, niveauMax: true } },
        },
      });
    }

    // Create new portal
    return prisma.mapConnection.create({
      data: {
        fromMapId: data.fromMapId,
        toMapId: firstRoom.mapId,
        positionX: data.positionX,
        positionY: data.positionY,
        nom,
        donjonId,
      },
      include: {
        donjon: { select: { id: true, nom: true, description: true, niveauMin: true, niveauMax: true } },
      },
    });
  }

  /**
   * Delete the portal (MapConnection) for a dungeon
   */
  async deletePortail(donjonId: number) {
    const existing = await prisma.mapConnection.findFirst({
      where: { donjonId },
    });

    if (!existing) {
      throw new Error('No portal found for this dungeon');
    }

    return prisma.mapConnection.delete({
      where: { id: existing.id },
    });
  }

  async create(data: {
    nom: string;
    description?: string;
    regionId: number;
    niveauMin?: number;
    niveauMax?: number;
    bossId: number;
    salles: { ordre: number; mapId: number }[];
  }) {
    return prisma.donjon.create({
      data: {
        nom: data.nom,
        description: data.description,
        regionId: data.regionId,
        niveauMin: data.niveauMin ?? 1,
        niveauMax: data.niveauMax ?? 5,
        bossId: data.bossId,
        salles: {
          create: data.salles,
        },
      },
      include: {
        region: true,
        boss: true,
        salles: { orderBy: { ordre: 'asc' }, include: { map: true } },
      },
    });
  }

  async update(id: number, data: Partial<{
    nom: string;
    description: string | null;
    regionId: number;
    niveauMin: number;
    niveauMax: number;
    bossId: number;
    salles: { ordre: number; mapId: number }[];
  }>) {
    const { salles, ...donjonData } = data;

    if (salles && salles.length > 0) {
      // Delete existing salles and recreate
      await prisma.donjonSalle.deleteMany({ where: { donjonId: id } });
      await prisma.donjonSalle.createMany({
        data: salles.map(s => ({ donjonId: id, ordre: s.ordre, mapId: s.mapId })),
      });
    }

    return prisma.donjon.update({
      where: { id },
      data: donjonData,
      include: {
        region: true,
        boss: true,
        salles: { orderBy: { ordre: 'asc' }, include: { map: true } },
      },
    });
  }

  async delete(id: number) {
    // Delete portal connections
    await prisma.mapConnection.deleteMany({ where: { donjonId: id } });
    // DonjonSalle has onDelete: Cascade, so we just need to handle runs
    await prisma.donjonRun.deleteMany({ where: { donjonId: id } });
    return prisma.donjon.delete({ where: { id } });
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
   * Get dungeon by ID (includes portails and compositions per salle)
   */
  async findById(id: number) {
    return prisma.donjon.findUnique({
      where: { id },
      include: {
        region: true,
        boss: true,
        portails: true,
        salles: {
          orderBy: { ordre: 'asc' },
          include: {
            map: true,
            compositions: {
              include: { monstre: true },
              orderBy: [{ difficulte: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });
  }

  // ──────────────────────── COMPOSITIONS CRUD ────────────────────────

  async getCompositions(salleId: number) {
    return prisma.donjonSalleComposition.findMany({
      where: { salleId },
      include: { monstre: true },
      orderBy: [{ difficulte: 'asc' }, { id: 'asc' }],
    });
  }

  async createComposition(salleId: number, data: {
    difficulte: number;
    monstreTemplateId: number;
    niveau: number;
    quantite: number;
  }) {
    // Verify salle exists
    const salle = await prisma.donjonSalle.findUnique({ where: { id: salleId } });
    if (!salle) throw new Error('Dungeon room not found');
    if (![4, 6, 8].includes(data.difficulte)) throw new Error('Difficulty must be 4, 6, or 8');

    return prisma.donjonSalleComposition.create({
      data: { salleId, ...data },
      include: { monstre: true },
    });
  }

  async updateComposition(id: number, data: Partial<{
    difficulte: number;
    monstreTemplateId: number;
    niveau: number;
    quantite: number;
  }>) {
    if (data.difficulte !== undefined && ![4, 6, 8].includes(data.difficulte)) {
      throw new Error('Difficulty must be 4, 6, or 8');
    }
    return prisma.donjonSalleComposition.update({
      where: { id },
      data,
      include: { monstre: true },
    });
  }

  async deleteComposition(id: number) {
    return prisma.donjonSalleComposition.delete({ where: { id } });
  }
}

export const donjonService = new DonjonService();
