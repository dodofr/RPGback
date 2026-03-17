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
        regions: {
          include: {
            region: {
              select: { id: true, nom: true },
            },
          },
        },
        sorts: {
          include: {
            sort: true,
          },
          orderBy: { priorite: 'asc' },
        },
        drops: {
          include: {
            ressource: true,
            equipement: true,
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
    orMin?: number;
    orMax?: number;
    iaType?: 'EQUILIBRE' | 'AGGRESSIF' | 'SOUTIEN' | 'DISTANCE';
    pvScalingInvocation?: number | null;
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
        orMin: data.orMin ?? 0,
        orMax: data.orMax ?? 0,
        iaType: data.iaType ?? 'EQUILIBRE',
        pvScalingInvocation: data.pvScalingInvocation ?? null,
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
    orMin: number;
    orMax: number;
    iaType: 'EQUILIBRE' | 'AGGRESSIF' | 'SOUTIEN' | 'DISTANCE';
    pvScalingInvocation: number | null;
    imageUrl: string | null;
  }>) {
    return prisma.monstreTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    // Delete related region-monster links
    await prisma.regionMonstre.deleteMany({
      where: { monstreId: id },
    });

    // Delete related monster-spell links
    await prisma.monstreSort.deleteMany({
      where: { monstreId: id },
    });

    return prisma.monstreTemplate.delete({
      where: { id },
    });
  }
}

export const monstreService = new MonstreService();
