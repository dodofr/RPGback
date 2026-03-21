import prisma from '../config/database';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function xpRequis(niveau: number): number {
  return niveau * 100;
}

interface StatBlock {
  statForce: number;
  statIntelligence: number;
  statDexterite: number;
  statAgilite: number;
  statVie: number;
  statChance: number;
  statPA: number;
  statPM: number;
  statPO: number;
  statCritique: number;
  statDommages: number;
  statSoins: number;
}

function statsFromRace(race: {
  baseForce: number; baseIntelligence: number; baseDexterite: number;
  baseAgilite: number; baseVie: number; baseChance: number;
  basePA: number; basePM: number; basePO: number;
  baseCritique: number; baseDommages: number; baseSoins: number;
}): StatBlock {
  return {
    statForce:        Math.max(0, race.baseForce        + randomInt(-1, 1)),
    statIntelligence: Math.max(0, race.baseIntelligence + randomInt(-1, 1)),
    statDexterite:    Math.max(0, race.baseDexterite    + randomInt(-1, 1)),
    statAgilite:      Math.max(0, race.baseAgilite      + randomInt(-1, 1)),
    statVie:          Math.max(0, race.baseVie          + randomInt(-1, 1)),
    statChance:       Math.max(0, race.baseChance       + randomInt(-1, 1)),
    statPA:           Math.max(0, race.basePA           + randomInt(-1, 1)),
    statPM:           Math.max(0, race.basePM           + randomInt(-1, 1)),
    statPO:           Math.max(0, race.basePO           + randomInt(-1, 1)),
    statCritique:     Math.max(0, race.baseCritique     + randomInt(-1, 1)),
    statDommages:     Math.max(0, race.baseDommages     + randomInt(-1, 1)),
    statSoins:        Math.max(0, race.baseSoins        + randomInt(-1, 1)),
  };
}

function applyLevelUp(stats: StatBlock, race: {
  croissanceForce: number; croissanceIntelligence: number; croissanceDexterite: number;
  croissanceAgilite: number; croissanceVie: number; croissanceChance: number;
  croissancePA: number; croissancePM: number; croissancePO: number;
  croissanceCritique: number; croissanceDommages: number; croissanceSoins: number;
}): StatBlock {
  const bump = (base: number, croissance: number) =>
    base + Math.max(1, Math.round(croissance + (Math.random() * 0.4 - 0.2)));
  return {
    statForce:        bump(stats.statForce,        race.croissanceForce),
    statIntelligence: bump(stats.statIntelligence, race.croissanceIntelligence),
    statDexterite:    bump(stats.statDexterite,    race.croissanceDexterite),
    statAgilite:      bump(stats.statAgilite,      race.croissanceAgilite),
    statVie:          bump(stats.statVie,           race.croissanceVie),
    statChance:       bump(stats.statChance,        race.croissanceChance),
    statPA:           bump(stats.statPA,            race.croissancePA),
    statPM:           bump(stats.statPM,            race.croissancePM),
    statPO:           bump(stats.statPO,            race.croissancePO),
    statCritique:     bump(stats.statCritique,      race.croissanceCritique),
    statDommages:     bump(stats.statDommages,      race.croissanceDommages),
    statSoins:        bump(stats.statSoins,         race.croissanceSoins),
  };
}

function inheritStats(a: StatBlock, b: StatBlock): StatBlock {
  const inherit = (va: number, vb: number) => {
    const base = Math.random() < 0.5 ? va : vb;
    const mutation = 1 + (Math.random() * 0.3 - 0.1);
    return Math.max(0, Math.round(base * mutation));
  };
  return {
    statForce:        inherit(a.statForce,        b.statForce),
    statIntelligence: inherit(a.statIntelligence, b.statIntelligence),
    statDexterite:    inherit(a.statDexterite,    b.statDexterite),
    statAgilite:      inherit(a.statAgilite,      b.statAgilite),
    statVie:          inherit(a.statVie,           b.statVie),
    statChance:       inherit(a.statChance,        b.statChance),
    statPA:           inherit(a.statPA,            b.statPA),
    statPM:           inherit(a.statPM,            b.statPM),
    statPO:           inherit(a.statPO,            b.statPO),
    statCritique:     inherit(a.statCritique,      b.statCritique),
    statDommages:     inherit(a.statDommages,      b.statDommages),
    statSoins:        inherit(a.statSoins,         b.statSoins),
  };
}

export class FamilierService {
  // ==================== CREATION ====================

  async createFamilier(personnageId: number, raceId: number, opts: { parentAId?: number; parentBId?: number; stats?: StatBlock } = {}) {
    const race = await prisma.familierRace.findUnique({ where: { id: raceId } });
    if (!race) throw new Error('FamilierRace not found');

    const stats = opts.stats ?? statsFromRace(race);

    return prisma.familier.create({
      data: {
        raceId,
        personnageId,
        parentAId: opts.parentAId ?? null,
        parentBId: opts.parentBId ?? null,
        ...stats,
      },
      include: { race: { include: { famille: true } } },
    });
  }

  // ==================== LECTURE ====================

  async getFamiliersByPersonnage(personnageId: number) {
    return prisma.familier.findMany({
      where: { personnageId },
      include: {
        race: { include: { famille: true } },
        enclosAssignment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFamilierById(id: number) {
    return prisma.familier.findUnique({
      where: { id },
      include: {
        race: { include: { famille: true } },
        enclosAssignment: true,
      },
    });
  }

  // ==================== EQUIPEMENT ====================

  async equipFamilier(personnageId: number, familierId: number) {
    const familier = await prisma.familier.findUnique({
      where: { id: familierId },
      include: { enclosAssignment: true },
    });
    if (!familier || familier.personnageId !== personnageId) throw new Error('Familier not found');
    if (familier.enclosAssignment) throw new Error('Ce familier est en enclos');

    // Déséquiper l'ancien
    await prisma.personnage.update({
      where: { id: personnageId },
      data: { familierEquipeId: null },
    });
    await prisma.familier.updateMany({
      where: { personnageId, estEquipe: true },
      data: { estEquipe: false },
    });

    // Équiper le nouveau
    await prisma.familier.update({ where: { id: familierId }, data: { estEquipe: true } });
    return prisma.personnage.update({
      where: { id: personnageId },
      data: { familierEquipeId: familierId },
      include: { familierEquipe: { include: { race: true } } },
    });
  }

  async unequipFamilier(personnageId: number) {
    await prisma.personnage.update({
      where: { id: personnageId },
      data: { familierEquipeId: null },
    });
    await prisma.familier.updateMany({
      where: { personnageId, estEquipe: true },
      data: { estEquipe: false },
    });
    return { success: true };
  }

  // ==================== ENCLOS ====================

  async depositInEnclos(familierId: number, personnageId: number, enclosType: string, mapId: number, dureeMinutes: number) {
    const familier = await prisma.familier.findUnique({
      where: { id: familierId },
      include: { enclosAssignment: true },
    });
    if (!familier || familier.personnageId !== personnageId) throw new Error('Familier not found');
    if (familier.enclosAssignment) throw new Error('Ce familier est déjà en enclos');
    if (familier.estEquipe) throw new Error('Déséquipez le familier avant de le déposer');

    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage || personnage.mapId !== mapId) throw new Error('Le personnage n\'est pas sur cette map');

    const map = await prisma.map.findUnique({ where: { id: mapId } });
    if (!map || map.type !== 'VILLE') throw new Error('L\'enclos doit être sur une map VILLE');

    return prisma.familierEnclosAssignment.create({
      data: {
        familierId,
        enclosType: enclosType as 'ENTRAINEMENT' | 'BONHEUR' | 'RENCONTRE',
        mapId,
        dureeMinutes,
      },
      include: { familier: true },
    });
  }

  async collectFromEnclos(familierId: number, personnageId: number) {
    const familier = await prisma.familier.findUnique({
      where: { id: familierId },
      include: {
        enclosAssignment: true,
        race: true,
      },
    });
    if (!familier || familier.personnageId !== personnageId) throw new Error('Familier not found');
    if (!familier.enclosAssignment) throw new Error('Ce familier n\'est pas en enclos');

    const assignment = familier.enclosAssignment;
    const now = new Date();
    const minutesPassed = Math.min(
      (now.getTime() - assignment.debutAt.getTime()) / 60000,
      assignment.dureeMinutes
    );

    let newXp = familier.xp;
    let newBonheur = familier.bonheur;
    let newNiveau = familier.niveau;
    let statUpdates: Partial<StatBlock> = {};

    if (assignment.enclosType === 'ENTRAINEMENT') {
      const xpGain = Math.floor(minutesPassed);
      newXp = familier.xp + xpGain;
      // Level-up auto
      while (newXp >= xpRequis(newNiveau)) {
        newXp -= xpRequis(newNiveau);
        newNiveau++;
        const current: StatBlock = {
          statForce: familier.statForce, statIntelligence: familier.statIntelligence,
          statDexterite: familier.statDexterite, statAgilite: familier.statAgilite,
          statVie: familier.statVie, statChance: familier.statChance,
          statPA: familier.statPA, statPM: familier.statPM, statPO: familier.statPO,
          statCritique: familier.statCritique, statDommages: familier.statDommages,
          statSoins: familier.statSoins,
        };
        const upgraded = applyLevelUp({ ...current, ...statUpdates } as StatBlock, familier.race);
        statUpdates = upgraded;
      }
    } else if (assignment.enclosType === 'BONHEUR') {
      const bonheurGain = Math.floor(minutesPassed);
      newBonheur = Math.min(100, familier.bonheur + bonheurGain);
    }

    const updated = await prisma.familier.update({
      where: { id: familierId },
      data: {
        xp: newXp,
        niveau: newNiveau,
        bonheur: newBonheur,
        ...(Object.keys(statUpdates).length > 0 ? statUpdates : {}),
      },
      include: { race: { include: { famille: true } } },
    });

    await prisma.familierEnclosAssignment.delete({ where: { id: assignment.id } });

    return { familier: updated, minutesPassed: Math.floor(minutesPassed), niveauPrecedent: familier.niveau };
  }

  // ==================== ACCOUPLEMENT ====================

  async startBreeding(familierAId: number, familierBId: number, mapId: number, dureeMinutes: number) {
    const [famA, famB] = await Promise.all([
      prisma.familier.findUnique({ where: { id: familierAId }, include: { race: { include: { famille: true } }, enclosAssignment: true } }),
      prisma.familier.findUnique({ where: { id: familierBId }, include: { race: { include: { famille: true } }, enclosAssignment: true } }),
    ]);

    if (!famA || !famB) throw new Error('Familier not found');
    if (famA.enclosAssignment || famB.enclosAssignment) throw new Error('Un des familiers est déjà en enclos');
    if (famA.estEquipe || famB.estEquipe) throw new Error('Déséquipez les familiers avant de les déposer');
    if (famA.personnageId !== famB.personnageId) throw new Error('Les deux familiers doivent appartenir au même personnage');
    if (famA.race.familleId !== famB.race.familleId) throw new Error('Les familiers doivent être de la même famille');
    if (famA.bonheur < 100 || famB.bonheur < 100) throw new Error('Les deux familiers doivent avoir bonheur = 100');

    const xpRequisA = xpRequis(famA.niveau);
    const xpRequisB = xpRequis(famB.niveau);
    if (famA.xp < xpRequisA || famB.xp < xpRequisB) throw new Error('Les deux familiers doivent avoir atteint leur quota XP de niveau');

    const map = await prisma.map.findUnique({ where: { id: mapId } });
    if (!map || map.type !== 'VILLE') throw new Error('L\'enclos doit être sur une map VILLE');

    const personnage = await prisma.personnage.findUnique({ where: { id: famA.personnageId } });
    if (!personnage || personnage.mapId !== mapId) throw new Error('Le personnage n\'est pas sur cette map');

    // Créer les deux assignments liés
    const assignA = await prisma.familierEnclosAssignment.create({
      data: { familierId: familierAId, enclosType: 'RENCONTRE', mapId, dureeMinutes },
    });
    const assignB = await prisma.familierEnclosAssignment.create({
      data: {
        familierId: familierBId,
        enclosType: 'RENCONTRE',
        mapId,
        dureeMinutes,
        partenaireAssignmentId: assignA.id,
      },
    });
    const assignAUpdated = await prisma.familierEnclosAssignment.update({
      where: { id: assignA.id },
      data: { partenaireAssignmentId: assignB.id },
    });

    return { assignmentA: assignAUpdated, assignmentB: assignB };
  }

  async collectBreeding(assignmentId: number, personnageId: number) {
    const assignment = await prisma.familierEnclosAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        familier: { include: { race: true } },
        partenaireAssignment: { include: { familier: { include: { race: true } } } },
      },
    });
    if (!assignment) throw new Error('Assignment not found');
    if (assignment.familier.personnageId !== personnageId) throw new Error('Not your familier');
    if (assignment.enclosType !== 'RENCONTRE') throw new Error('Cet enclos n\'est pas une rencontre');

    const now = new Date();
    const minutesPassed = (now.getTime() - assignment.debutAt.getTime()) / 60000;
    if (minutesPassed < assignment.dureeMinutes) {
      throw new Error(`Rencontre pas encore terminée (${Math.ceil(assignment.dureeMinutes - minutesPassed)} min restantes)`);
    }

    const famA = assignment.familier;
    const famB = assignment.partenaireAssignment?.familier;
    if (!famB) throw new Error('Partenaire not found');

    // Déterminer la race de l'enfant
    const croisements = await prisma.familierCroisement.findMany({
      where: {
        OR: [
          { raceAId: famA.raceId, raceBId: famB.raceId },
          { raceAId: famB.raceId, raceBId: famA.raceId },
        ],
      },
    });

    const nombreEnfants = randomInt(1, 3);
    const enfants = [];

    for (let i = 0; i < nombreEnfants; i++) {
      let raceEnfantId: number;

      if (croisements.length > 0) {
        // Roll parmi les croisements (pondéré par probabilité)
        const totalProba = croisements.reduce((s, c) => s + c.probabilite, 0);
        let roll = Math.random() * totalProba;
        let chosen = croisements[0];
        for (const c of croisements) {
          roll -= c.probabilite;
          if (roll <= 0) { chosen = c; break; }
        }
        raceEnfantId = chosen.raceEnfantId;
      } else {
        // 50/50 race du père ou de la mère
        raceEnfantId = Math.random() < 0.5 ? famA.raceId : famB.raceId;
      }

      const statsA: StatBlock = {
        statForce: famA.statForce, statIntelligence: famA.statIntelligence,
        statDexterite: famA.statDexterite, statAgilite: famA.statAgilite,
        statVie: famA.statVie, statChance: famA.statChance,
        statPA: famA.statPA, statPM: famA.statPM, statPO: famA.statPO,
        statCritique: famA.statCritique, statDommages: famA.statDommages,
        statSoins: famA.statSoins,
      };
      const statsB: StatBlock = {
        statForce: famB.statForce, statIntelligence: famB.statIntelligence,
        statDexterite: famB.statDexterite, statAgilite: famB.statAgilite,
        statVie: famB.statVie, statChance: famB.statChance,
        statPA: famB.statPA, statPM: famB.statPM, statPO: famB.statPO,
        statCritique: famB.statCritique, statDommages: famB.statDommages,
        statSoins: famB.statSoins,
      };
      const childStats = inheritStats(statsA, statsB);

      const enfant = await this.createFamilier(famA.personnageId, raceEnfantId, {
        parentAId: famA.id,
        parentBId: famB.id,
        stats: childStats,
      });
      enfants.push(enfant);
    }

    // Supprimer les deux assignments
    const ids = [assignmentId, assignment.partenaireAssignmentId].filter(Boolean) as number[];
    // Dissocier les partenaires d'abord pour éviter la contrainte unique
    await prisma.familierEnclosAssignment.updateMany({
      where: { id: { in: ids } },
      data: { partenaireAssignmentId: null },
    });
    await prisma.familierEnclosAssignment.deleteMany({ where: { id: { in: ids } } });

    return { enfants, nombreEnfants };
  }

  // ==================== ENCLOS MAP VIEW ====================

  async getEnclosByMap(mapId: number) {
    return prisma.familierEnclosAssignment.findMany({
      where: { mapId },
      include: {
        familier: {
          include: {
            race: { include: { famille: true } },
            personnage: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { debutAt: 'asc' },
    });
  }

  // ==================== ADMIN RACES / FAMILLES ====================

  async getAllFamilles() {
    return prisma.familierFamille.findMany({ include: { races: true }, orderBy: { nom: 'asc' } });
  }

  async getFamilleById(id: number) {
    return prisma.familierFamille.findUnique({ where: { id }, include: { races: true } });
  }

  async createFamille(nom: string) {
    return prisma.familierFamille.create({ data: { nom } });
  }

  async updateFamille(id: number, nom: string) {
    return prisma.familierFamille.update({ where: { id }, data: { nom } });
  }

  async deleteFamille(id: number) {
    return prisma.familierFamille.delete({ where: { id } });
  }

  async getAllRaces() {
    return prisma.familierRace.findMany({
      include: { famille: true },
      orderBy: { nom: 'asc' },
    });
  }

  async getRaceById(id: number) {
    return prisma.familierRace.findUnique({
      where: { id },
      include: {
        famille: true,
        croisementsA: { include: { raceEnfant: true, raceB: true } },
        croisementsB: { include: { raceEnfant: true, raceA: true } },
      },
    });
  }

  async createRace(data: {
    nom: string; familleId: number; imageUrl?: string;
    spriteScale?: number; spriteOffsetX?: number; spriteOffsetY?: number; generation?: number;
    baseForce?: number; baseIntelligence?: number; baseDexterite?: number;
    baseAgilite?: number; baseVie?: number; baseChance?: number;
    basePA?: number; basePM?: number; basePO?: number;
    baseCritique?: number; baseDommages?: number; baseSoins?: number;
    croissanceForce?: number; croissanceIntelligence?: number; croissanceDexterite?: number;
    croissanceAgilite?: number; croissanceVie?: number; croissanceChance?: number;
    croissancePA?: number; croissancePM?: number; croissancePO?: number;
    croissanceCritique?: number; croissanceDommages?: number; croissanceSoins?: number;
  }) {
    return prisma.familierRace.create({ data, include: { famille: true } });
  }

  async updateRace(id: number, data: Partial<Parameters<typeof this.createRace>[0]>) {
    return prisma.familierRace.update({ where: { id }, data, include: { famille: true } });
  }

  async deleteRace(id: number) {
    return prisma.familierRace.delete({ where: { id } });
  }

  async getAllCroisements() {
    return prisma.familierCroisement.findMany({
      include: {
        raceA: { select: { id: true, nom: true, familleId: true } },
        raceB: { select: { id: true, nom: true, familleId: true } },
        raceEnfant: { select: { id: true, nom: true, familleId: true } },
      },
      orderBy: [{ raceAId: 'asc' }, { raceBId: 'asc' }],
    });
  }

  async getCroisementsByPaire(raceAId: number, raceBId: number) {
    return prisma.familierCroisement.findMany({
      where: {
        OR: [
          { raceAId, raceBId },
          { raceAId: raceBId, raceBId: raceAId },
        ],
      },
      include: {
        raceA: { select: { id: true, nom: true } },
        raceB: { select: { id: true, nom: true } },
        raceEnfant: { select: { id: true, nom: true } },
      },
    });
  }

  async addCroisement(raceAId: number, raceBId: number, raceEnfantId: number, probabilite: number = 1.0) {
    return prisma.familierCroisement.create({
      data: { raceAId, raceBId, raceEnfantId, probabilite },
      include: {
        raceA: { select: { id: true, nom: true } },
        raceB: { select: { id: true, nom: true } },
        raceEnfant: { select: { id: true, nom: true } },
      },
    });
  }

  async updateCroisement(id: number, probabilite: number) {
    return prisma.familierCroisement.update({
      where: { id },
      data: { probabilite },
      include: {
        raceA: { select: { id: true, nom: true } },
        raceB: { select: { id: true, nom: true } },
        raceEnfant: { select: { id: true, nom: true } },
      },
    });
  }

  async deleteCroisement(id: number) {
    return prisma.familierCroisement.delete({ where: { id } });
  }

  // ==================== RENAME ====================

  async renameFamilier(id: number, personnageId: number, nom: string) {
    const familier = await prisma.familier.findUnique({ where: { id } });
    if (!familier || familier.personnageId !== personnageId) throw new Error('Familier not found');
    return prisma.familier.update({ where: { id }, data: { nom }, include: { race: { include: { famille: true } } } });
  }
}

export const familierService = new FamilierService();
