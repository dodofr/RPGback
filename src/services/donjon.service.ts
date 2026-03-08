import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { randomInt } from '../utils/random';

type DonjonActor = { groupeId: number; personnageId?: never } | { personnageId: number; groupeId?: never };

export class DonjonService {
  /** Helper: get character IDs for a run (group members or solo char) */
  private async getRunMemberIds(run: { groupeId: number | null; personnageId: number | null }): Promise<number[]> {
    if (run.groupeId) {
      const members = await prisma.groupePersonnage.findMany({ where: { groupeId: run.groupeId } });
      return members.map(m => m.personnageId);
    }
    if (run.personnageId) return [run.personnageId];
    return [];
  }

  /**
   * Enter a dungeon with a group or a solo character
   */
  async enterDungeon(donjonId: number, actor: DonjonActor, difficulte: number) {
    if (![4, 6, 8].includes(difficulte)) throw new Error('Difficulty must be 4, 6, or 8');

    const isGroup = actor.groupeId !== undefined;
    let memberIds: number[] = [];
    let existingRun: { id: number; termine: boolean } | null = null;
    let mapOrigineId: number | null = null;

    if (isGroup) {
      const groupe = await prisma.groupe.findUnique({
        where: { id: actor.groupeId! },
        include: { personnages: { include: { personnage: true } }, donjonRun: true },
      });
      if (!groupe) throw new Error('Group not found');
      if (groupe.personnages.length === 0) throw new Error('Group has no characters');
      if (groupe.donjonRun && !groupe.donjonRun.termine) throw new Error('Group already has an active dungeon run');
      memberIds = groupe.personnages.map(gp => gp.personnage.id);
      existingRun = groupe.donjonRun ?? null;
      const leaderChar = await prisma.personnage.findUnique({ where: { id: groupe.leaderId ?? 0 } });
      mapOrigineId = leaderChar?.mapId ?? null;
    } else {
      const char = await prisma.personnage.findUnique({
        where: { id: actor.personnageId! },
        include: { donjonRunSolo: true },
      });
      if (!char) throw new Error('Character not found');
      if (char.donjonRunSolo && !char.donjonRunSolo.termine) throw new Error('Character already has an active dungeon run');
      memberIds = [actor.personnageId!];
      existingRun = char.donjonRunSolo ?? null;
      mapOrigineId = char.mapId ?? null;
    }

    const donjon = await prisma.donjon.findUnique({
      where: { id: donjonId },
      include: { salles: { orderBy: { ordre: 'asc' }, include: { map: true } }, boss: true, region: true },
    });
    if (!donjon) throw new Error('Dungeon not found');
    if (donjon.salles.length < 4) throw new Error('Dungeon is not properly configured (needs 4 rooms)');
    if (existingRun) await prisma.donjonRun.delete({ where: { id: existingRun.id } });

    const firstRoom = donjon.salles.find(s => s.ordre === 1);
    if (!firstRoom) throw new Error('First room not found');

    const run = await prisma.donjonRun.create({
      data: {
        donjonId,
        groupeId: isGroup ? actor.groupeId! : null,
        personnageId: !isGroup ? actor.personnageId! : null,
        salleActuelle: 1,
        difficulte,
        termine: false,
        victoire: null,
        mapOrigineId,
      },
    });

    await prisma.personnage.updateMany({
      where: { id: { in: memberIds } },
      data: {
        mapId: firstRoom.mapId,
        positionX: Math.floor(firstRoom.map.largeur * 0.1),
        positionY: Math.floor(firstRoom.map.hauteur / 2),
      },
    });
    if (isGroup) {
      const grp = await prisma.groupe.findUnique({ where: { id: actor.groupeId! }, select: { leaderId: true } });
      await prisma.groupe.update({ where: { id: actor.groupeId! }, data: { leaderId: grp?.leaderId } });
    }

    const groupeEnnemi = await this.spawnDungeonGroupeEnnemi(run.id);
    const updatedRun = await prisma.donjonRun.findUnique({
      where: { id: run.id },
      include: {
        donjon: { include: { salles: { orderBy: { ordre: 'asc' }, include: { map: true } }, boss: true } },
        groupe: { include: { personnages: { include: { personnage: { include: { map: true } } } }, leader: { include: { map: true } } } },
        personnage: { include: { map: true } },
      },
    });
    return { run: updatedRun, salle: firstRoom, groupeEnnemi };
  }

  /**
   * Advance to the next room after winning a combat
   */
  async advanceToNextRoom(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: {
        donjon: { include: { salles: { orderBy: { ordre: 'asc' }, include: { map: true } }, boss: true } },
        groupe: true,
      },
    });
    if (!run) throw new Error('Dungeon run not found');
    if (run.termine) throw new Error('Dungeon run is already finished');

    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (currentRoom) await this.cleanupDungeonEnemies(currentRoom.mapId);

    const nextRoomNumber = run.salleActuelle + 1;
    if (nextRoomNumber > 4) {
      await prisma.donjonRun.update({
        where: { id: runId },
        data: { termine: true, victoire: true, combatActuel: null, monstresCaches: Prisma.DbNull },
      });
      const memberIds = await this.getRunMemberIds(run);
      await prisma.personnage.updateMany({
        where: { id: { in: memberIds } },
        data: { mapId: run.mapOrigineId ?? null, positionX: 0, positionY: 0 },
      });
      return { completed: true, victoire: true, message: 'Dungeon completed! Congratulations!' };
    }

    const nextRoom = run.donjon.salles.find(s => s.ordre === nextRoomNumber);
    if (!nextRoom) throw new Error(`Room ${nextRoomNumber} not found`);

    await prisma.donjonRun.update({
      where: { id: runId },
      data: { salleActuelle: nextRoomNumber, combatActuel: null, monstresCaches: Prisma.DbNull },
    });
    const memberIds = await this.getRunMemberIds(run);
    await prisma.personnage.updateMany({
      where: { id: { in: memberIds } },
      data: {
        mapId: nextRoom.mapId,
        positionX: Math.floor(nextRoom.map.largeur * 0.1),
        positionY: Math.floor(nextRoom.map.hauteur / 2),
      },
    });

    const groupeEnnemi = await this.spawnDungeonGroupeEnnemi(runId);
    return { completed: false, salleActuelle: nextRoomNumber, salle: nextRoom, groupeEnnemi, message: `Advanced to room ${nextRoomNumber}` };
  }

  /**
   * Spawn a visible GroupeEnnemi on the current dungeon room map
   */
  async spawnDungeonGroupeEnnemi(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: { donjon: { include: { salles: { orderBy: { ordre: 'asc' }, include: { map: true } }, boss: true, region: true } } },
    });
    if (!run) throw new Error('Dungeon run not found');
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (!currentRoom) throw new Error(`Room ${run.salleActuelle} not found`);

    const isBoss = run.salleActuelle === 4;
    const monstres = await this.spawnDungeonEnemies(run.donjon, run.difficulte, isBoss, currentRoom.id);
    await this.cleanupDungeonEnemies(currentRoom.mapId);

    const monstreGroups = new Map<string, { monstreTemplateId: number; niveau: number; count: number }>();
    for (const m of monstres) {
      const key = `${m.monstreTemplateId}-${m.niveau}`;
      const existing = monstreGroups.get(key);
      if (existing) existing.count++;
      else monstreGroups.set(key, { monstreTemplateId: m.monstreTemplateId, niveau: m.niveau, count: 1 });
    }

    const posX = Math.floor(currentRoom.map.largeur * 0.8);
    const posY = Math.floor(currentRoom.map.hauteur / 2);
    const groupeEnnemi = await prisma.groupeEnnemi.create({ data: { mapId: currentRoom.mapId, positionX: posX, positionY: posY } });
    for (const group of monstreGroups.values()) {
      await prisma.groupeEnnemiMembre.create({
        data: { groupeEnnemiId: groupeEnnemi.id, monstreId: group.monstreTemplateId, quantite: group.count, niveau: group.niveau },
      });
    }
    await prisma.donjonRun.update({ where: { id: runId }, data: { monstresCaches: monstres as unknown as any } });
    return prisma.groupeEnnemi.findUnique({ where: { id: groupeEnnemi.id }, include: { membres: { include: { monstre: true } } } });
  }

  async cleanupDungeonEnemies(mapId: number) {
    const groups = await prisma.groupeEnnemi.findMany({ where: { mapId } });
    for (const g of groups) await prisma.groupeEnnemiMembre.deleteMany({ where: { groupeEnnemiId: g.id } });
    await prisma.groupeEnnemi.deleteMany({ where: { mapId } });
  }

  private async spawnDungeonEnemies(
    donjon: {
      niveauMin: number; niveauMax: number; bossId?: number;
      boss: { id: number; nom: string; force: number; intelligence: number; dexterite: number; agilite: number; vie: number; chance: number; pvBase: number; paBase: number; pmBase: number; niveauBase: number; xpRecompense: number; iaType?: string };
      region: { id: number; niveauMax: number };
    },
    difficulte: number, isBoss: boolean, salleId?: number
  ) {
    const monstres: {
      nom: string; force: number; intelligence: number; dexterite: number; agilite: number;
      vie: number; chance: number; pvMax: number; paMax: number; pmMax: number;
      monstreTemplateId: number; niveau: number; iaType?: string;
    }[] = [];

    if (salleId) {
      const compositions = await prisma.donjonSalleComposition.findMany({ where: { salleId, difficulte }, include: { monstre: true } });
      if (compositions.length > 0) {
        let entryIndex = 1;
        for (const comp of compositions) {
          const template = comp.monstre; const niveau = comp.niveau;
          const sf = Math.max(1, 1 + (niveau - template.niveauBase) * 0.1);
          const isBossEntry = template.id === donjon.boss.id; const bossBoost = isBossEntry ? 1.5 : 1;
          for (let j = 0; j < comp.quantite; j++) {
            const suffix = comp.quantite > 1 ? ` ${entryIndex}` : '';
            const nom = isBossEntry ? `${template.nom} (Boss)` : `${template.nom}${suffix}`;
            monstres.push({ nom, force: Math.floor(template.force * sf * bossBoost), intelligence: Math.floor(template.intelligence * sf * bossBoost), dexterite: Math.floor(template.dexterite * sf * bossBoost), agilite: Math.floor(template.agilite * sf * bossBoost), vie: Math.floor(template.vie * sf * bossBoost), chance: Math.floor(template.chance * sf * bossBoost), pvMax: Math.floor(template.pvBase * sf * bossBoost), paMax: template.paBase, pmMax: template.pmBase, monstreTemplateId: template.id, niveau, iaType: template.iaType });
            if (!isBossEntry) entryIndex++;
          }
        }
        return monstres;
      }
    }

    const regionMonstres = await prisma.regionMonstre.findMany({ where: { regionId: donjon.region.id }, include: { monstre: true } });
    if (regionMonstres.length === 0) throw new Error('No monsters configured for this region');
    const totalWeight = regionMonstres.reduce((sum, rm) => sum + rm.probabilite, 0);

    if (isBoss) {
      const boss = donjon.boss; const bossNiveau = donjon.region.niveauMax + randomInt(5, 10);
      const sf = 1 + (bossNiveau - boss.niveauBase) * 0.1; const bossBoost = 1.5;
      monstres.push({ nom: `${boss.nom} (Boss)`, force: Math.floor(boss.force * sf * bossBoost), intelligence: Math.floor(boss.intelligence * sf * bossBoost), dexterite: Math.floor(boss.dexterite * sf * bossBoost), agilite: Math.floor(boss.agilite * sf * bossBoost), vie: Math.floor(boss.vie * sf * bossBoost), chance: Math.floor(boss.chance * sf * bossBoost), pvMax: Math.floor(boss.pvBase * sf * bossBoost), paMax: boss.paBase, pmMax: boss.pmBase, monstreTemplateId: boss.id, niveau: bossNiveau, iaType: boss.iaType });
      const regularCount = difficulte - 1;
      if (regularCount > 0) {
        const numTypes = Math.min(randomInt(1, 4), regionMonstres.length); let remaining = regularCount;
        for (let i = 0; i < numTypes && remaining > 0; i++) {
          let roll = Math.random() * totalWeight; let selected = regionMonstres[0];
          for (const rm of regionMonstres) { roll -= rm.probabilite; if (roll <= 0) { selected = rm; break; } }
          const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
          const t = selected.monstre; const niv = donjon.region.niveauMax; const s = 1 + (niv - t.niveauBase) * 0.1;
          for (let j = 0; j < count; j++) monstres.push({ nom: count > 1 ? `${t.nom} ${monstres.length + 1}` : t.nom, force: Math.floor(t.force * s), intelligence: Math.floor(t.intelligence * s), dexterite: Math.floor(t.dexterite * s), agilite: Math.floor(t.agilite * s), vie: Math.floor(t.vie * s), chance: Math.floor(t.chance * s), pvMax: Math.floor(t.pvBase * s), paMax: t.paBase, pmMax: t.pmBase, monstreTemplateId: t.id, niveau: niv, iaType: t.iaType });
          remaining -= count;
        }
      }
    } else {
      const niv = donjon.region.niveauMax; let remaining = difficulte;
      const numTypes = Math.min(randomInt(1, 4), regionMonstres.length);
      for (let i = 0; i < numTypes && remaining > 0; i++) {
        let roll = Math.random() * totalWeight; let selected = regionMonstres[0];
        for (const rm of regionMonstres) { roll -= rm.probabilite; if (roll <= 0) { selected = rm; break; } }
        const count = i === numTypes - 1 ? remaining : randomInt(1, remaining);
        const t = selected.monstre; const s = 1 + (niv - t.niveauBase) * 0.1;
        for (let j = 0; j < count; j++) monstres.push({ nom: count > 1 ? `${t.nom} ${monstres.length + 1}` : t.nom, force: Math.floor(t.force * s), intelligence: Math.floor(t.intelligence * s), dexterite: Math.floor(t.dexterite * s), agilite: Math.floor(t.agilite * s), vie: Math.floor(t.vie * s), chance: Math.floor(t.chance * s), pvMax: Math.floor(t.pvBase * s), paMax: t.paBase, pmMax: t.pmBase, monstreTemplateId: t.id, niveau: niv, iaType: t.iaType });
        remaining -= count;
      }
    }
    return monstres;
  }

  async failDungeon(runId: number) {
    const run = await prisma.donjonRun.findUnique({
      where: { id: runId },
      include: { groupe: true, donjon: { include: { salles: { orderBy: { ordre: 'asc' } } } } },
    });
    if (!run) throw new Error('Dungeon run not found');
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (currentRoom) await this.cleanupDungeonEnemies(currentRoom.mapId);
    await prisma.donjonRun.update({ where: { id: runId }, data: { termine: true, victoire: false, combatActuel: null, monstresCaches: Prisma.DbNull } });
    const memberIds = await this.getRunMemberIds(run);
    await prisma.personnage.updateMany({ where: { id: { in: memberIds } }, data: { mapId: run.mapOrigineId ?? null, positionX: 0, positionY: 0 } });
    return { success: true, message: 'Dungeon run failed. Ejected to origin map.' };
  }

  async abandonDungeon(actor: DonjonActor) {
    const where = actor.groupeId !== undefined
      ? { groupeId: actor.groupeId as number, termine: false }
      : { personnageId: actor.personnageId as number, termine: false };
    const run = await prisma.donjonRun.findFirst({ where, include: { donjon: { include: { salles: { orderBy: { ordre: 'asc' } } } } } });
    if (!run) throw new Error('No active dungeon run found');

    if (run.combatActuel) {
      const combat = await prisma.combat.findUnique({ where: { id: run.combatActuel } });
      if (combat && combat.status === 'EN_COURS') {
        await prisma.combat.update({ where: { id: run.combatActuel }, data: { status: 'ABANDONNE' } });
        await prisma.effetActif.deleteMany({ where: { combatId: run.combatActuel } });
        await prisma.sortCooldown.deleteMany({ where: { combatId: run.combatActuel } });
        await prisma.combatEntite.updateMany({ where: { combatId: run.combatActuel, invocateurId: { not: null }, pvActuels: { gt: 0 } }, data: { pvActuels: 0 } });
      }
    }
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    if (currentRoom) await this.cleanupDungeonEnemies(currentRoom.mapId);
    await prisma.donjonRun.update({ where: { id: run.id }, data: { termine: true, victoire: false, combatActuel: null, monstresCaches: Prisma.DbNull } });
    const memberIds = await this.getRunMemberIds(run);
    await prisma.personnage.updateMany({ where: { id: { in: memberIds } }, data: { mapId: run.mapOrigineId ?? null, positionX: 0, positionY: 0 } });
    return { success: true, message: 'Dungeon run abandoned.' };
  }

  async getDungeonState(actor: DonjonActor) {
    const where = actor.groupeId !== undefined
      ? { groupeId: actor.groupeId as number, termine: false }
      : { personnageId: actor.personnageId as number, termine: false };
    const run = await prisma.donjonRun.findFirst({
      where,
      include: {
        donjon: { include: { salles: { orderBy: { ordre: 'asc' }, include: { map: true } }, boss: true, region: true } },
        groupe: { include: { personnages: { include: { personnage: { include: { map: true } } } }, leader: { include: { map: true } } } },
        personnage: { include: { map: true } },
      },
    });
    if (!run) return null;
    const currentRoom = run.donjon.salles.find(s => s.ordre === run.salleActuelle);
    let groupeEnnemi = null;
    if (currentRoom) {
      groupeEnnemi = await prisma.groupeEnnemi.findFirst({ where: { mapId: currentRoom.mapId, vaincu: false }, include: { membres: { include: { monstre: true } } } });
    }
    return {
      run: { id: run.id, donjonId: run.donjonId, groupeId: run.groupeId, personnageId: run.personnageId, salleActuelle: run.salleActuelle, difficulte: run.difficulte, termine: run.termine, victoire: run.victoire, combatActuel: run.combatActuel },
      donjon: run.donjon, salle: currentRoom, groupe: run.groupe ?? null, personnage: run.personnage ?? null, groupeEnnemi,
    };
  }

  async getRunByCombatId(combatId: number) {
    return prisma.donjonRun.findFirst({ where: { combatActuel: combatId, termine: false } });
  }

  async setPortail(donjonId: number, data: { fromMapId: number; positionX: number; positionY: number; nom?: string }) {
    const donjon = await prisma.donjon.findUnique({ where: { id: donjonId }, include: { salles: { orderBy: { ordre: 'asc' } } } });
    if (!donjon) throw new Error('Dungeon not found');
    const firstRoom = donjon.salles.find(s => s.ordre === 1);
    if (!firstRoom) throw new Error('Dungeon has no rooms configured');
    const nom = data.nom ?? "Entr\u00e9e du donjon";
    const existing = await prisma.mapConnection.findFirst({ where: { donjonId } });
    const include = { donjon: { select: { id: true, nom: true, description: true, niveauMin: true, niveauMax: true } } };
    if (existing) {
      return prisma.mapConnection.update({ where: { id: existing.id }, data: { fromMapId: data.fromMapId, toMapId: firstRoom.mapId, positionX: data.positionX, positionY: data.positionY, nom }, include });
    }
    return prisma.mapConnection.create({ data: { fromMapId: data.fromMapId, toMapId: firstRoom.mapId, positionX: data.positionX, positionY: data.positionY, nom, donjonId }, include });
  }

  async deletePortail(donjonId: number) {
    const existing = await prisma.mapConnection.findFirst({ where: { donjonId } });
    if (!existing) throw new Error('No portal found for this dungeon');
    return prisma.mapConnection.delete({ where: { id: existing.id } });
  }

  async create(data: { nom: string; description?: string; regionId: number; niveauMin?: number; niveauMax?: number; bossId: number; salles: { ordre: number; mapId: number }[] }) {
    return prisma.donjon.create({
      data: { nom: data.nom, description: data.description, regionId: data.regionId, niveauMin: data.niveauMin ?? 1, niveauMax: data.niveauMax ?? 5, bossId: data.bossId, salles: { create: data.salles } },
      include: { region: true, boss: true, salles: { orderBy: { ordre: 'asc' }, include: { map: true } } },
    });
  }

  async update(id: number, data: Partial<{ nom: string; description: string | null; regionId: number; niveauMin: number; niveauMax: number; bossId: number; salles: { ordre: number; mapId: number }[] }>) {
    const { salles, ...donjonData } = data;
    if (salles && salles.length > 0) {
      await prisma.donjonSalle.deleteMany({ where: { donjonId: id } });
      await prisma.donjonSalle.createMany({ data: salles.map(s => ({ donjonId: id, ordre: s.ordre, mapId: s.mapId })) });
    }
    return prisma.donjon.update({ where: { id }, data: donjonData, include: { region: true, boss: true, salles: { orderBy: { ordre: 'asc' }, include: { map: true } } } });
  }

  async delete(id: number) {
    await prisma.mapConnection.deleteMany({ where: { donjonId: id } });
    await prisma.donjonRun.deleteMany({ where: { donjonId: id } });
    return prisma.donjon.delete({ where: { id } });
  }

  async findAll() {
    return prisma.donjon.findMany({
      include: { region: true, boss: true, salles: { orderBy: { ordre: 'asc' }, include: { map: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    return prisma.donjon.findUnique({
      where: { id },
      include: { region: true, boss: true, portails: true, salles: { orderBy: { ordre: 'asc' }, include: { map: true, compositions: { include: { monstre: true }, orderBy: [{ difficulte: 'asc' }, { id: 'asc' }] } } } },
    });
  }

  async getCompositions(salleId: number) {
    return prisma.donjonSalleComposition.findMany({ where: { salleId }, include: { monstre: true }, orderBy: [{ difficulte: 'asc' }, { id: 'asc' }] });
  }

  async createComposition(salleId: number, data: { difficulte: number; monstreTemplateId: number; niveau: number; quantite: number }) {
    const salle = await prisma.donjonSalle.findUnique({ where: { id: salleId } });
    if (!salle) throw new Error('Dungeon room not found');
    if (![4, 6, 8].includes(data.difficulte)) throw new Error('Difficulty must be 4, 6, or 8');
    return prisma.donjonSalleComposition.create({ data: { salleId, ...data }, include: { monstre: true } });
  }

  async updateComposition(id: number, data: Partial<{ difficulte: number; monstreTemplateId: number; niveau: number; quantite: number }>) {
    if (data.difficulte !== undefined && ![4, 6, 8].includes(data.difficulte)) throw new Error('Difficulty must be 4, 6, or 8');
    return prisma.donjonSalleComposition.update({ where: { id }, data, include: { monstre: true } });
  }

  async deleteComposition(id: number) {
    return prisma.donjonSalleComposition.delete({ where: { id } });
  }
}

export const donjonService = new DonjonService();
