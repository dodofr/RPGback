import prisma from '../config/database';
import { QueteStatut, QueteEtapeType } from '@prisma/client';
import { progressionService } from './progression.service';
import { inventoryService } from './inventory.service';

export class QuestService {
  /**
   * Get info for interacting with a PNJ: available quests, pending steps, merchant flag
   */
  async interactWithPnj(personnageId: number, pnjId: number) {
    const pnj = await prisma.pNJ.findUnique({
      where: { id: pnjId },
      include: {
        quetesDepart: {
          include: { etapes: { orderBy: { ordre: 'asc' } }, recompenses: true, prerequis: { select: { prerequisId: true } } },
        },
        quetesEtapes: {
          where: { type: QueteEtapeType.PARLER_PNJ },
          include: {
            quete: {
              include: { etapes: { orderBy: { ordre: 'asc' } } },
            },
          },
        },
      },
    });
    if (!pnj) throw new Error('PNJ not found');

    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    // Quêtes déjà acceptées ou terminées par ce personnage
    const existingQP = await prisma.quetePersonnage.findMany({
      where: { personnageId },
      select: { queteId: true, statut: true },
    });
    const acceptedIds = new Set(existingQP.map((q) => q.queteId));

    // IDs des quêtes terminées par ce personnage (pour vérifier les prérequis)
    const completedIds = new Set(
      existingQP.filter((q) => q.statut === 'TERMINEE').map((q) => q.queteId)
    );

    // Quêtes disponibles : départ depuis ce PNJ, niveau ok, pas déjà prise, prérequis remplis
    const quetesDisponibles = pnj.quetesDepart.filter((q) => {
      if (q.niveauRequis > personnage.niveau) return false;
      if (acceptedIds.has(q.id)) return false;
      if ((q as any).prerequis?.some((p: any) => !completedIds.has(p.prerequisId))) return false;
      return true;
    });

    // Étapes en attente PARLER_PNJ sur ce PNJ pour ce personnage
    const activeQPs = await prisma.quetePersonnage.findMany({
      where: { personnageId, statut: QueteStatut.EN_COURS },
      include: {
        quete: {
          include: {
            etapes: {
              orderBy: { ordre: 'asc' },
              include: { ressource: true, equipement: true },
            },
          },
        },
      },
    });

    const etapesEnAttente = activeQPs.filter((qp) => {
      const etape = qp.quete.etapes.find((e) => e.ordre === qp.etapeActuelle);
      return etape && (
        etape.type === QueteEtapeType.PARLER_PNJ ||
        etape.type === QueteEtapeType.APPORTER_RESSOURCE ||
        etape.type === QueteEtapeType.APPORTER_EQUIPEMENT
      ) && etape.pnjId === pnjId;
    });

    return {
      quetesDisponibles,
      etapesEnAttente,
      estMarchand: pnj.estMarchand,
    };
  }

  /**
   * Accept a quest for a character
   */
  async acceptQuest(personnageId: number, queteId: number) {
    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    const quete = await prisma.quete.findUnique({
      where: { id: queteId },
      include: { etapes: { orderBy: { ordre: 'asc' } } },
    });
    if (!quete) throw new Error('Quest not found');

    if (quete.niveauRequis > personnage.niveau) {
      throw new Error(`Level ${quete.niveauRequis} required`);
    }

    const existing = await prisma.quetePersonnage.findUnique({
      where: { queteId_personnageId: { queteId, personnageId } },
    });
    if (existing) throw new Error('Quest already accepted');

    return prisma.quetePersonnage.create({
      data: { queteId, personnageId, etapeActuelle: 1, compteurEtape: 0 },
      include: { quete: { include: { etapes: { orderBy: { ordre: 'asc' } } } } },
    });
  }

  /**
   * Advance a PARLER_PNJ step
   */
  async advancePnjStep(personnageId: number, quetePersonnageId: number) {
    const qp = await prisma.quetePersonnage.findUnique({
      where: { id: quetePersonnageId },
      include: { quete: { include: { etapes: { orderBy: { ordre: 'asc' } }, recompenses: true } } },
    });
    if (!qp) throw new Error('Quest progress not found');
    if (qp.personnageId !== personnageId) throw new Error('Unauthorized');
    if (qp.statut !== QueteStatut.EN_COURS) throw new Error('Quest already completed');

    const etape = qp.quete.etapes.find((e) => e.ordre === qp.etapeActuelle);
    if (!etape) throw new Error('Current step not found');

    switch (etape.type) {
      case QueteEtapeType.PARLER_PNJ:
        break; // no check, advance directly

      case QueteEtapeType.APPORTER_RESSOURCE: {
        const quantiteRequise = etape.quantite ?? 1;
        if (!etape.ressourceId) throw new Error('Missing ressourceId on step');
        const stock = await prisma.inventaireRessource.findUnique({
          where: { personnageId_ressourceId: { personnageId, ressourceId: etape.ressourceId } },
        });
        if (!stock || stock.quantite < quantiteRequise)
          throw new Error(`Ressources insuffisantes (${stock?.quantite ?? 0}/${quantiteRequise})`);
        if (stock.quantite === quantiteRequise) {
          await prisma.inventaireRessource.delete({
            where: { personnageId_ressourceId: { personnageId, ressourceId: etape.ressourceId } },
          });
        } else {
          await prisma.inventaireRessource.update({
            where: { personnageId_ressourceId: { personnageId, ressourceId: etape.ressourceId } },
            data: { quantite: { decrement: quantiteRequise } },
          });
        }
        break;
      }

      case QueteEtapeType.APPORTER_EQUIPEMENT: {
        const quantiteRequise = etape.quantite ?? 1;
        if (!etape.equipementId) throw new Error('Missing equipementId on step');
        const items = await prisma.inventaireItem.findMany({
          where: { personnageId, equipementId: etape.equipementId, estEquipe: false },
          take: quantiteRequise,
        });
        if (items.length < quantiteRequise)
          throw new Error(`Équipements insuffisants (${items.length}/${quantiteRequise})`);
        await prisma.inventaireItem.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
        break;
      }

      default:
        throw new Error('Cette étape ne se valide pas via un PNJ');
    }

    const totalEtapes = qp.quete.etapes.length;
    const nextOrdre = qp.etapeActuelle + 1;
    const isLastStep = nextOrdre > totalEtapes;

    if (isLastStep) {
      const updated = await prisma.quetePersonnage.update({
        where: { id: quetePersonnageId },
        data: { statut: QueteStatut.TERMINEE, etapeActuelle: nextOrdre },
        include: { quete: { include: { etapes: true, recompenses: true } } },
      });
      const recompenses = await this.distributeQuestRewards(quetePersonnageId);
      return { quetePersonnage: updated, questComplete: true, recompenses };
    } else {
      const updated = await prisma.quetePersonnage.update({
        where: { id: quetePersonnageId },
        data: { etapeActuelle: nextOrdre },
        include: { quete: { include: { etapes: true, recompenses: true } } },
      });
      return { quetePersonnage: updated, questComplete: false };
    }
  }

  /**
   * Called after a combat ends (victory). Updates TUER_MONSTRE quest steps for all players.
   */
  async onCombatEnd(combatId: number): Promise<void> {
    const combat = await prisma.combat.findUnique({
      where: { id: combatId },
      include: { entites: true },
    });
    if (!combat) return;

    // Dead enemies (team 1, not invocations)
    const deadMonsters = combat.entites.filter(
      (e) => e.equipe === 1 && e.pvActuels <= 0 && e.monstreTemplateId !== null && e.invocateurId === null
    );
    if (deadMonsters.length === 0) return;

    // Player characters (team 0, not invocations)
    const playerEntities = combat.entites.filter(
      (e) => e.equipe === 0 && e.personnageId !== null && e.invocateurId === null
    );
    if (playerEntities.length === 0) return;

    const playerIds = playerEntities.map((e) => e.personnageId!);

    for (const personnageId of playerIds) {
      // Find active quests with a TUER_MONSTRE step at current position
      const activeQPs = await prisma.quetePersonnage.findMany({
        where: { personnageId, statut: QueteStatut.EN_COURS },
        include: {
          quete: { include: { etapes: { orderBy: { ordre: 'asc' } }, recompenses: true } },
        },
      });

      for (const qp of activeQPs) {
        const etape = qp.quete.etapes.find((e) => e.ordre === qp.etapeActuelle);
        if (!etape || etape.type !== QueteEtapeType.TUER_MONSTRE || !etape.monstreTemplateId) continue;

        const killsThisCombat = deadMonsters.filter(
          (m) => m.monstreTemplateId === etape.monstreTemplateId
        ).length;
        if (killsThisCombat === 0) continue;

        const quantiteRequise = etape.quantite ?? 1;
        const newCompteur = Math.min(qp.compteurEtape + killsThisCombat, quantiteRequise);

        if (newCompteur >= quantiteRequise) {
          // Step complete
          const totalEtapes = qp.quete.etapes.length;
          const nextOrdre = qp.etapeActuelle + 1;
          const isLastStep = nextOrdre > totalEtapes;

          if (isLastStep) {
            await prisma.quetePersonnage.update({
              where: { id: qp.id },
              data: { statut: QueteStatut.TERMINEE, etapeActuelle: nextOrdre, compteurEtape: 0 },
            });
            await this.distributeQuestRewards(qp.id);
          } else {
            await prisma.quetePersonnage.update({
              where: { id: qp.id },
              data: { etapeActuelle: nextOrdre, compteurEtape: 0 },
            });
          }
        } else {
          await prisma.quetePersonnage.update({
            where: { id: qp.id },
            data: { compteurEtape: newCompteur },
          });
        }
      }
    }
  }

  /**
   * Distribute rewards for a completed quest
   */
  async distributeQuestRewards(quetePersonnageId: number): Promise<{
    xp: number;
    or: number;
    ressources: { nom: string; quantite: number }[];
    items: { nom: string }[];
  }> {
    const qp = await prisma.quetePersonnage.findUnique({
      where: { id: quetePersonnageId },
      include: { quete: { include: { recompenses: { include: { ressource: true, equipement: true } } } } },
    });
    if (!qp) throw new Error('Quest progress not found');

    const { personnageId } = qp;
    const recompenses = qp.quete.recompenses;

    let totalXP = 0;
    let totalOr = 0;
    const ressourcesGagnees: { nom: string; quantite: number }[] = [];
    const itemsGagnes: { nom: string }[] = [];

    for (const r of recompenses) {
      totalXP += r.xp;
      totalOr += r.or;

      if (r.ressourceId && r.quantiteRessource) {
        await prisma.inventaireRessource.upsert({
          where: { personnageId_ressourceId: { personnageId, ressourceId: r.ressourceId } },
          update: { quantite: { increment: r.quantiteRessource } },
          create: { personnageId, ressourceId: r.ressourceId, quantite: r.quantiteRessource },
        });
        if (r.ressource) {
          ressourcesGagnees.push({ nom: r.ressource.nom, quantite: r.quantiteRessource });
        }
      }

      if (r.equipementId && r.equipement) {
        try {
          const equip = await prisma.equipement.findUnique({ where: { id: r.equipementId } });
          if (equip) {
            const stats = inventoryService.rollStats(equip);
            await inventoryService.addItem(personnageId, r.equipementId, stats);
            itemsGagnes.push({ nom: r.equipement.nom });
          }
        } catch {
          // Silent fail: inventory full
        }
      }
    }

    if (totalOr > 0) {
      await prisma.personnage.update({ where: { id: personnageId }, data: { or: { increment: totalOr } } });
    }

    if (totalXP > 0) {
      await prisma.personnage.update({ where: { id: personnageId }, data: { experience: { increment: totalXP } } });
      await progressionService.checkAndApplyLevelUp(personnageId);
    }

    return { xp: totalXP, or: totalOr, ressources: ressourcesGagnees, items: itemsGagnes };
  }

  /**
   * Get all active quests for a character
   */
  async getActiveQuests(personnageId: number) {
    return prisma.quetePersonnage.findMany({
      where: { personnageId, statut: QueteStatut.EN_COURS },
      include: {
        quete: {
          include: {
            etapes: { orderBy: { ordre: 'asc' } },
            recompenses: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get all quests (for admin)
   */
  async getAllQuests() {
    return prisma.quete.findMany({
      include: {
        etapes: { orderBy: { ordre: 'asc' } },
        recompenses: true,
        pnjDepart: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async getQuestById(id: number) {
    return prisma.quete.findUnique({
      where: { id },
      include: {
        etapes: {
          orderBy: { ordre: 'asc' },
          include: { pnj: true, monstreTemplate: true, ressource: true, equipement: true },
        },
        recompenses: {
          include: { ressource: true, equipement: true },
        },
        pnjDepart: true,
        prerequis: { include: { prerequis: { select: { id: true, nom: true } } } },
      },
    });
  }

  async createQuest(data: {
    nom: string;
    description?: string;
    niveauRequis?: number;
    pnjDepartId?: number;
  }) {
    return prisma.quete.create({ data, include: { etapes: true, recompenses: true } });
  }

  async updateQuest(id: number, data: {
    nom?: string;
    description?: string | null;
    niveauRequis?: number;
    pnjDepartId?: number | null;
  }) {
    return prisma.quete.update({ where: { id }, data, include: { etapes: true, recompenses: true } });
  }

  async deleteQuest(id: number) {
    await prisma.quetePersonnage.deleteMany({ where: { queteId: id } });
    await prisma.queteRequis.deleteMany({ where: { prerequisId: id } }); // nettoie les quêtes qui exigeaient celle-ci
    await prisma.quete.delete({ where: { id } }); // cascade → QueteRequis où queteId = id
  }

  async addEtape(queteId: number, data: {
    ordre: number;
    description: string;
    type: QueteEtapeType;
    pnjId?: number | null;
    monstreTemplateId?: number | null;
    quantite?: number | null;
    ressourceId?: number | null;
    equipementId?: number | null;
  }) {
    return prisma.queteEtape.create({ data: { ...data, queteId } });
  }

  async updateEtape(etapeId: number, data: {
    ordre?: number;
    description?: string;
    type?: QueteEtapeType;
    pnjId?: number | null;
    monstreTemplateId?: number | null;
    quantite?: number | null;
    ressourceId?: number | null;
    equipementId?: number | null;
  }) {
    return prisma.queteEtape.update({ where: { id: etapeId }, data });
  }

  async deleteEtape(etapeId: number) {
    return prisma.queteEtape.delete({ where: { id: etapeId } });
  }

  async addRecompense(queteId: number, data: {
    xp?: number;
    or?: number;
    ressourceId?: number;
    quantiteRessource?: number;
    equipementId?: number;
  }) {
    return prisma.queteRecompense.create({ data: { ...data, queteId } });
  }

  async deleteRecompense(recompenseId: number) {
    return prisma.queteRecompense.delete({ where: { id: recompenseId } });
  }

  async addPrerequisite(queteId: number, prerequisId: number): Promise<void> {
    if (queteId === prerequisId) throw new Error('Une quête ne peut pas être son propre prérequis');
    await prisma.queteRequis.create({ data: { queteId, prerequisId } });
  }

  async removePrerequisite(queteId: number, prerequisId: number): Promise<void> {
    await prisma.queteRequis.delete({
      where: { queteId_prerequisId: { queteId, prerequisId } },
    });
  }
}

export const questService = new QuestService();
