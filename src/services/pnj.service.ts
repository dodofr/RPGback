import prisma from '../config/database';
import { inventoryService } from './inventory.service';
import { familierService } from './familier.service';

const PNJ_INCLUDE = {
  lignes: {
    include: {
      equipement: { select: { id: true, nom: true, slot: true, poids: true } },
      ressource: { select: { id: true, nom: true, poids: true } },
      familierRace: { select: { id: true, nom: true, imageUrl: true } },
    },
  },
  dialogues: { orderBy: { ordre: 'asc' as const } },
  metiers: { include: { metier: true } },
};

export class PNJService {
  async getAll() {
    return prisma.pNJ.findMany({
      include: { ...PNJ_INCLUDE, map: { select: { id: true, nom: true, type: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async getByMap(mapId: number) {
    return prisma.pNJ.findMany({
      where: { mapId },
      include: PNJ_INCLUDE,
    });
  }

  async getById(id: number) {
    return prisma.pNJ.findUnique({
      where: { id },
      include: {
        ...PNJ_INCLUDE,
        map: { select: { id: true, nom: true, type: true } },
        quetesDepart: { select: { id: true, nom: true, niveauRequis: true } },
      },
    });
  }

  async create(data: { nom: string; mapId: number; positionX: number; positionY: number; description?: string | null; estMarchand?: boolean }) {
    return prisma.pNJ.create({ data, include: PNJ_INCLUDE });
  }

  async update(id: number, data: Partial<{ nom: string; mapId: number; positionX: number; positionY: number; description: string | null; estMarchand: boolean; imageUrl: string | null }>) {
    return prisma.pNJ.update({ where: { id }, data, include: PNJ_INCLUDE });
  }

  async delete(id: number) {
    return prisma.pNJ.delete({ where: { id } });
  }

  async addLigne(pnjId: number, data: { equipementId?: number | null; ressourceId?: number | null; familierRaceId?: number | null; prixMarchand?: number | null; prixRachat?: number | null }) {
    const filled = [data.equipementId, data.ressourceId, data.familierRaceId].filter(Boolean).length;
    if (filled === 0) {
      throw new Error('equipementId, ressourceId ou familierRaceId requis');
    }
    if (filled > 1) {
      throw new Error('Un seul parmi equipementId, ressourceId, familierRaceId à la fois');
    }
    return prisma.marchandLigne.create({
      data: { pnjId, ...data },
      include: {
        equipement: { select: { id: true, nom: true, slot: true } },
        ressource: { select: { id: true, nom: true } },
        familierRace: { select: { id: true, nom: true } },
      },
    });
  }

  async updateLigne(ligneId: number, data: Partial<{ prixMarchand: number | null; prixRachat: number | null }>) {
    return prisma.marchandLigne.update({
      where: { id: ligneId },
      data,
      include: {
        equipement: { select: { id: true, nom: true, slot: true } },
        ressource: { select: { id: true, nom: true } },
        familierRace: { select: { id: true, nom: true } },
      },
    });
  }

  async deleteLigne(ligneId: number) {
    return prisma.marchandLigne.delete({ where: { id: ligneId } });
  }

  async addDialogue(pnjId: number, data: { type: string; texte: string; ordre?: number; queteId?: number | null; etapeOrdre?: number | null }) {
    return prisma.pNJDialogue.create({ data: { pnjId, type: data.type as any, texte: data.texte, ordre: data.ordre ?? 0, queteId: data.queteId ?? null, etapeOrdre: data.etapeOrdre ?? null } });
  }

  async updateDialogue(dialogueId: number, data: { type?: string; texte?: string; ordre?: number; queteId?: number | null; etapeOrdre?: number | null }) {
    return prisma.pNJDialogue.update({ where: { id: dialogueId }, data: { ...data, type: data.type as any } });
  }

  async deleteDialogue(dialogueId: number) {
    return prisma.pNJDialogue.delete({ where: { id: dialogueId } });
  }

  async buyFromMerchant(pnjId: number, personnageId: number, ligneId: number, quantite: number = 1) {
    const pnj = await prisma.pNJ.findUnique({ where: { id: pnjId } });
    if (!pnj) throw new Error('PNJ not found');

    const ligne = await prisma.marchandLigne.findUnique({
      where: { id: ligneId },
      include: {
        equipement: true,
        ressource: true,
        familierRace: true,
      },
    });
    if (!ligne || ligne.pnjId !== pnjId) throw new Error('Ligne not found');
    if (ligne.prixMarchand === null || ligne.prixMarchand === undefined) throw new Error('Cet article n\'est pas en vente');

    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    const coutTotal = ligne.prixMarchand * quantite;
    if (personnage.or < coutTotal) throw new Error('Or insuffisant');

    if (ligne.familierRaceId && ligne.familierRace) {
      // Acheter un familier
      const familier = await familierService.createFamilier(personnageId, ligne.familierRaceId);
      await prisma.personnage.update({ where: { id: personnageId }, data: { or: { decrement: ligne.prixMarchand } } });
      return { familier, orRestant: personnage.or - ligne.prixMarchand };
    } else if (ligne.equipementId && ligne.equipement) {
      // Acheter un équipement (1 seul à la fois)
      const item = await inventoryService.addItem(personnageId, ligne.equipementId);
      await prisma.personnage.update({ where: { id: personnageId }, data: { or: { decrement: ligne.prixMarchand } } });
      return { item, orRestant: personnage.or - ligne.prixMarchand };
    } else if (ligne.ressourceId && ligne.ressource) {
      // Acheter des ressources
      const poids = ligne.ressource.poids * quantite;
      // Check weight
      const inv = await prisma.personnage.findUnique({ where: { id: personnageId } });
      if (!inv) throw new Error('Character not found');

      // Calculate current weight
      const items = await prisma.inventaireItem.findMany({
        where: { personnageId },
        include: { equipement: { select: { poids: true } } },
      });
      const resources = await prisma.inventaireRessource.findMany({
        where: { personnageId },
        include: { ressource: { select: { poids: true } } },
      });
      const poidsActuel = items.reduce((s, i) => s + i.equipement.poids, 0)
        + resources.reduce((s, r) => s + r.ressource.poids * r.quantite, 0);

      if (poidsActuel + poids > inv.poidsMaxInventaire) {
        throw new Error('Inventaire plein');
      }

      await prisma.inventaireRessource.upsert({
        where: { personnageId_ressourceId: { personnageId, ressourceId: ligne.ressourceId } },
        update: { quantite: { increment: quantite } },
        create: { personnageId, ressourceId: ligne.ressourceId, quantite },
      });
      await prisma.personnage.update({ where: { id: personnageId }, data: { or: { decrement: coutTotal } } });
      return { ressourceId: ligne.ressourceId, quantite, orRestant: personnage.or - coutTotal };
    }

    throw new Error('Ligne invalide');
  }

  async sellToMerchant(pnjId: number, personnageId: number, ligneId: number, quantite: number = 1, itemId?: number) {
    const pnj = await prisma.pNJ.findUnique({ where: { id: pnjId } });
    if (!pnj) throw new Error('PNJ not found');

    const ligne = await prisma.marchandLigne.findUnique({ where: { id: ligneId } });
    if (!ligne || ligne.pnjId !== pnjId) throw new Error('Ligne not found');
    if (ligne.prixRachat === null || ligne.prixRachat === undefined) throw new Error('Ce marchand n\'achète pas cet article');

    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    if (ligne.equipementId && itemId) {
      // Vendre un équipement (instance)
      const item = await prisma.inventaireItem.findUnique({ where: { id: itemId } });
      if (!item || item.personnageId !== personnageId) throw new Error('Item not found in inventory');
      if (item.equipementId !== ligne.equipementId) throw new Error('Cet item ne correspond pas à la ligne');
      if (item.estEquipe) throw new Error('Déséquipez l\'item avant de le vendre');

      await prisma.inventaireItem.delete({ where: { id: itemId } });
      await prisma.personnage.update({ where: { id: personnageId }, data: { or: { increment: ligne.prixRachat } } });
      return { orGagne: ligne.prixRachat, orRestant: personnage.or + ligne.prixRachat };
    } else if (ligne.ressourceId) {
      // Vendre des ressources
      const stock = await prisma.inventaireRessource.findUnique({
        where: { personnageId_ressourceId: { personnageId, ressourceId: ligne.ressourceId } },
      });
      if (!stock || stock.quantite < quantite) throw new Error('Ressources insuffisantes en inventaire');

      const gainTotal = ligne.prixRachat * quantite;
      if (stock.quantite === quantite) {
        await prisma.inventaireRessource.delete({
          where: { personnageId_ressourceId: { personnageId, ressourceId: ligne.ressourceId } },
        });
      } else {
        await prisma.inventaireRessource.update({
          where: { personnageId_ressourceId: { personnageId, ressourceId: ligne.ressourceId } },
          data: { quantite: { decrement: quantite } },
        });
      }
      await prisma.personnage.update({ where: { id: personnageId }, data: { or: { increment: gainTotal } } });
      return { orGagne: gainTotal, orRestant: personnage.or + gainTotal };
    }

    throw new Error('Ligne invalide');
  }
}

export const pnjService = new PNJService();
