import prisma from '../config/database';

// XP nécessaire pour passer au niveau suivant
function xpRequis(niveau: number): number {
  return niveau * 100;
}

export const metierService = {
  // ── Métiers CRUD ──────────────────────────────────────────────────────────

  async getAll() {
    return prisma.metier.findMany({
      include: {
        noeuds: {
          include: { ressources: { include: { ressource: true } } },
        },
        recettes: { select: { id: true, nom: true, niveauMetierRequis: true, xpCraft: true } },
      },
      orderBy: { id: 'asc' },
    });
  },

  async getById(id: number) {
    return prisma.metier.findUnique({
      where: { id },
      include: {
        noeuds: {
          include: { ressources: { include: { ressource: true } } },
        },
        recettes: { select: { id: true, nom: true, niveauMetierRequis: true, xpCraft: true } },
      },
    });
  },

  async create(data: { nom: string; description?: string; type?: 'RECOLTE' | 'CRAFT' }) {
    return prisma.metier.create({ data });
  },

  async update(id: number, data: { nom?: string; description?: string; type?: 'RECOLTE' | 'CRAFT' }) {
    return prisma.metier.update({ where: { id }, data });
  },

  async delete(id: number) {
    await prisma.metier.delete({ where: { id } });
  },

  // ── Noeuds de récolte CRUD ────────────────────────────────────────────────

  async createNoeud(data: { nom: string; imageUrl?: string; metierId: number; niveauMinAcces?: number; xpRecolte?: number }) {
    return prisma.noeudRecolte.create({
      data,
      include: { ressources: { include: { ressource: true } } },
    });
  },

  async updateNoeud(id: number, data: { nom?: string; imageUrl?: string | null; niveauMinAcces?: number; xpRecolte?: number }) {
    return prisma.noeudRecolte.update({
      where: { id },
      data,
      include: { ressources: { include: { ressource: true } } },
    });
  },

  async deleteNoeud(id: number) {
    await prisma.noeudRecolte.delete({ where: { id } });
  },

  // ── Table de loot du noeud ────────────────────────────────────────────────

  async addNoeudRessource(data: {
    noeudId: number;
    niveauRequis: number;
    ressourceId: number;
    quantiteMin: number;
    quantiteMax: number;
    tauxDrop?: number;
  }) {
    return prisma.noeudRessource.create({
      data,
      include: { ressource: true },
    });
  },

  async updateNoeudRessource(id: number, data: {
    niveauRequis?: number;
    quantiteMin?: number;
    quantiteMax?: number;
    tauxDrop?: number;
  }) {
    return prisma.noeudRessource.update({
      where: { id },
      data,
      include: { ressource: true },
    });
  },

  async deleteNoeudRessource(id: number) {
    await prisma.noeudRessource.delete({ where: { id } });
  },

  // ── MapRessource CRUD (positions sur les maps) ────────────────────────────

  async getMapRessources(mapId: number) {
    return prisma.mapRessource.findMany({
      where: { mapId },
      include: {
        noeud: {
          include: {
            metier: true,
            ressources: { include: { ressource: true } },
          },
        },
      },
    });
  },

  async addMapRessource(data: {
    mapId: number;
    caseX: number;
    caseY: number;
    noeudId: number;
    respawnMinutes?: number;
  }) {
    return prisma.mapRessource.create({
      data,
      include: { noeud: { include: { metier: true } } },
    });
  },

  async deleteMapRessource(id: number) {
    await prisma.mapRessource.delete({ where: { id } });
  },

  // ── Apprentissage via PNJ ─────────────────────────────────────────────────

  async learnMetier(personnageId: number, pnjId: number, metierId: number) {
    const pnj = await prisma.pNJ.findUnique({
      where: { id: pnjId },
      include: { metiers: true },
    });
    if (!pnj) throw new Error('PNJ not found');

    const enseigneCeMetier = pnj.metiers.some(m => m.metierId === metierId);
    if (!enseigneCeMetier) throw new Error('Ce PNJ n\'enseigne pas ce métier');

    const existing = await prisma.personnageMetier.findUnique({
      where: { personnageId_metierId: { personnageId, metierId } },
    });
    if (existing) throw new Error('Vous connaissez déjà ce métier');

    return prisma.personnageMetier.create({
      data: { personnageId, metierId, niveau: 1, xp: 0 },
      include: { metier: true },
    });
  },

  // ── Récolte ───────────────────────────────────────────────────────────────

  async harvest(personnageId: number, mapRessourceId: number) {
    const mapRessource = await prisma.mapRessource.findUnique({
      where: { id: mapRessourceId },
      include: {
        noeud: {
          include: {
            metier: true,
            ressources: { include: { ressource: true } },
          },
        },
      },
    });
    if (!mapRessource) throw new Error('Resource node not found');

    // Vérifier respawn
    if (mapRessource.lastHarvestAt) {
      const elapsed = (Date.now() - mapRessource.lastHarvestAt.getTime()) / 1000 / 60;
      if (elapsed < mapRessource.respawnMinutes) {
        const remaining = Math.ceil(mapRessource.respawnMinutes - elapsed);
        throw new Error(`Cette ressource repoussera dans ${remaining} minute(s)`);
      }
    }

    // Vérifier que le personnage a le bon métier
    const persoMetier = await prisma.personnageMetier.findUnique({
      where: {
        personnageId_metierId: {
          personnageId,
          metierId: mapRessource.noeud.metierId,
        },
      },
    });
    if (!persoMetier) {
      throw new Error(`Vous n'avez pas le métier "${mapRessource.noeud.metier.nom}"`);
    }

    // Vérifier niveau minimum du noeud
    if (persoMetier.niveau < mapRessource.noeud.niveauMinAcces) {
      throw new Error(
        `Niveau ${mapRessource.noeud.niveauMinAcces} en ${mapRessource.noeud.metier.nom} requis (vous êtes niveau ${persoMetier.niveau})`
      );
    }

    // Calculer le loot : pour chaque ressource, prendre la ligne avec le niveauRequis le plus élevé <= niveau du perso
    const ressourcesDisponibles = mapRessource.noeud.ressources.filter(
      r => r.niveauRequis <= persoMetier.niveau
    );

    // Grouper par ressourceId, garder la meilleure ligne (niveauRequis le plus haut)
    const bestByRessource = new Map<number, typeof ressourcesDisponibles[0]>();
    for (const r of ressourcesDisponibles) {
      const existing = bestByRessource.get(r.ressourceId);
      if (!existing || r.niveauRequis > existing.niveauRequis) {
        bestByRessource.set(r.ressourceId, r);
      }
    }

    if (bestByRessource.size === 0) {
      throw new Error('Aucune ressource disponible à ce niveau');
    }

    // Roll et attribution
    const loot: { ressource: { id: number; nom: string }; quantite: number }[] = [];
    for (const ligne of bestByRessource.values()) {
      // Vérifier le taux de drop
      if (Math.random() > ligne.tauxDrop) continue;

      const quantite = Math.floor(
        Math.random() * (ligne.quantiteMax - ligne.quantiteMin + 1) + ligne.quantiteMin
      );
      if (quantite <= 0) continue;

      await prisma.inventaireRessource.upsert({
        where: { personnageId_ressourceId: { personnageId, ressourceId: ligne.ressourceId } },
        create: { personnageId, ressourceId: ligne.ressourceId, quantite },
        update: { quantite: { increment: quantite } },
      });

      loot.push({ ressource: { id: ligne.ressourceId, nom: ligne.ressource.nom }, quantite });
    }

    // XP métier et montée de niveau
    const XP_PAR_RECOLTE = mapRessource.noeud.xpRecolte;
    let nouveauXp = persoMetier.xp + XP_PAR_RECOLTE;
    let nouveauNiveau = persoMetier.niveau;

    while (nouveauXp >= xpRequis(nouveauNiveau)) {
      nouveauXp -= xpRequis(nouveauNiveau);
      nouveauNiveau++;
    }

    const levelUp = nouveauNiveau > persoMetier.niveau;

    const persoMetierMaj = await prisma.personnageMetier.update({
      where: { personnageId_metierId: { personnageId, metierId: mapRessource.noeud.metierId } },
      data: { xp: nouveauXp, niveau: nouveauNiveau },
      include: { metier: true },
    });

    // Mettre à jour lastHarvestAt
    await prisma.mapRessource.update({
      where: { id: mapRessourceId },
      data: { lastHarvestAt: new Date() },
    });

    return {
      loot,
      metier: {
        nom: persoMetierMaj.metier.nom,
        niveau: persoMetierMaj.niveau,
        xp: persoMetierMaj.xp,
        xpRequis: xpRequis(persoMetierMaj.niveau),
        levelUp,
      },
    };
  },

  // ── Métiers du personnage ─────────────────────────────────────────────────

  async getPersonnageMetiers(personnageId: number) {
    const metiers = await prisma.personnageMetier.findMany({
      where: { personnageId },
      include: { metier: true },
    });
    return metiers.map(pm => ({
      ...pm,
      xpRequis: xpRequis(pm.niveau),
    }));
  },

  // ── Métiers enseignés par un PNJ ─────────────────────────────────────────

  async addPnjMetier(pnjId: number, metierId: number) {
    return prisma.pnjMetier.create({
      data: { pnjId, metierId },
      include: { metier: true },
    });
  },

  async deletePnjMetier(pnjId: number, metierId: number) {
    await prisma.pnjMetier.delete({
      where: { pnjId_metierId: { pnjId, metierId } },
    });
  },
};
