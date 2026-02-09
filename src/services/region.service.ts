import prisma from '../config/database';

export class RegionService {
  async findAll() {
    return prisma.region.findMany({
      include: {
        maps: {
          select: {
            id: true,
            nom: true,
            type: true,
            combatMode: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    return prisma.region.findUnique({
      where: { id },
      include: {
        maps: {
          include: {
            connectionsFrom: {
              include: {
                toMap: {
                  select: { id: true, nom: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async create(data: {
    nom: string;
    description?: string;
    type: 'FORET' | 'PLAINE' | 'DESERT' | 'MONTAGNE' | 'MARAIS' | 'CAVERNE' | 'CITE';
    niveauMin?: number;
    niveauMax?: number;
  }) {
    return prisma.region.create({
      data: {
        nom: data.nom,
        description: data.description,
        type: data.type,
        niveauMin: data.niveauMin ?? 1,
        niveauMax: data.niveauMax ?? 10,
      },
    });
  }
  async update(id: number, data: Partial<{
    nom: string;
    description: string | null;
    type: 'FORET' | 'PLAINE' | 'DESERT' | 'MONTAGNE' | 'MARAIS' | 'CAVERNE' | 'CITE';
    niveauMin: number;
    niveauMax: number;
  }>) {
    return prisma.region.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    await prisma.regionMonstre.deleteMany({ where: { regionId: id } });
    return prisma.region.delete({ where: { id } });
  }
}

export const regionService = new RegionService();
