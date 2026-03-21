import prisma from '../config/database';
import { inventoryService } from './inventory.service';

function xpRequis(niveau: number): number {
  return niveau * 100;
}

export class CraftService {
  /**
   * Get all recipes
   */
  async getRecipes() {
    return prisma.recette.findMany({
      include: {
        equipement: true,
        ingredients: {
          include: { ressource: true },
        },
        metier: { select: { id: true, nom: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get a recipe by ID
   */
  async getRecipeById(id: number) {
    return prisma.recette.findUnique({
      where: { id },
      include: {
        equipement: true,
        ingredients: {
          include: { ressource: true },
        },
        metier: { select: { id: true, nom: true } },
      },
    });
  }

  /**
   * Check if a character can craft a recipe
   */
  async canCraft(personnageId: number, recetteId: number): Promise<{ canCraft: boolean; reason?: string }> {
    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) return { canCraft: false, reason: 'Character not found' };

    const recette = await prisma.recette.findUnique({
      where: { id: recetteId },
      include: {
        equipement: true,
        ingredients: { include: { ressource: true } },
      },
    });
    if (!recette) return { canCraft: false, reason: 'Recipe not found' };

    // Check level
    if (personnage.niveau < recette.niveauMinimum) {
      return { canCraft: false, reason: `Need level ${recette.niveauMinimum}, have level ${personnage.niveau}` };
    }

    // Check gold
    if (personnage.or < recette.coutOr) {
      return { canCraft: false, reason: `Need ${recette.coutOr} gold, have ${personnage.or}` };
    }

    // Check métier
    if (recette.metierId) {
      const pm = await prisma.personnageMetier.findUnique({
        where: { personnageId_metierId: { personnageId, metierId: recette.metierId } },
      });
      if (!pm) {
        return { canCraft: false, reason: `Ce craft requiert le métier associé (niveau ${recette.niveauMetierRequis})` };
      }
      if (pm.niveau < recette.niveauMetierRequis) {
        return { canCraft: false, reason: `Niveau métier insuffisant — Niveau ${recette.niveauMetierRequis} requis, vous êtes niveau ${pm.niveau}` };
      }
    }

    // Check resources
    for (const ingredient of recette.ingredients) {
      const owned = await prisma.inventaireRessource.findUnique({
        where: { personnageId_ressourceId: { personnageId, ressourceId: ingredient.ressourceId } },
      });
      if (!owned || owned.quantite < ingredient.quantite) {
        return {
          canCraft: false,
          reason: `Need ${ingredient.quantite}x ${ingredient.ressource.nom}, have ${owned?.quantite ?? 0}`,
        };
      }
    }

    // Check weight
    const inventory = await inventoryService.getInventory(personnageId);
    if (inventory.poidsActuel + recette.equipement.poids > inventory.poidsMax) {
      return { canCraft: false, reason: 'Inventory full (weight limit)' };
    }

    return { canCraft: true };
  }

  /**
   * Craft a recipe: consume resources/gold, create item with rolled stats, award métier XP
   */
  async craft(personnageId: number, recetteId: number) {
    const check = await this.canCraft(personnageId, recetteId);
    if (!check.canCraft) {
      throw new Error(check.reason || 'Cannot craft');
    }

    const recette = await prisma.recette.findUnique({
      where: { id: recetteId },
      include: {
        equipement: true,
        ingredients: true,
        metier: { select: { id: true, nom: true } },
      },
    });
    if (!recette) throw new Error('Recipe not found');

    // Consume gold
    if (recette.coutOr > 0) {
      await inventoryService.removeGold(personnageId, recette.coutOr);
    }

    // Consume resources
    for (const ingredient of recette.ingredients) {
      await inventoryService.destroyResource(personnageId, ingredient.ressourceId, ingredient.quantite);
    }

    // Roll stats and create item
    const rolledStats = inventoryService.rollStats(recette.equipement);
    const item = await inventoryService.addItem(personnageId, recette.equipementId, rolledStats);

    // Award métier XP if recipe requires a métier
    let metierProgression: { nom: string; niveau: number; xp: number; xpRequis: number; levelUp: boolean } | null = null;
    if (recette.metierId && recette.metier) {
      const pm = await prisma.personnageMetier.findUnique({
        where: { personnageId_metierId: { personnageId, metierId: recette.metierId } },
      });
      if (pm) {
        let newXp = pm.xp + recette.xpCraft;
        let newNiveau = pm.niveau;
        let levelUp = false;
        while (newXp >= xpRequis(newNiveau)) {
          newXp -= xpRequis(newNiveau);
          newNiveau++;
          levelUp = true;
        }
        await prisma.personnageMetier.update({
          where: { id: pm.id },
          data: { xp: newXp, niveau: newNiveau },
        });
        metierProgression = {
          nom: recette.metier.nom,
          niveau: newNiveau,
          xp: newXp,
          xpRequis: xpRequis(newNiveau),
          levelUp,
        };
      }
    }

    return { item, metierProgression };
  }
}

export const craftService = new CraftService();
