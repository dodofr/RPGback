import prisma from '../config/database';
import { InventoryState, InventoryItemInstance, ResourceStack, SetBonusInfo } from '../types';
import { randomInt } from '../utils/random';

export class InventoryService {
  /**
   * Get full inventory for a character
   */
  async getInventory(personnageId: number): Promise<InventoryState> {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
      include: {
        inventaireItems: {
          include: { equipement: true },
          orderBy: { createdAt: 'asc' },
        },
        inventaireRessources: {
          include: { ressource: true },
          orderBy: { ressourceId: 'asc' },
        },
      },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    const items: InventoryItemInstance[] = personnage.inventaireItems.map(item => ({
      id: item.id,
      equipementId: item.equipementId,
      nom: item.equipement.nom,
      slot: item.equipement.slot,
      poids: item.equipement.poids,
      bonusForce: item.bonusForce,
      bonusIntelligence: item.bonusIntelligence,
      bonusDexterite: item.bonusDexterite,
      bonusAgilite: item.bonusAgilite,
      bonusVie: item.bonusVie,
      bonusChance: item.bonusChance,
      bonusPA: item.bonusPA,
      bonusPM: item.bonusPM,
      bonusPO: item.bonusPO,
      bonusCritique: item.bonusCritique,
      resistanceForce: item.resistanceForce,
      resistanceIntelligence: item.resistanceIntelligence,
      resistanceDexterite: item.resistanceDexterite,
      resistanceAgilite: item.resistanceAgilite,
      estEquipe: item.estEquipe,
      panoplieId: item.equipement.panoplieId,
    }));

    const ressources: ResourceStack[] = personnage.inventaireRessources.map(r => ({
      ressourceId: r.ressourceId,
      nom: r.ressource.nom,
      description: r.ressource.description,
      poids: r.ressource.poids,
      quantite: r.quantite,
    }));

    const poidsItems = items.reduce((sum, i) => sum + i.poids, 0);
    const poidsRessources = ressources.reduce((sum, r) => sum + r.poids * r.quantite, 0);

    return {
      items,
      ressources,
      poidsActuel: poidsItems + poidsRessources,
      poidsMax: personnage.poidsMaxInventaire,
      or: personnage.or,
    };
  }

  /**
   * Roll random stats from equipment template ranges
   */
  rollStats(equipement: {
    bonusForce: number;
    bonusIntelligence: number;
    bonusDexterite: number;
    bonusAgilite: number;
    bonusVie: number;
    bonusChance: number;
    bonusPA: number;
    bonusPM: number;
    bonusPO: number;
    bonusCritique: number;
    bonusForceMax?: number | null;
    bonusIntelligenceMax?: number | null;
    bonusDexteriteMax?: number | null;
    bonusAgiliteMax?: number | null;
    bonusVieMax?: number | null;
    bonusChanceMax?: number | null;
    bonusPAMax?: number | null;
    bonusPMMax?: number | null;
    bonusPOMax?: number | null;
    bonusCritiqueMax?: number | null;
    resistanceForce?: number;
    resistanceIntelligence?: number;
    resistanceDexterite?: number;
    resistanceAgilite?: number;
    resistanceForceMax?: number | null;
    resistanceIntelligenceMax?: number | null;
    resistanceDexteriteMax?: number | null;
    resistanceAgiliteMax?: number | null;
  }) {
    return {
      bonusForce: equipement.bonusForceMax != null
        ? randomInt(equipement.bonusForce, equipement.bonusForceMax)
        : equipement.bonusForce,
      bonusIntelligence: equipement.bonusIntelligenceMax != null
        ? randomInt(equipement.bonusIntelligence, equipement.bonusIntelligenceMax)
        : equipement.bonusIntelligence,
      bonusDexterite: equipement.bonusDexteriteMax != null
        ? randomInt(equipement.bonusDexterite, equipement.bonusDexteriteMax)
        : equipement.bonusDexterite,
      bonusAgilite: equipement.bonusAgiliteMax != null
        ? randomInt(equipement.bonusAgilite, equipement.bonusAgiliteMax)
        : equipement.bonusAgilite,
      bonusVie: equipement.bonusVieMax != null
        ? randomInt(equipement.bonusVie, equipement.bonusVieMax)
        : equipement.bonusVie,
      bonusChance: equipement.bonusChanceMax != null
        ? randomInt(equipement.bonusChance, equipement.bonusChanceMax)
        : equipement.bonusChance,
      bonusPA: equipement.bonusPAMax != null
        ? randomInt(equipement.bonusPA, equipement.bonusPAMax)
        : equipement.bonusPA,
      bonusPM: equipement.bonusPMMax != null
        ? randomInt(equipement.bonusPM, equipement.bonusPMMax)
        : equipement.bonusPM,
      bonusPO: equipement.bonusPOMax != null
        ? randomInt(equipement.bonusPO, equipement.bonusPOMax)
        : equipement.bonusPO,
      bonusCritique: equipement.bonusCritiqueMax != null
        ? randomInt(equipement.bonusCritique, equipement.bonusCritiqueMax)
        : equipement.bonusCritique,
      resistanceForce: equipement.resistanceForceMax != null
        ? randomInt(equipement.resistanceForce ?? 0, equipement.resistanceForceMax)
        : (equipement.resistanceForce ?? 0),
      resistanceIntelligence: equipement.resistanceIntelligenceMax != null
        ? randomInt(equipement.resistanceIntelligence ?? 0, equipement.resistanceIntelligenceMax)
        : (equipement.resistanceIntelligence ?? 0),
      resistanceDexterite: equipement.resistanceDexteriteMax != null
        ? randomInt(equipement.resistanceDexterite ?? 0, equipement.resistanceDexteriteMax)
        : (equipement.resistanceDexterite ?? 0),
      resistanceAgilite: equipement.resistanceAgiliteMax != null
        ? randomInt(equipement.resistanceAgilite ?? 0, equipement.resistanceAgiliteMax)
        : (equipement.resistanceAgilite ?? 0),
    };
  }

  /**
   * Add an item instance to character's inventory
   */
  async addItem(personnageId: number, equipementId: number, rolledStats?: ReturnType<InventoryService['rollStats']>) {
    const equipement = await prisma.equipement.findUnique({ where: { id: equipementId } });
    if (!equipement) throw new Error('Equipment not found');

    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    // Check weight
    const inventory = await this.getInventory(personnageId);
    if (inventory.poidsActuel + equipement.poids > inventory.poidsMax) {
      throw new Error('Inventory full (weight limit exceeded)');
    }

    const stats = rolledStats ?? this.rollStats(equipement);

    return prisma.inventaireItem.create({
      data: {
        personnageId,
        equipementId,
        ...stats,
      },
      include: { equipement: true },
    });
  }

  /**
   * Add resources to character's inventory (upsert quantity)
   */
  async addResource(personnageId: number, ressourceId: number, quantite: number) {
    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    const ressource = await prisma.ressource.findUnique({ where: { id: ressourceId } });
    if (!ressource) throw new Error('Resource not found');

    // Check weight
    const inventory = await this.getInventory(personnageId);
    if (inventory.poidsActuel + ressource.poids * quantite > inventory.poidsMax) {
      throw new Error('Inventory full (weight limit exceeded)');
    }

    return prisma.inventaireRessource.upsert({
      where: { personnageId_ressourceId: { personnageId, ressourceId } },
      update: { quantite: { increment: quantite } },
      create: { personnageId, ressourceId, quantite },
    });
  }

  /**
   * Destroy an item instance
   */
  async destroyItem(personnageId: number, itemId: number) {
    const item = await prisma.inventaireItem.findUnique({ where: { id: itemId } });
    if (!item || item.personnageId !== personnageId) {
      throw new Error('Item not found in inventory');
    }
    if (item.estEquipe) {
      throw new Error('Cannot destroy equipped item, unequip first');
    }
    return prisma.inventaireItem.delete({ where: { id: itemId } });
  }

  /**
   * Remove quantity of a resource
   */
  async destroyResource(personnageId: number, ressourceId: number, quantite: number) {
    const existing = await prisma.inventaireRessource.findUnique({
      where: { personnageId_ressourceId: { personnageId, ressourceId } },
    });
    if (!existing || existing.quantite < quantite) {
      throw new Error('Not enough resources');
    }

    if (existing.quantite === quantite) {
      return prisma.inventaireRessource.delete({
        where: { personnageId_ressourceId: { personnageId, ressourceId } },
      });
    }

    return prisma.inventaireRessource.update({
      where: { personnageId_ressourceId: { personnageId, ressourceId } },
      data: { quantite: { decrement: quantite } },
    });
  }

  /**
   * Equip an item from inventory
   */
  async equipFromInventory(personnageId: number, itemId: number) {
    const item = await prisma.inventaireItem.findUnique({
      where: { id: itemId },
      include: { equipement: true },
    });
    if (!item || item.personnageId !== personnageId) {
      throw new Error('Item not found in inventory');
    }

    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    if (personnage.niveau < item.equipement.niveauMinimum) {
      throw new Error(`Character level too low (need level ${item.equipement.niveauMinimum}, have level ${personnage.niveau})`);
    }

    const slot = item.equipement.slot;

    // Unequip current item in same slot
    await prisma.inventaireItem.updateMany({
      where: { personnageId, estEquipe: true, equipement: { slot } },
      data: { estEquipe: false },
    });

    // Equip the new item
    await prisma.inventaireItem.update({
      where: { id: itemId },
      data: { estEquipe: true },
    });

    // Also update the legacy JSON field for backward compatibility
    const currentEquipment = personnage.equipements as Record<string, number | null>;
    currentEquipment[slot] = item.equipementId;
    await prisma.personnage.update({
      where: { id: personnageId },
      data: { equipements: currentEquipment },
    });

    return this.getInventory(personnageId);
  }

  /**
   * Unequip an item by slot
   */
  async unequipToInventory(personnageId: number, slot: string) {
    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    const equipped = await prisma.inventaireItem.findFirst({
      where: { personnageId, estEquipe: true, equipement: { slot: slot as any } },
    });

    if (!equipped) {
      throw new Error('No item equipped in this slot');
    }

    await prisma.inventaireItem.update({
      where: { id: equipped.id },
      data: { estEquipe: false },
    });

    // Update legacy JSON
    const currentEquipment = personnage.equipements as Record<string, number | null>;
    currentEquipment[slot] = null;
    await prisma.personnage.update({
      where: { id: personnageId },
      data: { equipements: currentEquipment },
    });

    return this.getInventory(personnageId);
  }

  /**
   * Calculate set bonuses for equipped items
   */
  async getSetBonuses(personnageId: number): Promise<SetBonusInfo[]> {
    const equippedItems = await prisma.inventaireItem.findMany({
      where: { personnageId, estEquipe: true },
      include: { equipement: { include: { panoplie: { include: { bonus: true } } } } },
    });

    // Group equipped items by panoplieId
    const panoplieCount: Map<number, { panoplie: { id: number; nom: string; bonus: any[] }; count: number }> = new Map();
    for (const item of equippedItems) {
      const panoplie = item.equipement.panoplie;
      if (!panoplie) continue;

      const existing = panoplieCount.get(panoplie.id);
      if (existing) {
        existing.count++;
      } else {
        panoplieCount.set(panoplie.id, { panoplie, count: 1 });
      }
    }

    const result: SetBonusInfo[] = [];
    for (const [, { panoplie, count }] of panoplieCount) {
      if (count < 2) continue; // Need at least 2 pieces for any bonus

      // Find the highest applicable bonus tier
      const applicableBonus = panoplie.bonus
        .filter((b: any) => b.nombrePieces <= count)
        .sort((a: any, b: any) => b.nombrePieces - a.nombrePieces)[0];

      if (applicableBonus) {
        result.push({
          panoplieId: panoplie.id,
          nom: panoplie.nom,
          piecesEquipees: count,
          bonusForce: applicableBonus.bonusForce,
          bonusIntelligence: applicableBonus.bonusIntelligence,
          bonusDexterite: applicableBonus.bonusDexterite,
          bonusAgilite: applicableBonus.bonusAgilite,
          bonusVie: applicableBonus.bonusVie,
          bonusChance: applicableBonus.bonusChance,
          bonusPA: applicableBonus.bonusPA,
          bonusPM: applicableBonus.bonusPM,
          bonusPO: applicableBonus.bonusPO,
          bonusCritique: applicableBonus.bonusCritique,
        });
      }
    }

    return result;
  }

  /**
   * Add gold to a character
   */
  async addGold(personnageId: number, amount: number) {
    return prisma.personnage.update({
      where: { id: personnageId },
      data: { or: { increment: amount } },
    });
  }

  /**
   * Remove gold from a character
   */
  async removeGold(personnageId: number, amount: number) {
    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');
    if (personnage.or < amount) throw new Error('Not enough gold');

    return prisma.personnage.update({
      where: { id: personnageId },
      data: { or: { decrement: amount } },
    });
  }

  /**
   * Send gold, resources and items from one character to another
   */
  async sendToCharacter(
    expediteurId: number,
    destinataireId: number,
    or: number,
    ressources: { ressourceId: number; quantite: number }[],
    items: number[],
  ) {
    // Nothing to send?
    if (or === 0 && ressources.length === 0 && items.length === 0) {
      throw new Error('Nothing to send');
    }

    // Can't send to self
    if (expediteurId === destinataireId) {
      throw new Error('Cannot send to yourself');
    }

    // Load both characters
    const expediteur = await prisma.personnage.findUnique({ where: { id: expediteurId } });
    if (!expediteur) throw new Error('Sender not found');

    const destinataire = await prisma.personnage.findUnique({ where: { id: destinataireId } });
    if (!destinataire) throw new Error('Recipient not found');

    // Check gold
    if (or > 0 && expediteur.or < or) {
      throw new Error('Not enough gold');
    }

    // Check resources
    const ressourceDetails: { ressourceId: number; quantite: number; nom: string; poids: number }[] = [];
    for (const r of ressources) {
      const existing = await prisma.inventaireRessource.findUnique({
        where: { personnageId_ressourceId: { personnageId: expediteurId, ressourceId: r.ressourceId } },
        include: { ressource: true },
      });
      if (!existing || existing.quantite < r.quantite) {
        const have = existing?.quantite ?? 0;
        const nom = existing?.ressource.nom ?? `#${r.ressourceId}`;
        throw new Error(`Not enough of resource: ${nom} (have ${have}, need ${r.quantite})`);
      }
      ressourceDetails.push({
        ressourceId: r.ressourceId,
        quantite: r.quantite,
        nom: existing.ressource.nom,
        poids: existing.ressource.poids,
      });
    }

    // Check items
    const itemDetails: { id: number; nom: string; poids: number; equipementId: number }[] = [];
    for (const itemId of items) {
      const item = await prisma.inventaireItem.findUnique({
        where: { id: itemId },
        include: { equipement: true },
      });
      if (!item || item.personnageId !== expediteurId) {
        throw new Error(`Item #${itemId} not found in sender's inventory`);
      }
      if (item.estEquipe) {
        throw new Error(`Item #${itemId} is equipped, unequip first`);
      }
      itemDetails.push({
        id: item.id,
        nom: item.equipement.nom,
        poids: item.equipement.poids,
        equipementId: item.equipementId,
      });
    }

    // Calculate transfer weight (gold has no weight)
    const poidsTransfert =
      itemDetails.reduce((sum, i) => sum + i.poids, 0) +
      ressourceDetails.reduce((sum, r) => sum + r.poids * r.quantite, 0);

    // Check recipient capacity
    const destInventory = await this.getInventory(destinataireId);
    if (destInventory.poidsActuel + poidsTransfert > destInventory.poidsMax) {
      throw new Error('Recipient inventory full (weight limit exceeded)');
    }

    // Execute transfer in a transaction
    await prisma.$transaction(async (tx) => {
      // Gold
      if (or > 0) {
        await tx.personnage.update({
          where: { id: expediteurId },
          data: { or: { decrement: or } },
        });
        await tx.personnage.update({
          where: { id: destinataireId },
          data: { or: { increment: or } },
        });
      }

      // Resources
      for (const r of ressourceDetails) {
        // Decrement sender
        const senderRes = await tx.inventaireRessource.findUnique({
          where: { personnageId_ressourceId: { personnageId: expediteurId, ressourceId: r.ressourceId } },
        });
        if (senderRes!.quantite === r.quantite) {
          await tx.inventaireRessource.delete({
            where: { personnageId_ressourceId: { personnageId: expediteurId, ressourceId: r.ressourceId } },
          });
        } else {
          await tx.inventaireRessource.update({
            where: { personnageId_ressourceId: { personnageId: expediteurId, ressourceId: r.ressourceId } },
            data: { quantite: { decrement: r.quantite } },
          });
        }

        // Upsert recipient
        await tx.inventaireRessource.upsert({
          where: { personnageId_ressourceId: { personnageId: destinataireId, ressourceId: r.ressourceId } },
          update: { quantite: { increment: r.quantite } },
          create: { personnageId: destinataireId, ressourceId: r.ressourceId, quantite: r.quantite },
        });
      }

      // Items — transfer ownership
      for (const item of itemDetails) {
        await tx.inventaireItem.update({
          where: { id: item.id },
          data: { personnageId: destinataireId, estEquipe: false },
        });
      }
    });

    return {
      message: 'Envoi effectué',
      expediteur: { personnageId: expediteurId, nom: expediteur.nom },
      destinataire: { personnageId: destinataireId, nom: destinataire.nom },
      envoye: {
        or,
        ressources: ressourceDetails.map(r => ({ nom: r.nom, quantite: r.quantite })),
        items: itemDetails.map(i => ({ id: i.id, nom: i.nom })),
      },
    };
  }
}

export const inventoryService = new InventoryService();
