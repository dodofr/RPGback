import { PrismaClient, StatType, ZoneType, SortType, SlotType, EffetType, RegionType, MapType, CombatMode, IAType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ==================== RACES (3) ====================
  const humain = await prisma.race.upsert({
    where: { nom: 'Humain' },
    update: {},
    create: {
      nom: 'Humain',
      bonusForce: 5, bonusIntelligence: 5, bonusDexterite: 5,
      bonusAgilite: 5, bonusVie: 5, bonusChance: 5,
    },
  });

  const elfe = await prisma.race.upsert({
    where: { nom: 'Elfe' },
    update: {},
    create: {
      nom: 'Elfe',
      bonusForce: 0, bonusIntelligence: 15, bonusDexterite: 10,
      bonusAgilite: 10, bonusVie: -5, bonusChance: 0,
    },
  });

  const nain = await prisma.race.upsert({
    where: { nom: 'Nain' },
    update: {},
    create: {
      nom: 'Nain',
      bonusForce: 15, bonusIntelligence: -5, bonusDexterite: 5,
      bonusAgilite: -5, bonusVie: 20, bonusChance: 0,
    },
  });

  console.log('Created 3 races');

  // ==================== ZONES (4) ====================
  const zoneCase = await prisma.zone.upsert({
    where: { id: 1 }, update: {},
    create: { nom: 'Case unique', type: ZoneType.CASE, taille: 0 },
  });

  const zoneCroix = await prisma.zone.upsert({
    where: { id: 2 }, update: {},
    create: { nom: 'Croix 1', type: ZoneType.CROIX, taille: 1 },
  });

  const zoneCercle = await prisma.zone.upsert({
    where: { id: 3 }, update: {},
    create: { nom: 'Cercle 2', type: ZoneType.CERCLE, taille: 2 },
  });

  const zoneLigne = await prisma.zone.upsert({
    where: { id: 4 }, update: {},
    create: { nom: 'Ligne 3', type: ZoneType.LIGNE, taille: 3 },
  });

  console.log('Created 4 zones');

  // ==================== SORTS (36 total, IDs séquentiels) ====================
  // IDs 1-12: Race combat (4 par race)
  // IDs 13-19: Monster combat (7)
  // IDs 20-22: Buff (1 par race)
  // IDs 23-25: Dispel (1 par race)
  // IDs 26-28: Soin (1 par race)
  // IDs 29-33: Invocation template spells (5)
  // IDs 34-36: Invocation race spells (3)

  // --- HUMAIN combat ---
  await prisma.sort.upsert({
    where: { id: 1 }, update: {},
    create: {
      nom: 'Frappe simple', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 12, degatsMax: 20, degatsCritMin: 30, degatsCritMax: 40,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 1, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 2 }, update: {},
    create: {
      nom: 'Tir arcanique', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 2, porteeMax: 5, ligneDeVue: true,
      degatsMin: 15, degatsMax: 25, degatsCritMin: 35, degatsCritMax: 45,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 4, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 3 }, update: {},
    create: {
      nom: 'Tourbillon', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 5, porteeMin: 0, porteeMax: 1, ligneDeVue: false,
      degatsMin: 10, degatsMax: 18, degatsCritMin: 25, degatsCritMax: 35,
      chanceCritBase: 0.05, cooldown: 2,
      niveauApprentissage: 7, raceId: humain.id, zoneId: zoneCroix.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 4 }, update: {},
    create: {
      nom: 'Explosion arcanique', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 6, porteeMin: 2, porteeMax: 6, ligneDeVue: true,
      degatsMin: 20, degatsMax: 35, degatsCritMin: 50, degatsCritMax: 60,
      chanceCritBase: 0.08, cooldown: 3, tauxEchec: 0.15,
      niveauApprentissage: 10, raceId: humain.id, zoneId: zoneCercle.id,
    },
  });

  // --- ELFE combat ---
  await prisma.sort.upsert({
    where: { id: 5 }, update: {},
    create: {
      nom: 'Flèche de lumière', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 2, porteeMax: 6, ligneDeVue: true,
      degatsMin: 15, degatsMax: 25, degatsCritMin: 40, degatsCritMax: 50,
      chanceCritBase: 0.08, cooldown: 0,
      niveauApprentissage: 1, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 6 }, update: {},
    create: {
      nom: 'Vent tranchant', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4, porteeMin: 2, porteeMax: 5, ligneDeVue: true,
      degatsMin: 12, degatsMax: 20, degatsCritMin: 30, degatsCritMax: 40,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 4, raceId: elfe.id, zoneId: zoneLigne.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 7 }, update: {},
    create: {
      nom: 'Boule de feu', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 5, porteeMin: 3, porteeMax: 7, ligneDeVue: true,
      degatsMin: 20, degatsMax: 35, degatsCritMin: 50, degatsCritMax: 60,
      chanceCritBase: 0.05, cooldown: 2,
      niveauApprentissage: 7, raceId: elfe.id, zoneId: zoneCercle.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 8 }, update: {},
    create: {
      nom: 'Tempête arcanique', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 6, porteeMin: 2, porteeMax: 8, ligneDeVue: true,
      degatsMin: 25, degatsMax: 45, degatsCritMin: 65, degatsCritMax: 75,
      chanceCritBase: 0.10, cooldown: 4, tauxEchec: 0.20,
      niveauApprentissage: 10, raceId: elfe.id, zoneId: zoneCercle.id,
    },
  });

  // --- NAIN combat ---
  await prisma.sort.upsert({
    where: { id: 9 }, update: {},
    create: {
      nom: 'Coup de hache', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 18, degatsMax: 28, degatsCritMin: 40, degatsCritMax: 50,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 1, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 10 }, update: {},
    create: {
      nom: 'Charge du bouclier', type: SortType.SORT, statUtilisee: StatType.VIE,
      coutPA: 4, porteeMin: 1, porteeMax: 2, ligneDeVue: true,
      degatsMin: 12, degatsMax: 20, degatsCritMin: 25, degatsCritMax: 35,
      chanceCritBase: 0.03, cooldown: 1,
      niveauApprentissage: 4, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 11 }, update: {},
    create: {
      nom: 'Marteau de guerre', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 5, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 25, degatsMax: 40, degatsCritMin: 55, degatsCritMax: 65,
      chanceCritBase: 0.08, cooldown: 2,
      niveauApprentissage: 7, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 12 }, update: {},
    create: {
      nom: 'Séisme', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 6, porteeMin: 0, porteeMax: 2, ligneDeVue: false,
      degatsMin: 20, degatsMax: 35, degatsCritMin: 45, degatsCritMax: 55,
      chanceCritBase: 0.05, cooldown: 3,
      niveauApprentissage: 10, raceId: nain.id, zoneId: zoneCercle.id,
    },
  });

  console.log('Created 12 race combat spells');

  // --- MONSTER COMBAT (IDs 13-19) ---
  // 13: Morsure du loup (Loup prio 1) — estVolDeVie FIX
  await prisma.sort.upsert({
    where: { id: 13 }, update: {},
    create: {
      nom: 'Morsure du loup', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 4, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 15, degatsMax: 25, degatsCritMin: 35, degatsCritMax: 45,
      chanceCritBase: 0.08, cooldown: 0, estVolDeVie: true,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 14: Griffure du loup (Loup prio 2)
  await prisma.sort.upsert({
    where: { id: 14 }, update: {},
    create: {
      nom: 'Griffure du loup', type: SortType.SORT, statUtilisee: StatType.AGILITE,
      coutPA: 3, porteeMin: 1, porteeMax: 2, ligneDeVue: true,
      degatsMin: 8, degatsMax: 14, degatsCritMin: 18, degatsCritMax: 28,
      chanceCritBase: 0.10, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 15: Coup de dague (Gobelin prio 1)
  await prisma.sort.upsert({
    where: { id: 15 }, update: {},
    create: {
      nom: 'Coup de dague', type: SortType.SORT, statUtilisee: StatType.DEXTERITE,
      coutPA: 3, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 10, degatsMax: 18, degatsCritMin: 25, degatsCritMax: 35,
      chanceCritBase: 0.10, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 16: Coup d'épée (Bandit prio 1)
  await prisma.sort.upsert({
    where: { id: 16 }, update: {},
    create: {
      nom: "Coup d'épée", type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 14, degatsMax: 22, degatsCritMin: 30, degatsCritMax: 40,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 17: Tir d'arbalète (Bandit prio 2)
  await prisma.sort.upsert({
    where: { id: 17 }, update: {},
    create: {
      nom: "Tir d'arbalète", type: SortType.SORT, statUtilisee: StatType.DEXTERITE,
      coutPA: 4, porteeMin: 3, porteeMax: 5, ligneDeVue: true,
      degatsMin: 12, degatsMax: 20, degatsCritMin: 28, degatsCritMax: 38,
      chanceCritBase: 0.08, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 18: Écrasement (Troll prio 1)
  await prisma.sort.upsert({
    where: { id: 18 }, update: {},
    create: {
      nom: 'Écrasement', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 4, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 25, degatsMax: 40, degatsCritMin: 55, degatsCritMax: 70,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 19: Lancer de rocher (Troll prio 2)
  await prisma.sort.upsert({
    where: { id: 19 }, update: {},
    create: {
      nom: 'Lancer de rocher', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 4, porteeMin: 2, porteeMax: 4, ligneDeVue: true,
      degatsMin: 18, degatsMax: 30, degatsCritMin: 40, degatsCritMax: 55,
      chanceCritBase: 0.05, cooldown: 1,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  console.log('Created 7 monster spells (IDs 13-19)');

  // --- BUFF (IDs 20-22) ---
  // 20: Cri de rage (Humain) — Rage sur lanceur
  await prisma.sort.upsert({
    where: { id: 20 }, update: {},
    create: {
      nom: 'Cri de rage', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 2, porteeMin: 0, porteeMax: 0, ligneDeVue: false,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 3,
      niveauApprentissage: 3, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  // 21: Méditation (Elfe) — Concentration sur lanceur
  await prisma.sort.upsert({
    where: { id: 21 }, update: {},
    create: {
      nom: 'Méditation', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 2, porteeMin: 0, porteeMax: 0, ligneDeVue: false,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 3,
      niveauApprentissage: 3, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  // 22: Pas lourd (Nain) — Agilité accrue sur lanceur
  await prisma.sort.upsert({
    where: { id: 22 }, update: {},
    create: {
      nom: 'Pas lourd', type: SortType.SORT, statUtilisee: StatType.VIE,
      coutPA: 2, porteeMin: 0, porteeMax: 0, ligneDeVue: false,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 3,
      niveauApprentissage: 3, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  console.log('Created 3 buff spells (IDs 20-22)');

  // --- DISPEL (IDs 23-25) ---
  await prisma.sort.upsert({
    where: { id: 23 }, update: {},
    create: {
      nom: 'Purification', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 1, porteeMax: 5, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 2, estDispel: true,
      niveauApprentissage: 1, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 24 }, update: {},
    create: {
      nom: 'Dissipation', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 1, porteeMax: 5, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 2, estDispel: true,
      niveauApprentissage: 1, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 25 }, update: {},
    create: {
      nom: 'Briseur de sorts', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 5, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 2, estDispel: true,
      niveauApprentissage: 1, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  console.log('Created 3 dispel spells (IDs 23-25)');

  // --- SOIN (IDs 26-28) ---
  await prisma.sort.upsert({
    where: { id: 26 }, update: {},
    create: {
      nom: 'Soin', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4, porteeMin: 1, porteeMax: 4, ligneDeVue: true,
      degatsMin: 15, degatsMax: 25, degatsCritMin: 30, degatsCritMax: 40,
      chanceCritBase: 0.05, cooldown: 2, estSoin: true,
      niveauApprentissage: 3, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 27 }, update: {},
    create: {
      nom: 'Soin de lumière', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 1, porteeMax: 5, ligneDeVue: true,
      degatsMin: 18, degatsMax: 30, degatsCritMin: 35, degatsCritMax: 50,
      chanceCritBase: 0.08, cooldown: 1, estSoin: true,
      niveauApprentissage: 1, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 28 }, update: {},
    create: {
      nom: 'Second souffle', type: SortType.SORT, statUtilisee: StatType.VIE,
      coutPA: 4, porteeMin: 0, porteeMax: 1, ligneDeVue: false,
      degatsMin: 20, degatsMax: 35, degatsCritMin: 40, degatsCritMax: 55,
      chanceCritBase: 0.05, cooldown: 3, estSoin: true,
      niveauApprentissage: 4, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  console.log('Created 3 heal spells (IDs 26-28)');

  // --- INVOCATION TEMPLATE SPELLS (IDs 29-33) ---
  // 29: Frappe de pierre (Gardien Pierre prio 1)
  await prisma.sort.upsert({
    where: { id: 29 }, update: {},
    create: {
      nom: 'Frappe de pierre', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 15, degatsMax: 25, degatsCritMin: 30, degatsCritMax: 45,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 30: Rayon lumineux (Esprit Lumière prio 2)
  await prisma.sort.upsert({
    where: { id: 30 }, update: {},
    create: {
      nom: 'Rayon lumineux', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 2, porteeMax: 5, ligneDeVue: true,
      degatsMin: 10, degatsMax: 18, degatsCritMin: 22, degatsCritMax: 32,
      chanceCritBase: 0.08, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 31: Soin mineur (Esprit Lumière prio 1)
  await prisma.sort.upsert({
    where: { id: 31 }, update: {},
    create: {
      nom: 'Soin mineur', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 1, porteeMax: 4, ligneDeVue: true,
      degatsMin: 10, degatsMax: 18, degatsCritMin: 20, degatsCritMax: 30,
      chanceCritBase: 0.05, cooldown: 1, estSoin: true,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 32: Poing arcanique (Golem Arcanique prio 1)
  await prisma.sort.upsert({
    where: { id: 32 }, update: {},
    create: {
      nom: 'Poing arcanique', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 1, ligneDeVue: true,
      degatsMin: 12, degatsMax: 20, degatsCritMin: 25, degatsCritMax: 38,
      chanceCritBase: 0.05, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  // 33: Rayon arcanique (Golem Arcanique prio 2)
  await prisma.sort.upsert({
    where: { id: 33 }, update: {},
    create: {
      nom: 'Rayon arcanique', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4, porteeMin: 2, porteeMax: 4, ligneDeVue: true,
      degatsMin: 10, degatsMax: 18, degatsCritMin: 22, degatsCritMax: 32,
      chanceCritBase: 0.08, cooldown: 0,
      niveauApprentissage: 1, raceId: null, zoneId: zoneCase.id,
    },
  });

  console.log('Created 5 invocation spells (IDs 29-33)');

  // ==================== EFFETS (14) ====================
  await prisma.effet.upsert({ where: { id: 1 }, update: {}, create: { nom: 'Rage', type: EffetType.BUFF, statCiblee: StatType.FORCE, valeur: 20, duree: 3 } });
  await prisma.effet.upsert({ where: { id: 2 }, update: {}, create: { nom: 'Concentration', type: EffetType.BUFF, statCiblee: StatType.INTELLIGENCE, valeur: 15, duree: 2 } });
  await prisma.effet.upsert({ where: { id: 3 }, update: {}, create: { nom: 'Agilité accrue', type: EffetType.BUFF, statCiblee: StatType.AGILITE, valeur: 25, duree: 2 } });
  await prisma.effet.upsert({ where: { id: 4 }, update: {}, create: { nom: 'Affaiblissement', type: EffetType.DEBUFF, statCiblee: StatType.FORCE, valeur: -15, duree: 2 } });
  await prisma.effet.upsert({ where: { id: 5 }, update: {}, create: { nom: 'Ralentissement', type: EffetType.DEBUFF, statCiblee: StatType.AGILITE, valeur: -20, duree: 2 } });
  await prisma.effet.upsert({ where: { id: 6 }, update: {}, create: { nom: 'Dispel', type: EffetType.DISPEL, statCiblee: StatType.VIE, valeur: 0, duree: 0 } });
  await prisma.effet.upsert({ where: { id: 7 }, update: {}, create: { nom: 'Souffle', type: EffetType.POUSSEE, statCiblee: StatType.FORCE, valeur: 2, duree: 0 } });
  await prisma.effet.upsert({ where: { id: 8 }, update: {}, create: { nom: 'Attraction', type: EffetType.ATTIRANCE, statCiblee: StatType.FORCE, valeur: 3, duree: 0 } });
  // Poison: cumulable = true pour permettre l'empilement de plusieurs sources
  await prisma.effet.upsert({ where: { id: 9 }, update: { cumulable: true }, create: { nom: 'Poison', type: EffetType.POISON, statCiblee: StatType.FORCE, valeurMin: 10, valeur: 20, duree: 2, cumulable: true } });
  await prisma.effet.upsert({ where: { id: 10 }, update: {}, create: { nom: 'Jambes lourdes', type: EffetType.DEBUFF, statCiblee: StatType.PA, valeur: -2, duree: 2 } });
  await prisma.effet.upsert({ where: { id: 11 }, update: {}, create: { nom: 'Enracinement', type: EffetType.DEBUFF, statCiblee: StatType.PM, valeur: -3, duree: 1 } });
  await prisma.effet.upsert({ where: { id: 12 }, update: {}, create: { nom: 'Vue brouillée', type: EffetType.DEBUFF, statCiblee: StatType.PO, valeur: -2, duree: 2 } });
  await prisma.effet.upsert({ where: { id: 13 }, update: {}, create: { nom: 'Précision', type: EffetType.BUFF, statCiblee: StatType.CRITIQUE, valeur: 10, duree: 3 } });
  await prisma.effet.upsert({ where: { id: 14 }, update: {}, create: { nom: 'Maladresse', type: EffetType.DEBUFF, statCiblee: StatType.CRITIQUE, valeur: -10, duree: 2 } });
  // Boucliers: réduisent les dégâts d'une stat donnée (valeur calculée au cast via stat du lanceur)
  await prisma.effet.upsert({ where: { id: 15 }, update: {}, create: { nom: 'Bouclier de force', type: EffetType.BOUCLIER, statCiblee: StatType.FORCE, valeurMin: 10, valeur: 20, duree: 3 } });
  await prisma.effet.upsert({ where: { id: 16 }, update: {}, create: { nom: 'Bouclier arcanique', type: EffetType.BOUCLIER, statCiblee: StatType.INTELLIGENCE, valeurMin: 8, valeur: 15, duree: 3 } });

  console.log('Created 16 effects (dont 2 boucliers, poison cumulable)');

  // ==================== SORT EFFETS ====================
  // Cri de rage (20) → Rage (1) sur lanceur
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 20, effetId: 1 } }, update: {},
    create: { sortId: 20, effetId: 1, chanceDeclenchement: 1.0, surCible: false },
  });

  // Méditation (21) → Concentration (2) sur lanceur
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 21, effetId: 2 } }, update: {},
    create: { sortId: 21, effetId: 2, chanceDeclenchement: 1.0, surCible: false },
  });

  // Pas lourd (22) → Agilité accrue (3) sur lanceur
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 22, effetId: 3 } }, update: {},
    create: { sortId: 22, effetId: 3, chanceDeclenchement: 1.0, surCible: false },
  });

  // Dispels (23-25) → Dispel (6) sur cible
  for (const sortId of [23, 24, 25]) {
    await prisma.sortEffet.upsert({
      where: { sortId_effetId: { sortId, effetId: 6 } }, update: {},
      create: { sortId, effetId: 6, chanceDeclenchement: 1.0, surCible: true },
    });
  }

  // Écrasement (18) → Souffle (7) 25% sur cible
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 18, effetId: 7 } }, update: {},
    create: { sortId: 18, effetId: 7, chanceDeclenchement: 0.25, surCible: true },
  });

  console.log('Created spell-effect links');

  // ==================== REGIONS (2) ====================
  const foretVertbois = await prisma.region.upsert({
    where: { nom: 'Forêt de Vertbois' }, update: {},
    create: {
      nom: 'Forêt de Vertbois',
      description: 'Une forêt dense et mystérieuse aux arbres centenaires.',
      type: RegionType.FORET, niveauMin: 1, niveauMax: 5,
    },
  });

  const plainesDuSud = await prisma.region.upsert({
    where: { nom: 'Plaines du Sud' }, update: {},
    create: {
      nom: 'Plaines du Sud',
      description: 'De vastes étendues herbeuses parsemées de villages.',
      type: RegionType.PLAINE, niveauMin: 1, niveauMax: 3,
    },
  });

  console.log('Created 2 regions');

  // ==================== MONSTER TEMPLATES (4 + 3 invocations) ====================
  const gobelin = await prisma.monstreTemplate.upsert({
    where: { id: 1 }, update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Gobelin',
      force: 8, intelligence: 5, dexterite: 12, agilite: 15, vie: 6, chance: 5,
      pvBase: 30, paBase: 6, pmBase: 4,
      niveauBase: 1, xpRecompense: 15, iaType: IAType.AGGRESSIF,
    },
  });

  const loup = await prisma.monstreTemplate.upsert({
    where: { id: 2 }, update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Loup',
      force: 12, intelligence: 3, dexterite: 10, agilite: 18, vie: 8, chance: 5,
      pvBase: 35, paBase: 6, pmBase: 5,
      niveauBase: 1, xpRecompense: 20, iaType: IAType.AGGRESSIF,
    },
  });

  const bandit = await prisma.monstreTemplate.upsert({
    where: { id: 3 }, update: { iaType: IAType.EQUILIBRE },
    create: {
      nom: 'Bandit',
      force: 14, intelligence: 8, dexterite: 12, agilite: 10, vie: 12, chance: 8,
      pvBase: 50, paBase: 6, pmBase: 3,
      niveauBase: 2, xpRecompense: 30, iaType: IAType.EQUILIBRE,
    },
  });

  const trollDesForets = await prisma.monstreTemplate.upsert({
    where: { id: 4 }, update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Troll des Forêts',
      force: 25, intelligence: 4, dexterite: 6, agilite: 5, vie: 30, chance: 3,
      pvBase: 120, paBase: 6, pmBase: 2,
      niveauBase: 5, xpRecompense: 100, iaType: IAType.AGGRESSIF,
    },
  });

  // Invocation templates
  const gardienPierre = await prisma.monstreTemplate.upsert({
    where: { id: 5 }, update: { iaType: IAType.AGGRESSIF, pvScalingInvocation: 0.25 },
    create: {
      nom: 'Gardien de Pierre',
      force: 15, intelligence: 3, dexterite: 5, agilite: 5, vie: 20, chance: 3,
      pvBase: 60, paBase: 6, pmBase: 2,
      niveauBase: 5, xpRecompense: 0,
      iaType: IAType.AGGRESSIF, pvScalingInvocation: 0.25,
    },
  });

  const espritLumiere = await prisma.monstreTemplate.upsert({
    where: { id: 6 }, update: { iaType: IAType.SOUTIEN, pvScalingInvocation: 0.10 },
    create: {
      nom: 'Esprit de Lumière',
      force: 3, intelligence: 18, dexterite: 8, agilite: 12, vie: 8, chance: 5,
      pvBase: 30, paBase: 6, pmBase: 3,
      niveauBase: 5, xpRecompense: 0,
      iaType: IAType.SOUTIEN, pvScalingInvocation: 0.10,
    },
  });

  const golemArcanique = await prisma.monstreTemplate.upsert({
    where: { id: 7 }, update: { iaType: IAType.EQUILIBRE, pvScalingInvocation: 0.25 },
    create: {
      nom: 'Golem Arcanique',
      force: 12, intelligence: 12, dexterite: 6, agilite: 6, vie: 15, chance: 5,
      pvBase: 50, paBase: 6, pmBase: 3,
      niveauBase: 5, xpRecompense: 0,
      iaType: IAType.EQUILIBRE, pvScalingInvocation: 0.25,
    },
  });

  console.log('Created 7 monster templates (4 enemies + 3 invocations)');

  // Monster gold
  await prisma.monstreTemplate.update({ where: { id: gobelin.id }, data: { orMin: 1, orMax: 5 } });
  await prisma.monstreTemplate.update({ where: { id: loup.id }, data: { orMin: 2, orMax: 4 } });
  await prisma.monstreTemplate.update({ where: { id: bandit.id }, data: { orMin: 3, orMax: 10 } });
  await prisma.monstreTemplate.update({ where: { id: trollDesForets.id }, data: { orMin: 10, orMax: 25 } });

  // ==================== INVOCATION RACE SPELLS (IDs 34-36) ====================
  // Must be created after monster templates (need invocationTemplateId)
  // Invocations: porteeModifiable: false (portée fixe, non influencée par buffs/équipement)
  await prisma.sort.upsert({
    where: { id: 34 }, update: { porteeModifiable: false },
    create: {
      nom: 'Invoquer Golem', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 5, porteeMin: 1, porteeMax: 3, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 5,
      estInvocation: true, invocationTemplateId: golemArcanique.id,
      porteeModifiable: false,
      niveauApprentissage: 5, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 35 }, update: { porteeModifiable: false },
    create: {
      nom: 'Invoquer Esprit', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4, porteeMin: 1, porteeMax: 3, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 5,
      estInvocation: true, invocationTemplateId: espritLumiere.id,
      porteeModifiable: false,
      niveauApprentissage: 5, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 36 }, update: { porteeModifiable: false },
    create: {
      nom: 'Invoquer Gardien', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 5, porteeMin: 1, porteeMax: 2, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 5,
      estInvocation: true, invocationTemplateId: gardienPierre.id,
      porteeModifiable: false,
      niveauApprentissage: 5, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  console.log('Created 3 invocation race spells (IDs 34-36, porteeModifiable: false)');

  // --- BOUCLIERS (IDs 37-39) — un par race, niv 7 ---
  // 37: Bouclier de roc (Nain) — pose un bouclier FORCE sur le lanceur
  await prisma.sort.upsert({
    where: { id: 37 }, update: {},
    create: {
      nom: 'Bouclier de roc', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 0, porteeMax: 0, ligneDeVue: false,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 4, porteeModifiable: false,
      niveauApprentissage: 7, raceId: nain.id, zoneId: zoneCase.id,
    },
  });

  // 38: Bouclier de lumière (Elfe) — bouclier arcanique sur une cible alliée (portée 3)
  await prisma.sort.upsert({
    where: { id: 38 }, update: {},
    create: {
      nom: 'Bouclier de lumière', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3, porteeMin: 0, porteeMax: 3, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 3,
      niveauApprentissage: 7, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  // 39: Garde du corps (Humain) — bouclier FORCE sur une cible alliée (portée 2)
  await prisma.sort.upsert({
    where: { id: 39 }, update: {},
    create: {
      nom: 'Garde du corps', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 0, porteeMax: 2, ligneDeVue: true,
      degatsMin: 0, degatsMax: 0, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 3,
      niveauApprentissage: 7, raceId: humain.id, zoneId: zoneCase.id,
    },
  });

  console.log('Created 3 bouclier spells (IDs 37-39)');

  // --- GLYPHE (ID 40) — Elfe niv 8, dégâts INT au sol ---
  // 40: Marque ardente (Elfe) — pose un glyphe pendant 3 tours, dégâts INTELLIGENCE
  await prisma.sort.upsert({
    where: { id: 40 }, update: {},
    create: {
      nom: 'Marque ardente', type: SortType.SORT, statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4, porteeMin: 1, porteeMax: 5, ligneDeVue: true,
      degatsMin: 12, degatsMax: 20, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 3,
      estGlyphe: true, poseDuree: 3,
      niveauApprentissage: 8, raceId: elfe.id, zoneId: zoneCase.id,
    },
  });

  // --- PIÈGE (ID 41) — Nain niv 8, dégâts FORCE + Enracinement ---
  // 41: Piège à ours (Nain) — pose un piège invisible pendant 5 tours, dégâts FORCE + enracinement
  await prisma.sort.upsert({
    where: { id: 41 }, update: {},
    create: {
      nom: 'Piège à ours', type: SortType.SORT, statUtilisee: StatType.FORCE,
      coutPA: 3, porteeMin: 1, porteeMax: 3, ligneDeVue: false,
      degatsMin: 15, degatsMax: 25, degatsCritMin: 0, degatsCritMax: 0,
      chanceCritBase: 0, cooldown: 2,
      estPiege: true, poseDuree: 5,
      niveauApprentissage: 8, raceId: nain.id, zoneId: zoneCroix.id,
    },
  });

  console.log('Created 2 zone spells: glyphe (40) + piège (41)');

  // SortEffets pour les nouveaux sorts (après leur création)
  // Bouclier de roc (37) → Bouclier de force (15) sur le lanceur
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 37, effetId: 15 } }, update: {},
    create: { sortId: 37, effetId: 15, chanceDeclenchement: 1.0, surCible: false },
  });
  // Bouclier de lumière (38) → Bouclier arcanique (16) sur la cible
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 38, effetId: 16 } }, update: {},
    create: { sortId: 38, effetId: 16, chanceDeclenchement: 1.0, surCible: true },
  });
  // Garde du corps (39) → Bouclier de force (15) sur la cible
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 39, effetId: 15 } }, update: {},
    create: { sortId: 39, effetId: 15, chanceDeclenchement: 1.0, surCible: true },
  });
  // Piège à ours (41) → Enracinement (11) sur la cible déclenchante
  await prisma.sortEffet.upsert({
    where: { sortId_effetId: { sortId: 41, effetId: 11 } }, update: {},
    create: { sortId: 41, effetId: 11, chanceDeclenchement: 1.0, surCible: true },
  });
  console.log('Created sort-effet links for new spells (boucliers + piège)');

  // ==================== MAPS (10) ====================
  const oreeForet = await prisma.map.upsert({
    where: { id: 1 }, update: { worldX: 2, worldY: 1 },
    create: {
      nom: 'Orée de la forêt', regionId: foretVertbois.id,
      type: MapType.WILDERNESS, combatMode: CombatMode.MANUEL,
      largeur: 20, hauteur: 15, tauxRencontre: 0.2, worldX: 2, worldY: 1,
    },
  });

  const sentierForestier = await prisma.map.upsert({
    where: { id: 2 }, update: { worldX: 3, worldY: 1 },
    create: {
      nom: 'Sentier forestier', regionId: foretVertbois.id,
      type: MapType.WILDERNESS, combatMode: CombatMode.MANUEL,
      largeur: 25, hauteur: 12, tauxRencontre: 0.25, worldX: 3, worldY: 1,
    },
  });

  // Map 3 (Grotte aux Gobelins) supprimée — accessible uniquement via portail de donjon
  await prisma.grilleCombat.deleteMany({ where: { mapId: 3 } });
  await prisma.mapConnection.deleteMany({ where: { OR: [{ fromMapId: 3 }, { toMapId: 3 }] } });
  await prisma.groupeEnnemi.deleteMany({ where: { mapId: 3 } });
  await prisma.map.deleteMany({ where: { id: 3 } });

  const clairiere = await prisma.map.upsert({
    where: { id: 4 }, update: { worldX: 3, worldY: 2 },
    create: {
      nom: 'Clairière paisible', regionId: foretVertbois.id,
      type: MapType.SAFE, combatMode: CombatMode.MANUEL,
      largeur: 10, hauteur: 10, tauxRencontre: 0, worldX: 3, worldY: 2,
    },
  });

  const routeCommerciale = await prisma.map.upsert({
    where: { id: 5 }, update: { worldX: 1, worldY: 1 },
    create: {
      nom: 'Route commerciale', regionId: plainesDuSud.id,
      type: MapType.WILDERNESS, combatMode: CombatMode.MANUEL,
      largeur: 30, hauteur: 10, tauxRencontre: 0.15, worldX: 1, worldY: 1,
    },
  });

  const villageDepart = await prisma.map.upsert({
    where: { id: 6 }, update: { worldX: 0, worldY: 1 },
    create: {
      nom: 'Village de Piedmont', regionId: plainesDuSud.id,
      type: MapType.VILLE, combatMode: CombatMode.MANUEL,
      largeur: 20, hauteur: 20, tauxRencontre: 0, worldX: 0, worldY: 1,
    },
  });

  const donjonSalle1 = await prisma.map.upsert({
    where: { id: 7 }, update: {},
    create: {
      nom: 'Grotte - Entrée', regionId: foretVertbois.id,
      type: MapType.DONJON, combatMode: CombatMode.AUTO,
      largeur: 15, hauteur: 10, tauxRencontre: 1.0,
    },
  });

  const donjonSalle2 = await prisma.map.upsert({
    where: { id: 8 }, update: {},
    create: {
      nom: 'Grotte - Passage étroit', regionId: foretVertbois.id,
      type: MapType.DONJON, combatMode: CombatMode.AUTO,
      largeur: 15, hauteur: 10, tauxRencontre: 1.0,
    },
  });

  const donjonSalle3 = await prisma.map.upsert({
    where: { id: 9 }, update: {},
    create: {
      nom: 'Grotte - Salle des créatures', regionId: foretVertbois.id,
      type: MapType.DONJON, combatMode: CombatMode.AUTO,
      largeur: 15, hauteur: 10, tauxRencontre: 1.0,
    },
  });

  const donjonSalle4 = await prisma.map.upsert({
    where: { id: 10 }, update: {},
    create: {
      nom: 'Grotte - Antre du Troll', regionId: foretVertbois.id,
      type: MapType.BOSS, combatMode: CombatMode.AUTO,
      largeur: 15, hauteur: 10, tauxRencontre: 1.0,
    },
  });

  console.log('Created 9 maps (Map 3 deleted)');

  // ==================== MAP CONNECTIONS ====================
  await prisma.mapConnection.upsert({ where: { id: 1 }, update: {}, create: { fromMapId: oreeForet.id, toMapId: sentierForestier.id, positionX: 19, positionY: 7, nom: 'Vers le sentier forestier' } });
  await prisma.mapConnection.upsert({ where: { id: 2 }, update: {}, create: { fromMapId: sentierForestier.id, toMapId: oreeForet.id, positionX: 0, positionY: 6, nom: "Retour à l'orée" } });
  // MapConnections id=3 et id=4 (vers Grotte aux Gobelins) supprimées avec la map
  await prisma.mapConnection.upsert({ where: { id: 5 }, update: {}, create: { fromMapId: sentierForestier.id, toMapId: clairiere.id, positionX: 12, positionY: 11, nom: 'Chemin vers la clairière' } });
  await prisma.mapConnection.upsert({ where: { id: 6 }, update: {}, create: { fromMapId: clairiere.id, toMapId: sentierForestier.id, positionX: 5, positionY: 0, nom: 'Retour au sentier' } });
  await prisma.mapConnection.upsert({ where: { id: 7 }, update: {}, create: { fromMapId: villageDepart.id, toMapId: routeCommerciale.id, positionX: 19, positionY: 10, nom: 'Sortie du village (Est)' } });
  await prisma.mapConnection.upsert({ where: { id: 8 }, update: {}, create: { fromMapId: routeCommerciale.id, toMapId: villageDepart.id, positionX: 0, positionY: 5, nom: 'Vers le village' } });
  await prisma.mapConnection.upsert({ where: { id: 9 }, update: {}, create: { fromMapId: routeCommerciale.id, toMapId: oreeForet.id, positionX: 29, positionY: 5, nom: 'Vers la Forêt de Vertbois' } });
  await prisma.mapConnection.upsert({ where: { id: 10 }, update: {}, create: { fromMapId: oreeForet.id, toMapId: routeCommerciale.id, positionX: 0, positionY: 7, nom: 'Vers les Plaines du Sud' } });

  console.log('Created 10 map connections');

  // ==================== MAP DIRECTIONAL NEIGHBORS ====================
  await prisma.map.update({ where: { id: oreeForet.id }, data: { estMapId: sentierForestier.id, ouestMapId: routeCommerciale.id } });
  await prisma.map.update({ where: { id: sentierForestier.id }, data: { ouestMapId: oreeForet.id, nordMapId: null, sudMapId: clairiere.id } });
  await prisma.map.update({ where: { id: clairiere.id }, data: { nordMapId: sentierForestier.id } });
  await prisma.map.update({ where: { id: routeCommerciale.id }, data: { ouestMapId: villageDepart.id, estMapId: oreeForet.id } });
  await prisma.map.update({ where: { id: villageDepart.id }, data: { estMapId: routeCommerciale.id } });

  console.log('Set directional neighbors');

  // ==================== REGION MONSTRES ====================
  await prisma.regionMonstre.upsert({ where: { id: 1 }, update: {}, create: { regionId: foretVertbois.id, monstreId: gobelin.id, probabilite: 0.50 } });
  await prisma.regionMonstre.upsert({ where: { id: 2 }, update: {}, create: { regionId: foretVertbois.id, monstreId: loup.id, probabilite: 0.50 } });
  // Troll des Forêts retiré de la région (boss de donjon uniquement, pas en spawn extérieur)
  await prisma.regionMonstre.deleteMany({ where: { monstreId: trollDesForets.id } });
  await prisma.regionMonstre.upsert({ where: { id: 4 }, update: {}, create: { regionId: plainesDuSud.id, monstreId: bandit.id, probabilite: 0.60 } });
  await prisma.regionMonstre.upsert({ where: { id: 5 }, update: {}, create: { regionId: plainesDuSud.id, monstreId: loup.id, probabilite: 0.40 } });

  console.log('Created 4 region-monster links (Troll boss-only)');

  // ==================== MONSTRE SORTS ====================
  // Normal monsters
  await prisma.monstreSort.upsert({ where: { id: 1 }, update: {}, create: { monstreId: loup.id, sortId: 13, priorite: 1 } });          // Morsure du loup
  await prisma.monstreSort.upsert({ where: { id: 2 }, update: {}, create: { monstreId: loup.id, sortId: 14, priorite: 2 } });          // Griffure du loup
  await prisma.monstreSort.upsert({ where: { id: 3 }, update: {}, create: { monstreId: gobelin.id, sortId: 15, priorite: 1 } });       // Coup de dague
  await prisma.monstreSort.upsert({ where: { id: 4 }, update: {}, create: { monstreId: bandit.id, sortId: 16, priorite: 1 } });        // Coup d'épée
  await prisma.monstreSort.upsert({ where: { id: 5 }, update: {}, create: { monstreId: bandit.id, sortId: 17, priorite: 2 } });        // Tir d'arbalète
  await prisma.monstreSort.upsert({ where: { id: 6 }, update: {}, create: { monstreId: trollDesForets.id, sortId: 18, priorite: 1 } }); // Écrasement
  await prisma.monstreSort.upsert({ where: { id: 7 }, update: {}, create: { monstreId: trollDesForets.id, sortId: 19, priorite: 2 } }); // Lancer de rocher
  // Invocation monsters
  await prisma.monstreSort.upsert({ where: { id: 8 }, update: {}, create: { monstreId: gardienPierre.id, sortId: 29, priorite: 1 } });  // Frappe de pierre
  await prisma.monstreSort.upsert({ where: { id: 9 }, update: {}, create: { monstreId: espritLumiere.id, sortId: 31, priorite: 1 } });  // Soin mineur
  await prisma.monstreSort.upsert({ where: { id: 10 }, update: {}, create: { monstreId: espritLumiere.id, sortId: 30, priorite: 2 } }); // Rayon lumineux
  await prisma.monstreSort.upsert({ where: { id: 11 }, update: {}, create: { monstreId: golemArcanique.id, sortId: 32, priorite: 1 } }); // Poing arcanique
  await prisma.monstreSort.upsert({ where: { id: 12 }, update: {}, create: { monstreId: golemArcanique.id, sortId: 33, priorite: 2 } }); // Rayon arcanique

  console.log('Created 12 monster-spell links');

  // ==================== GROUPES ENNEMIS (6) ====================
  const groupe1 = await prisma.groupeEnnemi.upsert({
    where: { id: 1 }, update: {},
    create: { mapId: oreeForet.id, positionX: 15, positionY: 8, respawnTime: 300 },
  });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 1 }, update: {}, create: { groupeEnnemiId: groupe1.id, monstreId: loup.id, quantite: 3, niveau: 1 } });

  const groupe2 = await prisma.groupeEnnemi.upsert({
    where: { id: 2 }, update: {},
    create: { mapId: oreeForet.id, positionX: 10, positionY: 12, respawnTime: 300 },
  });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 2 }, update: {}, create: { groupeEnnemiId: groupe2.id, monstreId: gobelin.id, quantite: 2, niveau: 1 } });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 3 }, update: {}, create: { groupeEnnemiId: groupe2.id, monstreId: loup.id, quantite: 1, niveau: 2 } });

  const groupe3 = await prisma.groupeEnnemi.upsert({
    where: { id: 3 }, update: {},
    create: { mapId: sentierForestier.id, positionX: 12, positionY: 6, respawnTime: 300 },
  });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 4 }, update: {}, create: { groupeEnnemiId: groupe3.id, monstreId: gobelin.id, quantite: 4, niveau: 2 } });

  const groupe4 = await prisma.groupeEnnemi.upsert({
    where: { id: 4 }, update: {},
    create: { mapId: sentierForestier.id, positionX: 20, positionY: 8, respawnTime: 300 },
  });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 5 }, update: {}, create: { groupeEnnemiId: groupe4.id, monstreId: loup.id, quantite: 2, niveau: 2 } });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 6 }, update: {}, create: { groupeEnnemiId: groupe4.id, monstreId: gobelin.id, quantite: 2, niveau: 3 } });

  const groupe5 = await prisma.groupeEnnemi.upsert({
    where: { id: 5 }, update: {},
    create: { mapId: routeCommerciale.id, positionX: 15, positionY: 5, respawnTime: 300 },
  });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 7 }, update: {}, create: { groupeEnnemiId: groupe5.id, monstreId: bandit.id, quantite: 3, niveau: 2 } });

  const groupe6 = await prisma.groupeEnnemi.upsert({
    where: { id: 6 }, update: {},
    create: { mapId: routeCommerciale.id, positionX: 25, positionY: 3, respawnTime: 300 },
  });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 8 }, update: {}, create: { groupeEnnemiId: groupe6.id, monstreId: bandit.id, quantite: 2, niveau: 2 } });
  await prisma.groupeEnnemiMembre.upsert({ where: { id: 9 }, update: {}, create: { groupeEnnemiId: groupe6.id, monstreId: loup.id, quantite: 2, niveau: 1 } });

  console.log('Created 6 enemy groups');

  // ==================== DONJON ====================
  const grotteGobelinsDonjon = await prisma.donjon.upsert({
    where: { id: 1 }, update: {},
    create: {
      nom: 'Grotte aux Gobelins',
      description: 'Un réseau de cavernes infesté de gobelins et de créatures dangereuses. Terminez les 4 salles pour vaincre le Troll des Forêts!',
      regionId: foretVertbois.id, niveauMin: 1, niveauMax: 3,
      bossId: trollDesForets.id,
    },
  });

  await prisma.donjonSalle.upsert({ where: { id: 1 }, update: {}, create: { donjonId: grotteGobelinsDonjon.id, ordre: 1, mapId: donjonSalle1.id } });
  await prisma.donjonSalle.upsert({ where: { id: 2 }, update: {}, create: { donjonId: grotteGobelinsDonjon.id, ordre: 2, mapId: donjonSalle2.id } });
  await prisma.donjonSalle.upsert({ where: { id: 3 }, update: {}, create: { donjonId: grotteGobelinsDonjon.id, ordre: 3, mapId: donjonSalle3.id } });
  await prisma.donjonSalle.upsert({ where: { id: 4 }, update: {}, create: { donjonId: grotteGobelinsDonjon.id, ordre: 4, mapId: donjonSalle4.id } });

  console.log('Created 1 dungeon with 4 rooms');

  // Dungeon portal
  await prisma.mapConnection.upsert({
    where: { id: 11 }, update: {},
    create: {
      fromMapId: oreeForet.id, toMapId: donjonSalle1.id,
      positionX: 12, positionY: 5,
      nom: 'Entrée de la grotte aux gobelins',
      donjonId: grotteGobelinsDonjon.id,
    },
  });

  console.log('Created dungeon portal');

  // ==================== DONJON SALLE COMPOSITIONS ====================
  // Salle 1 (id=1) — Grotte - Entrée
  await prisma.donjonSalleComposition.upsert({ where: { id: 1 }, update: {}, create: { salleId: 1, difficulte: 4, monstreTemplateId: gobelin.id, niveau: 3, quantite: 3 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 2 }, update: {}, create: { salleId: 1, difficulte: 4, monstreTemplateId: loup.id, niveau: 3, quantite: 1 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 3 }, update: {}, create: { salleId: 1, difficulte: 6, monstreTemplateId: gobelin.id, niveau: 3, quantite: 4 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 4 }, update: {}, create: { salleId: 1, difficulte: 6, monstreTemplateId: loup.id, niveau: 3, quantite: 2 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 5 }, update: {}, create: { salleId: 1, difficulte: 8, monstreTemplateId: gobelin.id, niveau: 4, quantite: 5 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 6 }, update: {}, create: { salleId: 1, difficulte: 8, monstreTemplateId: loup.id, niveau: 3, quantite: 3 } });

  // Salle 2 (id=2) — Grotte - Passage étroit
  await prisma.donjonSalleComposition.upsert({ where: { id: 7 }, update: {}, create: { salleId: 2, difficulte: 4, monstreTemplateId: gobelin.id, niveau: 4, quantite: 2 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 8 }, update: {}, create: { salleId: 2, difficulte: 4, monstreTemplateId: loup.id, niveau: 4, quantite: 2 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 9 }, update: {}, create: { salleId: 2, difficulte: 6, monstreTemplateId: gobelin.id, niveau: 4, quantite: 3 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 10 }, update: {}, create: { salleId: 2, difficulte: 6, monstreTemplateId: loup.id, niveau: 4, quantite: 3 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 11 }, update: {}, create: { salleId: 2, difficulte: 8, monstreTemplateId: gobelin.id, niveau: 5, quantite: 4 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 12 }, update: {}, create: { salleId: 2, difficulte: 8, monstreTemplateId: loup.id, niveau: 4, quantite: 4 } });

  // Salle 3 (id=3) — Grotte - Salle des créatures
  await prisma.donjonSalleComposition.upsert({ where: { id: 13 }, update: {}, create: { salleId: 3, difficulte: 4, monstreTemplateId: gobelin.id, niveau: 5, quantite: 2 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 14 }, update: {}, create: { salleId: 3, difficulte: 4, monstreTemplateId: loup.id, niveau: 5, quantite: 2 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 15 }, update: {}, create: { salleId: 3, difficulte: 6, monstreTemplateId: gobelin.id, niveau: 5, quantite: 3 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 16 }, update: {}, create: { salleId: 3, difficulte: 6, monstreTemplateId: loup.id, niveau: 5, quantite: 3 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 17 }, update: {}, create: { salleId: 3, difficulte: 8, monstreTemplateId: gobelin.id, niveau: 5, quantite: 4 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 18 }, update: {}, create: { salleId: 3, difficulte: 8, monstreTemplateId: loup.id, niveau: 5, quantite: 4 } });

  // Salle 4 (id=4) — Antre du Troll (boss)
  await prisma.donjonSalleComposition.upsert({ where: { id: 19 }, update: {}, create: { salleId: 4, difficulte: 4, monstreTemplateId: trollDesForets.id, niveau: 8, quantite: 1 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 20 }, update: {}, create: { salleId: 4, difficulte: 4, monstreTemplateId: gobelin.id, niveau: 4, quantite: 3 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 21 }, update: {}, create: { salleId: 4, difficulte: 6, monstreTemplateId: trollDesForets.id, niveau: 9, quantite: 1 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 22 }, update: {}, create: { salleId: 4, difficulte: 6, monstreTemplateId: gobelin.id, niveau: 4, quantite: 5 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 23 }, update: {}, create: { salleId: 4, difficulte: 8, monstreTemplateId: trollDesForets.id, niveau: 10, quantite: 1 } });
  await prisma.donjonSalleComposition.upsert({ where: { id: 24 }, update: {}, create: { salleId: 4, difficulte: 8, monstreTemplateId: gobelin.id, niveau: 5, quantite: 7 } });

  console.log('Created 24 dungeon salle compositions');

  // ==================== GRILLES DE COMBAT (8) ====================
  function standardSpawns(largeur: number, hauteur: number) {
    const spawns: { x: number; y: number; equipe: number; ordre: number }[] = [];
    const playerXPositions = [0, 1, 0, 1, 0, 1, 0, 1];
    const yOffsets = [-3, -2, -1, 0, 1, 2, 3, 4];
    const centerY = Math.floor(hauteur / 2);
    for (let i = 0; i < 8; i++) {
      spawns.push({
        x: playerXPositions[i],
        y: Math.max(0, Math.min(hauteur - 1, centerY + yOffsets[i])),
        equipe: 0, ordre: i + 1,
      });
    }
    const enemyXPositions = [largeur - 1, largeur - 2, largeur - 1, largeur - 2, largeur - 1, largeur - 2, largeur - 1, largeur - 2];
    for (let i = 0; i < 8; i++) {
      spawns.push({
        x: enemyXPositions[i],
        y: Math.max(0, Math.min(hauteur - 1, centerY + yOffsets[i])),
        equipe: 1, ordre: i + 1,
      });
    }
    return spawns;
  }

  function standardObstacles(largeur: number, hauteur: number) {
    const midX = Math.floor(largeur / 2);
    const midY = Math.floor(hauteur / 2);
    return [
      { x: midX, y: midY - 2, bloqueDeplacement: true, bloqueLigneDeVue: false },
      { x: midX, y: midY + 2, bloqueDeplacement: true, bloqueLigneDeVue: false },
      { x: midX - 2, y: midY, bloqueDeplacement: true, bloqueLigneDeVue: true },
      { x: midX + 2, y: midY, bloqueDeplacement: true, bloqueLigneDeVue: true },
    ];
  }

  await prisma.grilleCombat.upsert({
    where: { id: 1 }, update: {},
    create: {
      nom: 'Clairière forestière', mapId: oreeForet.id, largeur: 15, hauteur: 10,
      cases: { create: standardObstacles(15, 10) },
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  await prisma.grilleCombat.upsert({
    where: { id: 2 }, update: {},
    create: {
      nom: 'Chemin bordé de rochers', mapId: sentierForestier.id, largeur: 15, hauteur: 10,
      cases: { create: [
        { x: 5, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 5, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 9, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 9, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 7, y: 1, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 7, y: 8, bloqueDeplacement: true, bloqueLigneDeVue: true },
      ]},
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  // GrilleCombat id=3 (Galerie souterraine liée à Map 3) supprimée avec la map

  await prisma.grilleCombat.upsert({
    where: { id: 4 }, update: {},
    create: {
      nom: 'Route ouverte', mapId: routeCommerciale.id, largeur: 15, hauteur: 10,
      cases: { create: [
        { x: 6, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 6, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 8, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 8, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
      ]},
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  await prisma.grilleCombat.upsert({
    where: { id: 5 }, update: {},
    create: {
      nom: 'Entrée de la grotte - Combat', mapId: donjonSalle1.id, largeur: 15, hauteur: 10,
      cases: { create: [
        { x: 5, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 5, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 9, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 9, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: true },
      ]},
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  await prisma.grilleCombat.upsert({
    where: { id: 6 }, update: {},
    create: {
      nom: 'Passage étroit - Combat', mapId: donjonSalle2.id, largeur: 15, hauteur: 10,
      cases: { create: [
        { x: 3, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 3, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 7, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 7, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 11, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 11, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
      ]},
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  await prisma.grilleCombat.upsert({
    where: { id: 7 }, update: {},
    create: {
      nom: 'Salle des créatures - Combat', mapId: donjonSalle3.id, largeur: 15, hauteur: 10,
      cases: { create: [
        { x: 5, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 5, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 7, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 7, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 9, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 9, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
      ]},
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  await prisma.grilleCombat.upsert({
    where: { id: 8 }, update: {},
    create: {
      nom: 'Antre du Troll - Combat', mapId: donjonSalle4.id, largeur: 15, hauteur: 10,
      cases: { create: [
        { x: 4, y: 1, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 4, y: 8, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 10, y: 1, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 10, y: 8, bloqueDeplacement: true, bloqueLigneDeVue: true },
        { x: 7, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
        { x: 7, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
      ]},
      spawns: { create: standardSpawns(15, 10) },
    },
  });

  console.log('Created 8 combat grid templates');

  // ==================== EQUIPEMENTS (10) ====================
  await prisma.equipement.upsert({
    where: { id: 1 }, update: { bonusCritique: 5 },
    create: {
      nom: 'Épée en fer', slot: SlotType.ARME,
      bonusForce: 10, bonusDexterite: 5, niveauMinimum: 1, bonusCritique: 5,
      degatsMin: 12, degatsMax: 20,
      chanceCritBase: 0.05, coutPA: 3, porteeMin: 1, porteeMax: 1,
      ligneDeVue: true, zoneId: zoneCase.id, statUtilisee: StatType.FORCE, cooldown: 0,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 2 }, update: { bonusCritique: 3 },
    create: {
      nom: 'Bâton de mage', slot: SlotType.ARME,
      bonusIntelligence: 15, bonusChance: 5, niveauMinimum: 1, bonusCritique: 3,
      degatsMin: 10, degatsMax: 18,
      chanceCritBase: 0.08, coutPA: 3, porteeMin: 1, porteeMax: 2,
      ligneDeVue: true, zoneId: zoneCase.id, statUtilisee: StatType.INTELLIGENCE, cooldown: 0,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 3 }, update: { bonusCritique: 3, bonusForceMax: 8, bonusVieMax: 12 },
    create: {
      nom: 'Casque de fer', slot: SlotType.COIFFE,
      bonusVie: 8, bonusForce: 3, niveauMinimum: 1, bonusCritique: 3,
      bonusForceMax: 8, bonusVieMax: 12,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 4 }, update: {},
    create: {
      nom: 'Amulette de vie', slot: SlotType.AMULETTE,
      bonusVie: 15, niveauMinimum: 5,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 5 }, update: { bonusVie: 5, bonusVieMax: 8 },
    create: {
      nom: 'Bouclier en bois', slot: SlotType.BOUCLIER,
      bonusVie: 5, bonusForce: 2, niveauMinimum: 1, bonusVieMax: 8,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 6 }, update: { bonusVieMax: 15 },
    create: {
      nom: 'Plastron de cuir', slot: SlotType.HAUT,
      bonusVie: 12, bonusAgilite: 3, niveauMinimum: 1, bonusVieMax: 15,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 7 }, update: {},
    create: {
      nom: 'Jambières renforcées', slot: SlotType.BAS,
      bonusVie: 8, bonusPM: 1, niveauMinimum: 3,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 8 }, update: { bonusForceMax: 10 },
    create: {
      nom: 'Anneau de force', slot: SlotType.ANNEAU1,
      bonusForce: 8, niveauMinimum: 5, bonusForceMax: 10,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 9 }, update: { bonusIntelligenceMax: 10 },
    create: {
      nom: 'Anneau de sagesse', slot: SlotType.ANNEAU2,
      bonusIntelligence: 8, niveauMinimum: 5, bonusIntelligenceMax: 10,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 10 }, update: {},
    create: {
      nom: 'Marteau vampirique', slot: SlotType.ARME,
      bonusForce: 12, bonusVie: 5, niveauMinimum: 7,
      degatsMin: 15, degatsMax: 25,
      chanceCritBase: 0.08, bonusCrit: 10,
      coutPA: 4, porteeMin: 1, porteeMax: 1,
      ligneDeVue: true, zoneId: zoneCase.id, statUtilisee: StatType.FORCE, cooldown: 0,
    },
  });

  // Damage lines for Marteau vampirique (equipement 10)
  await prisma.ligneDegatsArme.upsert({
    where: { id: 1 }, update: {},
    create: { equipementId: 10, ordre: 1, degatsMin: 15, degatsMax: 25, statUtilisee: StatType.FORCE },
  });
  await prisma.ligneDegatsArme.upsert({
    where: { id: 2 }, update: {},
    create: { equipementId: 10, ordre: 2, degatsMin: 5, degatsMax: 10, statUtilisee: StatType.FORCE, estVolDeVie: true },
  });

  // Damage lines for Épée en fer (equipement 1)
  await prisma.ligneDegatsArme.upsert({
    where: { id: 3 }, update: {},
    create: { equipementId: 1, ordre: 1, degatsMin: 12, degatsMax: 20, statUtilisee: StatType.FORCE },
  });

  // Damage lines for Bâton de mage (equipement 2)
  await prisma.ligneDegatsArme.upsert({
    where: { id: 4 }, update: {},
    create: { equipementId: 2, ordre: 1, degatsMin: 10, degatsMax: 18, statUtilisee: StatType.INTELLIGENCE },
  });

  console.log('Created 10 equipment items + damage lines for all weapons');

  // ==================== PANOPLIES ====================
  const panoplieGuerrier = await prisma.panoplie.upsert({
    where: { nom: 'Panoplie du Guerrier' }, update: {},
    create: { nom: 'Panoplie du Guerrier', description: 'Équipement complet du guerrier' },
  });
  const panoplieSage = await prisma.panoplie.upsert({
    where: { nom: 'Panoplie du Sage' }, update: {},
    create: { nom: 'Panoplie du Sage', description: 'Équipement complet du sage' },
  });

  // Guerrier: Épée fer (1) + Casque fer (3) + Plastron cuir (6)
  await prisma.equipement.update({ where: { id: 1 }, data: { panoplieId: panoplieGuerrier.id } });
  await prisma.equipement.update({ where: { id: 3 }, data: { panoplieId: panoplieGuerrier.id } });
  await prisma.equipement.update({ where: { id: 6 }, data: { panoplieId: panoplieGuerrier.id } });

  // Sage: Bâton mage (2) + Amulette vie (4) + Anneau sagesse (9)
  await prisma.equipement.update({ where: { id: 2 }, data: { panoplieId: panoplieSage.id } });
  await prisma.equipement.update({ where: { id: 4 }, data: { panoplieId: panoplieSage.id } });
  await prisma.equipement.update({ where: { id: 9 }, data: { panoplieId: panoplieSage.id } });

  // Guerrier: 2pc +10 FOR, 3pc +20 FOR +1 PA
  await prisma.panoplieBonus.upsert({
    where: { panoplieId_nombrePieces: { panoplieId: panoplieGuerrier.id, nombrePieces: 2 } }, update: {},
    create: { panoplieId: panoplieGuerrier.id, nombrePieces: 2, bonusForce: 10 },
  });
  await prisma.panoplieBonus.upsert({
    where: { panoplieId_nombrePieces: { panoplieId: panoplieGuerrier.id, nombrePieces: 3 } }, update: {},
    create: { panoplieId: panoplieGuerrier.id, nombrePieces: 3, bonusForce: 20, bonusPA: 1 },
  });

  // Sage: 2pc +10 INT, 3pc +20 INT +1 PO
  await prisma.panoplieBonus.upsert({
    where: { panoplieId_nombrePieces: { panoplieId: panoplieSage.id, nombrePieces: 2 } }, update: {},
    create: { panoplieId: panoplieSage.id, nombrePieces: 2, bonusIntelligence: 10 },
  });
  await prisma.panoplieBonus.upsert({
    where: { panoplieId_nombrePieces: { panoplieId: panoplieSage.id, nombrePieces: 3 } }, update: {},
    create: { panoplieId: panoplieSage.id, nombrePieces: 3, bonusIntelligence: 20, bonusPO: 1 },
  });

  console.log('Created panoplies');

  // ==================== RESSOURCES (11) ====================
  const cuir = await prisma.ressource.upsert({ where: { nom: 'Cuir' }, update: {}, create: { nom: 'Cuir', description: 'Cuir tanné de bête', poids: 1 } });
  const os = await prisma.ressource.upsert({ where: { nom: 'Os' }, update: {}, create: { nom: 'Os', description: 'Os solide de monstre', poids: 1 } });
  const crocs = await prisma.ressource.upsert({ where: { nom: 'Crocs' }, update: {}, create: { nom: 'Crocs', description: 'Crocs pointus', poids: 1 } });
  const mineraiFer = await prisma.ressource.upsert({ where: { nom: 'Minerai de fer' }, update: {}, create: { nom: 'Minerai de fer', description: 'Minerai brut de fer', poids: 2 } });
  const bois = await prisma.ressource.upsert({ where: { nom: 'Bois' }, update: {}, create: { nom: 'Bois', description: 'Bois solide', poids: 2 } });
  const herbeMedicinale = await prisma.ressource.upsert({ where: { nom: 'Herbe médicinale' }, update: {}, create: { nom: 'Herbe médicinale', description: 'Plante aux vertus curatives', poids: 1 } });
  const pierrePrecieuse = await prisma.ressource.upsert({ where: { nom: 'Pierre précieuse' }, update: { estPremium: true }, create: { nom: 'Pierre précieuse', description: 'Gemme brillante', poids: 1, estPremium: true } });
  const laine = await prisma.ressource.upsert({ where: { nom: 'Laine' }, update: {}, create: { nom: 'Laine', description: 'Laine épaisse', poids: 1 } });
  const plume = await prisma.ressource.upsert({ where: { nom: 'Plume' }, update: {}, create: { nom: 'Plume', description: 'Plume légère', poids: 1 } });
  const poilLoup = await prisma.ressource.upsert({ where: { nom: 'Poil de loup' }, update: {}, create: { nom: 'Poil de loup', description: 'Fourrure de loup', poids: 1 } });
  const cuirTroll = await prisma.ressource.upsert({ where: { nom: 'Cuir de troll' }, update: { estPremium: true }, create: { nom: 'Cuir de troll', description: 'Cuir épais et résistant', poids: 3, estPremium: true } });

  console.log('Created 11 resources');

  // ==================== MONSTER DROPS ====================
  // Gobelin: Os 50%, Minerai 20%, Plume 30%, Épée en fer 3%
  await prisma.monstreDrop.upsert({ where: { id: 1 }, update: {}, create: { monstreId: gobelin.id, ressourceId: os.id, tauxDrop: 0.50, quantiteMin: 1, quantiteMax: 2 } });
  await prisma.monstreDrop.upsert({ where: { id: 2 }, update: {}, create: { monstreId: gobelin.id, ressourceId: mineraiFer.id, tauxDrop: 0.20, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 3 }, update: {}, create: { monstreId: gobelin.id, ressourceId: plume.id, tauxDrop: 0.30, quantiteMin: 1, quantiteMax: 2 } });
  await prisma.monstreDrop.upsert({ where: { id: 4 }, update: {}, create: { monstreId: gobelin.id, equipementId: 1, tauxDrop: 0.03, quantiteMin: 1, quantiteMax: 1 } });

  // Loup: Poil 60%, Crocs 40%, Laine 30%, Herbe 15%
  await prisma.monstreDrop.upsert({ where: { id: 5 }, update: {}, create: { monstreId: loup.id, ressourceId: poilLoup.id, tauxDrop: 0.60, quantiteMin: 1, quantiteMax: 2 } });
  await prisma.monstreDrop.upsert({ where: { id: 6 }, update: {}, create: { monstreId: loup.id, ressourceId: crocs.id, tauxDrop: 0.40, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 7 }, update: {}, create: { monstreId: loup.id, ressourceId: laine.id, tauxDrop: 0.30, quantiteMin: 1, quantiteMax: 2 } });
  await prisma.monstreDrop.upsert({ where: { id: 8 }, update: {}, create: { monstreId: loup.id, ressourceId: herbeMedicinale.id, tauxDrop: 0.15, quantiteMin: 1, quantiteMax: 1 } });

  // Bandit: Cuir 50%, Minerai 30%, Bâton de mage 3%, Jambières 5%
  await prisma.monstreDrop.upsert({ where: { id: 9 }, update: {}, create: { monstreId: bandit.id, ressourceId: cuir.id, tauxDrop: 0.50, quantiteMin: 1, quantiteMax: 2 } });
  await prisma.monstreDrop.upsert({ where: { id: 10 }, update: {}, create: { monstreId: bandit.id, ressourceId: mineraiFer.id, tauxDrop: 0.30, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 11 }, update: {}, create: { monstreId: bandit.id, equipementId: 2, tauxDrop: 0.03, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 12 }, update: {}, create: { monstreId: bandit.id, equipementId: 7, tauxDrop: 0.05, quantiteMin: 1, quantiteMax: 1 } });

  // Troll: Cuir troll 60%, Bois 40%, Pierre 10%, Bouclier 8%, Casque 5%, Anneau sagesse 3%
  await prisma.monstreDrop.upsert({ where: { id: 13 }, update: {}, create: { monstreId: trollDesForets.id, ressourceId: cuirTroll.id, tauxDrop: 0.60, quantiteMin: 1, quantiteMax: 2 } });
  await prisma.monstreDrop.upsert({ where: { id: 14 }, update: {}, create: { monstreId: trollDesForets.id, ressourceId: bois.id, tauxDrop: 0.40, quantiteMin: 1, quantiteMax: 3 } });
  await prisma.monstreDrop.upsert({ where: { id: 15 }, update: {}, create: { monstreId: trollDesForets.id, ressourceId: pierrePrecieuse.id, tauxDrop: 0.10, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 16 }, update: {}, create: { monstreId: trollDesForets.id, equipementId: 5, tauxDrop: 0.08, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 17 }, update: {}, create: { monstreId: trollDesForets.id, equipementId: 3, tauxDrop: 0.05, quantiteMin: 1, quantiteMax: 1 } });
  await prisma.monstreDrop.upsert({ where: { id: 18 }, update: {}, create: { monstreId: trollDesForets.id, equipementId: 9, tauxDrop: 0.03, quantiteMin: 1, quantiteMax: 1 } });

  console.log('Created monster drops');

  // ==================== RECETTES (6) ====================
  // Casque de fer (equip 3): 3x Minerai + 2x Cuir, 10 or, lvl 1
  const recetteCasque = await prisma.recette.upsert({
    where: { nom: 'Forger un Casque de fer' }, update: {},
    create: { nom: 'Forger un Casque de fer', description: 'Forge un casque solide', equipementId: 3, niveauMinimum: 1, coutOr: 10 },
  });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteCasque.id, ressourceId: mineraiFer.id } }, update: {}, create: { recetteId: recetteCasque.id, ressourceId: mineraiFer.id, quantite: 3 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteCasque.id, ressourceId: cuir.id } }, update: {}, create: { recetteId: recetteCasque.id, ressourceId: cuir.id, quantite: 2 } });

  // Plastron de cuir (equip 6): 5x Cuir + 2x Laine, 15 or, lvl 2
  const recettePlastron = await prisma.recette.upsert({
    where: { nom: 'Coudre un Plastron de cuir' }, update: {},
    create: { nom: 'Coudre un Plastron de cuir', description: 'Assemble un plastron résistant', equipementId: 6, niveauMinimum: 2, coutOr: 15 },
  });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recettePlastron.id, ressourceId: cuir.id } }, update: {}, create: { recetteId: recettePlastron.id, ressourceId: cuir.id, quantite: 5 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recettePlastron.id, ressourceId: laine.id } }, update: {}, create: { recetteId: recettePlastron.id, ressourceId: laine.id, quantite: 2 } });

  // Bouclier en bois (equip 5): 4x Bois + 2x Minerai, 12 or, lvl 1
  const recetteBouclier = await prisma.recette.upsert({
    where: { nom: 'Assembler un Bouclier en bois' }, update: {},
    create: { nom: 'Assembler un Bouclier en bois', description: 'Fabrique un bouclier robuste', equipementId: 5, niveauMinimum: 1, coutOr: 12 },
  });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteBouclier.id, ressourceId: bois.id } }, update: {}, create: { recetteId: recetteBouclier.id, ressourceId: bois.id, quantite: 4 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteBouclier.id, ressourceId: mineraiFer.id } }, update: {}, create: { recetteId: recetteBouclier.id, ressourceId: mineraiFer.id, quantite: 2 } });

  // Amulette de vie (equip 4): 2x Herbe + 1x Pierre, 20 or, lvl 3
  const recetteAmulette = await prisma.recette.upsert({
    where: { nom: 'Enchanter une Amulette de vie' }, update: {},
    create: { nom: 'Enchanter une Amulette de vie', description: 'Crée une amulette protectrice', equipementId: 4, niveauMinimum: 3, coutOr: 20 },
  });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteAmulette.id, ressourceId: herbeMedicinale.id } }, update: {}, create: { recetteId: recetteAmulette.id, ressourceId: herbeMedicinale.id, quantite: 2 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteAmulette.id, ressourceId: pierrePrecieuse.id } }, update: {}, create: { recetteId: recetteAmulette.id, ressourceId: pierrePrecieuse.id, quantite: 1 } });

  // Anneau de force (equip 8): 3x Os + 1x Pierre + 2x Minerai, 25 or, lvl 3
  const recetteAnneauForce = await prisma.recette.upsert({
    where: { nom: 'Forger un Anneau de force' }, update: {},
    create: { nom: 'Forger un Anneau de force', description: 'Forge un anneau puissant', equipementId: 8, niveauMinimum: 3, coutOr: 25 },
  });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteAnneauForce.id, ressourceId: os.id } }, update: {}, create: { recetteId: recetteAnneauForce.id, ressourceId: os.id, quantite: 3 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteAnneauForce.id, ressourceId: pierrePrecieuse.id } }, update: {}, create: { recetteId: recetteAnneauForce.id, ressourceId: pierrePrecieuse.id, quantite: 1 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteAnneauForce.id, ressourceId: mineraiFer.id } }, update: {}, create: { recetteId: recetteAnneauForce.id, ressourceId: mineraiFer.id, quantite: 2 } });

  // Marteau vampirique (equip 10): 3x Cuir troll + 2x Bois + 2x Minerai, 30 or, lvl 5
  const recetteMarteau = await prisma.recette.upsert({
    where: { nom: 'Forger un Marteau vampirique' }, update: {},
    create: { nom: 'Forger un Marteau vampirique', description: 'Forge un marteau drainant la vie', equipementId: 10, niveauMinimum: 5, coutOr: 30 },
  });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteMarteau.id, ressourceId: cuirTroll.id } }, update: {}, create: { recetteId: recetteMarteau.id, ressourceId: cuirTroll.id, quantite: 3 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteMarteau.id, ressourceId: bois.id } }, update: {}, create: { recetteId: recetteMarteau.id, ressourceId: bois.id, quantite: 2 } });
  await prisma.recetteIngredient.upsert({ where: { recetteId_ressourceId: { recetteId: recetteMarteau.id, ressourceId: mineraiFer.id } }, update: {}, create: { recetteId: recetteMarteau.id, ressourceId: mineraiFer.id, quantite: 2 } });

  console.log('Created 6 recipes');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
