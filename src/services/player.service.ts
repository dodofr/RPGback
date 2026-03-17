import prisma from '../config/database';
import { CreatePlayerRequest } from '../types';

export class PlayerService {
  async create(data: CreatePlayerRequest) {
    return prisma.joueur.create({
      data: {
        nom: data.nom,
      },
    });
  }

  async findById(id: number) {
    return prisma.joueur.findUnique({
      where: { id },
    });
  }

  async findAll() {
    return prisma.joueur.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCharacters(joueurId: number) {
    const chars = await prisma.personnage.findMany({
      where: { joueurId },
      include: { race: true },
    });
    return chars.map(c => ({
      ...c,
      imageUrl: c.sexe === 'FEMME'
        ? (c.race?.imageUrlFemme ?? c.race?.imageUrlHomme ?? null)
        : (c.race?.imageUrlHomme ?? null),
    }));
  }

  async getGroups(joueurId: number) {
    return prisma.groupe.findMany({
      where: { joueurId },
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

  async update(id: number, data: { nom?: string }) {
    return prisma.joueur.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return prisma.joueur.delete({
      where: { id },
    });
  }
}

export const playerService = new PlayerService();
