import prisma from '../config/database';

export class MonstreService {
  async findAll() {
    return prisma.monstreTemplate.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    return prisma.monstreTemplate.findUnique({
      where: { id },
      include: {
        spawns: {
          include: {
            map: {
              select: { id: true, nom: true },
            },
          },
        },
      },
    });
  }

  async create(data: {
    nom: string;
    force: number;
    intelligence: number;
    dexterite: number;
    agilite: number;
    vie: number;
    chance: number;
    pvBase: number;
    paBase?: number;
    pmBase?: number;
    niveauBase?: number;
    xpRecompense?: number;
  }) {
    return prisma.monstreTemplate.create({
      data: {
        nom: data.nom,
        force: data.force,
        intelligence: data.intelligence,
        dexterite: data.dexterite,
        agilite: data.agilite,
        vie: data.vie,
        chance: data.chance,
        pvBase: data.pvBase,
        paBase: data.paBase ?? 6,
        pmBase: data.pmBase ?? 3,
        niveauBase: data.niveauBase ?? 1,
        xpRecompense: data.xpRecompense ?? 10,
      },
    });
  }

  async update(id: number, data: Partial<{
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
  }>) {
    return prisma.monstreTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    // First delete related spawns
    await prisma.zoneSpawn.deleteMany({
      where: { monstreId: id },
    });

    // Then delete related map enemies
    await prisma.mapEnnemi.deleteMany({
      where: { monstreId: id },
    });

    return prisma.monstreTemplate.delete({
      where: { id },
    });
  }
}

export const monstreService = new MonstreService();
