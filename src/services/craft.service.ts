import prisma from '../config/database';
import { inventoryService } from './inventory.service';

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
   * Craft a recipe: consume resources/gold, create item with rolled stats
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

    return item;
  }
}

export const craftService = new CraftService();
