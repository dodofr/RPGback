import prisma from '../config/database';
import { DropResult, PlayerDropResult, InventoryItemInstance } from '../types';
import { randomInt, checkProbability } from '../utils/random';
import { inventoryService } from './inventory.service';

export class DropService {
  /**
   * Distribute drops from a finished combat to all team 0 players.
   * - Gold & normal resources: each player rolls independently per monster
   * - Equipment & premium resources: rolled once per monster, assigned to 1 random player
   */
  async distributeDrops(combatId: number): Promise<DropResult> {
    const emptyResult: DropResult = { perPlayer: [], totalOr: 0, totalRessources: [], totalItems: [] };

    const combat = await prisma.combat.findUnique({
      where: { id: combatId },
      include: { entites: true },
    });

    if (!combat) return emptyResult;

    // Dead monsters (team 1, not invocations)
    const deadMonsters = combat.entites.filter(
      e => e.equipe === 1 && e.pvActuels <= 0 && e.monstreTemplateId && !e.invocateurId
    );

    // Player entities (team 0, not invocations)
    const playerEntities = combat.entites.filter(
      e => e.equipe === 0 && e.personnageId && !e.invocateurId
    );

    if (playerEntities.length === 0 || deadMonsters.length === 0) return emptyResult;

    // Fetch character names
    const personnageIds = playerEntities.map(e => e.personnageId!);
    const personnages = await prisma.personnage.findMany({
      where: { id: { in: personnageIds } },
      select: { id: true, nom: true },
    });
    const nomMap = new Map(personnages.map(p => [p.id, p.nom]));

    // Initialize per-player results
    const playerResults = new Map<number, PlayerDropResult>();
    for (const pid of personnageIds) {
      playerResults.set(pid, {
        personnageId: pid,
        nom: nomMap.get(pid) || 'Inconnu',
        or: 0,
        ressources: [],
        items: [],
      });
    }

    // Load all monster templates with drops
    const monstreTemplateIds = [...new Set(deadMonsters.map(m => m.monstreTemplateId!))];
    const templates = await prisma.monstreTemplate.findMany({
      where: { id: { in: monstreTemplateIds } },
      include: {
        drops: {
          include: {
            ressource: true,
            equipement: true,
          },
        },
      },
    });
    const templateMap = new Map(templates.map(t => [t.id, t]));

    // Process each dead monster
    for (const monster of deadMonsters) {
      const template = templateMap.get(monster.monstreTemplateId!);
      if (!template) continue;

      // === INDIVIDUAL ROLLS (per player) ===
      for (const pid of personnageIds) {
        const pr = playerResults.get(pid)!;

        // Gold: each player rolls independently
        if (template.orMin > 0 || template.orMax > 0) {
          pr.or += randomInt(template.orMin, template.orMax);
        }

        // Normal resources (estPremium = false): each player rolls independently
        for (const drop of template.drops) {
          if (!drop.ressourceId || !drop.ressource) continue;
          if (drop.ressource.estPremium) continue;

          if (checkProbability(drop.tauxDrop)) {
            const quantite = randomInt(drop.quantiteMin, drop.quantiteMax);
            const existing = pr.ressources.find(r => r.ressourceId === drop.ressourceId!);
            if (existing) {
              existing.quantite += quantite;
            } else {
              pr.ressources.push({
                ressourceId: drop.ressourceId,
                nom: drop.ressource.nom,
                quantite,
              });
            }
          }
        }
      }

      // === GLOBAL ROLLS (once per monster, assigned to 1 random player) ===
      for (const drop of template.drops) {
        // Premium resources
        if (drop.ressourceId && drop.ressource && drop.ressource.estPremium) {
          if (checkProbability(drop.tauxDrop)) {
            const quantite = randomInt(drop.quantiteMin, drop.quantiteMax);
            const luckyPid = personnageIds[randomInt(0, personnageIds.length - 1)];
            const pr = playerResults.get(luckyPid)!;
            const existing = pr.ressources.find(r => r.ressourceId === drop.ressourceId!);
            if (existing) {
              existing.quantite += quantite;
            } else {
              pr.ressources.push({
                ressourceId: drop.ressourceId,
                nom: drop.ressource.nom,
                quantite,
              });
            }
          }
        }

        // Equipment
        if (drop.equipementId) {
          if (checkProbability(drop.tauxDrop)) {
            const luckyPid = personnageIds[randomInt(0, personnageIds.length - 1)];
            try {
              const equipement = await prisma.equipement.findUnique({ where: { id: drop.equipementId } });
              if (!equipement) continue;

              const rolledStats = inventoryService.rollStats(equipement);
              const item = await inventoryService.addItem(luckyPid, drop.equipementId, rolledStats);

              const itemInstance: InventoryItemInstance = {
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
                estEquipe: false,
                panoplieId: item.equipement.panoplieId,
              };

              playerResults.get(luckyPid)!.items.push(itemInstance);
            } catch {
              // Inventory full, item lost
            }
          }
        }
      }
    }

    // Actually add gold and resources to inventories
    for (const [pid, pr] of playerResults) {
      if (pr.or > 0) {
        await inventoryService.addGold(pid, pr.or);
      }
      for (const res of pr.ressources) {
        try {
          await inventoryService.addResource(pid, res.ressourceId, res.quantite);
        } catch {
          // Inventory full, skip
        }
      }
    }

    // Build totals for log summary
    const perPlayer = Array.from(playerResults.values());
    const totalOr = perPlayer.reduce((sum, p) => sum + p.or, 0);

    const totalResMap = new Map<number, { ressourceId: number; nom: string; quantite: number }>();
    for (const p of perPlayer) {
      for (const r of p.ressources) {
        const existing = totalResMap.get(r.ressourceId);
        if (existing) {
          existing.quantite += r.quantite;
        } else {
          totalResMap.set(r.ressourceId, { ...r });
        }
      }
    }

    const totalItems: InventoryItemInstance[] = [];
    for (const p of perPlayer) {
      totalItems.push(...p.items);
    }

    return {
      perPlayer,
      totalOr,
      totalRessources: Array.from(totalResMap.values()),
      totalItems,
    };
  }
}

export const dropService = new DropService();
