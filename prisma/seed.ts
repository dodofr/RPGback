import { PrismaClient, StatType, ZoneType, SortType, SlotType, EffetType, RegionType, MapType, CombatMode, IAType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ==================== RACES ====================
  const humain = await prisma.race.upsert({
    where: { nom: 'Humain' },
    update: {},
    create: {
      nom: 'Humain',
      bonusForce: 5,
      bonusIntelligence: 5,
      bonusDexterite: 5,
      bonusAgilite: 5,
      bonusVie: 5,
      bonusChance: 5,
    },
  });

  const elfe = await prisma.race.upsert({
    where: { nom: 'Elfe' },
    update: {},
    create: {
      nom: 'Elfe',
      bonusForce: 0,
      bonusIntelligence: 15,
      bonusDexterite: 10,
      bonusAgilite: 10,
      bonusVie: -5,
      bonusChance: 0,
    },
  });

  const nain = await prisma.race.upsert({
    where: { nom: 'Nain' },
    update: {},
    create: {
      nom: 'Nain',
      bonusForce: 15,
      bonusIntelligence: -5,
      bonusDexterite: 5,
      bonusAgilite: -5,
      bonusVie: 20,
      bonusChance: 0,
    },
  });

  const orc = await prisma.race.upsert({
    where: { nom: 'Orc' },
    update: {},
    create: {
      nom: 'Orc',
      bonusForce: 20,
      bonusIntelligence: -10,
      bonusDexterite: 5,
      bonusAgilite: 5,
      bonusVie: 10,
      bonusChance: 0,
    },
  });

  const halfelin = await prisma.race.upsert({
    where: { nom: 'Halfelin' },
    update: {},
    create: {
      nom: 'Halfelin',
      bonusForce: -5,
      bonusIntelligence: 5,
      bonusDexterite: 15,
      bonusAgilite: 15,
      bonusVie: -5,
      bonusChance: 10,
    },
  });

  console.log('Created 5 races');

  // ==================== ZONES ====================
  const zoneCase = await prisma.zone.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Case unique',
      type: ZoneType.CASE,
      taille: 0,
    },
  });

  const zoneCroix = await prisma.zone.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nom: 'Croix 1',
      type: ZoneType.CROIX,
      taille: 1,
    },
  });

  const zoneCercle = await prisma.zone.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nom: 'Cercle 2',
      type: ZoneType.CERCLE,
      taille: 2,
    },
  });

  const zoneLigne = await prisma.zone.upsert({
    where: { id: 4 },
    update: {},
    create: {
      nom: 'Ligne 3',
      type: ZoneType.LIGNE,
      taille: 3,
    },
  });

  console.log('Created 4 zones');

  // ==================== SORTS PAR RACE ====================
  // Chaque race a 4 sorts: niveaux 1, 4, 7, 10

  // --- HUMAIN (polyvalent - 1 de chaque type) ---
  await prisma.sort.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Frappe simple',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 30,
      degatsCritMax: 40,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: humain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nom: 'Tir arcanique',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 2,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 15,
      degatsMax: 25,
      degatsCritMin: 35,
      degatsCritMax: 45,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 4,
      raceId: humain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nom: 'Tourbillon',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 5,
      porteeMin: 0,
      porteeMax: 1,
      ligneDeVue: false,
      degatsMin: 10,
      degatsMax: 18,
      degatsCritMin: 25,
      degatsCritMax: 35,
      chanceCritBase: 0.05,
      cooldown: 2,
      niveauApprentissage: 7,
      raceId: humain.id,
      zoneId: zoneCroix.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 4 },
    update: { tauxEchec: 0.15 },
    create: {
      nom: 'Explosion arcanique',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 6,
      porteeMin: 2,
      porteeMax: 6,
      ligneDeVue: true,
      degatsMin: 20,
      degatsMax: 35,
      degatsCritMin: 50,
      degatsCritMax: 60,
      chanceCritBase: 0.08,
      cooldown: 3,
      tauxEchec: 0.15,
      niveauApprentissage: 10,
      raceId: humain.id,
      zoneId: zoneCercle.id,
    },
  });

  // --- ELFE (sorts magiques) ---
  await prisma.sort.upsert({
    where: { id: 5 },
    update: {},
    create: {
      nom: 'Flèche de lumière',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 2,
      porteeMax: 6,
      ligneDeVue: true,
      degatsMin: 15,
      degatsMax: 25,
      degatsCritMin: 40,
      degatsCritMax: 50,
      chanceCritBase: 0.08,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: elfe.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 6 },
    update: {},
    create: {
      nom: 'Vent tranchant',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4,
      porteeMin: 2,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 30,
      degatsCritMax: 40,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 4,
      raceId: elfe.id,
      zoneId: zoneLigne.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 7 },
    update: {},
    create: {
      nom: 'Boule de feu',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 5,
      porteeMin: 3,
      porteeMax: 7,
      ligneDeVue: true,
      degatsMin: 20,
      degatsMax: 35,
      degatsCritMin: 50,
      degatsCritMax: 60,
      chanceCritBase: 0.05,
      cooldown: 2,
      niveauApprentissage: 7,
      raceId: elfe.id,
      zoneId: zoneCercle.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 8 },
    update: { tauxEchec: 0.20 },
    create: {
      nom: 'Tempête arcanique',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 6,
      porteeMin: 2,
      porteeMax: 8,
      ligneDeVue: true,
      degatsMin: 25,
      degatsMax: 45,
      degatsCritMin: 65,
      degatsCritMax: 75,
      chanceCritBase: 0.10,
      cooldown: 4,
      tauxEchec: 0.20,
      niveauApprentissage: 10,
      raceId: elfe.id,
      zoneId: zoneCercle.id,
    },
  });

  // --- NAIN (attaques physiques) ---
  await prisma.sort.upsert({
    where: { id: 9 },
    update: {},
    create: {
      nom: 'Coup de hache',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 18,
      degatsMax: 28,
      degatsCritMin: 40,
      degatsCritMax: 50,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 10 },
    update: {},
    create: {
      nom: 'Charge du bouclier',
      type: SortType.SORT,
      statUtilisee: StatType.VIE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 2,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 25,
      degatsCritMax: 35,
      chanceCritBase: 0.03,
      cooldown: 1,
      niveauApprentissage: 4,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 11 },
    update: {},
    create: {
      nom: 'Marteau de guerre',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 5,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 25,
      degatsMax: 40,
      degatsCritMin: 55,
      degatsCritMax: 65,
      chanceCritBase: 0.08,
      cooldown: 2,
      niveauApprentissage: 7,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 12 },
    update: {},
    create: {
      nom: 'Séisme',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 6,
      porteeMin: 0,
      porteeMax: 2,
      ligneDeVue: false,
      degatsMin: 20,
      degatsMax: 35,
      degatsCritMin: 45,
      degatsCritMax: 55,
      chanceCritBase: 0.05,
      cooldown: 3,
      niveauApprentissage: 10,
      raceId: nain.id,
      zoneId: zoneCercle.id,
    },
  });

  // --- ORC (attaques brutales) ---
  await prisma.sort.upsert({
    where: { id: 13 },
    update: {},
    create: {
      nom: 'Coup brutal',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 20,
      degatsMax: 30,
      degatsCritMin: 45,
      degatsCritMax: 55,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: orc.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 14 },
    update: {},
    create: {
      nom: 'Cri de guerre',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 4,
      porteeMin: 0,
      porteeMax: 2,
      ligneDeVue: false,
      degatsMin: 8,
      degatsMax: 15,
      degatsCritMin: 20,
      degatsCritMax: 30,
      chanceCritBase: 0.03,
      cooldown: 1,
      niveauApprentissage: 4,
      raceId: orc.id,
      zoneId: zoneCercle.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 15 },
    update: { tauxEchec: 0.10 },
    create: {
      nom: 'Rage berserk',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 5,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 30,
      degatsMax: 50,
      degatsCritMin: 75,
      degatsCritMax: 85,
      chanceCritBase: 0.15,
      cooldown: 3,
      tauxEchec: 0.10,
      niveauApprentissage: 7,
      raceId: orc.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 16 },
    update: { tauxEchec: 0.15 },
    create: {
      nom: 'Frappe dévastatrice',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 6,
      porteeMin: 1,
      porteeMax: 2,
      ligneDeVue: true,
      degatsMin: 35,
      degatsMax: 55,
      degatsCritMin: 85,
      degatsCritMax: 95,
      chanceCritBase: 0.10,
      cooldown: 4,
      tauxEchec: 0.15,
      niveauApprentissage: 10,
      raceId: orc.id,
      zoneId: zoneCroix.id,
    },
  });

  // --- HALFELIN (attaques agiles) ---
  await prisma.sort.upsert({
    where: { id: 17 },
    update: {},
    create: {
      nom: 'Coup sournois',
      type: SortType.SORT,
      statUtilisee: StatType.AGILITE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 15,
      degatsMax: 25,
      degatsCritMin: 45,
      degatsCritMax: 55,
      chanceCritBase: 0.15,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: halfelin.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 18 },
    update: {},
    create: {
      nom: 'Lancer de dague',
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 2,
      porteeMin: 1,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 8,
      degatsMax: 14,
      degatsCritMin: 20,
      degatsCritMax: 30,
      chanceCritBase: 0.12,
      cooldown: 0,
      niveauApprentissage: 4,
      raceId: halfelin.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 19 },
    update: {},
    create: {
      nom: 'Danse des lames',
      type: SortType.SORT,
      statUtilisee: StatType.AGILITE,
      coutPA: 5,
      porteeMin: 0,
      porteeMax: 1,
      ligneDeVue: false,
      degatsMin: 12,
      degatsMax: 22,
      degatsCritMin: 35,
      degatsCritMax: 45,
      chanceCritBase: 0.20,
      cooldown: 2,
      niveauApprentissage: 7,
      raceId: halfelin.id,
      zoneId: zoneCroix.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 20 },
    update: { tauxEchec: 0.10 },
    create: {
      nom: 'Attaque éclair',
      type: SortType.SORT,
      statUtilisee: StatType.AGILITE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 3,
      ligneDeVue: true,
      degatsMin: 25,
      degatsMax: 40,
      degatsCritMin: 65,
      degatsCritMax: 75,
      chanceCritBase: 0.25,
      cooldown: 3,
      tauxEchec: 0.10,
      niveauApprentissage: 10,
      raceId: halfelin.id,
      zoneId: zoneCase.id,
    },
  });

  // --- SORTS SPECIFIQUES PAR MONSTRE (sans race) ---
  // Loup: Morsure du loup (prio 1), Griffure du loup (prio 2)
  await prisma.sort.upsert({
    where: { id: 21 },
    update: {},
    create: {
      nom: 'Morsure du loup',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 15,
      degatsMax: 25,
      degatsCritMin: 35,
      degatsCritMax: 45,
      chanceCritBase: 0.08,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 22 },
    update: {},
    create: {
      nom: 'Griffure du loup',
      type: SortType.SORT,
      statUtilisee: StatType.AGILITE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 2,
      ligneDeVue: true,
      degatsMin: 8,
      degatsMax: 14,
      degatsCritMin: 18,
      degatsCritMax: 28,
      chanceCritBase: 0.10,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Gobelin: Coup de dague (prio 1)
  await prisma.sort.upsert({
    where: { id: 23 },
    update: {},
    create: {
      nom: 'Coup de dague',
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 10,
      degatsMax: 18,
      degatsCritMin: 25,
      degatsCritMax: 35,
      chanceCritBase: 0.10,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Bandit: Coup d'épée (prio 1), Tir d'arbalète (prio 2)
  await prisma.sort.upsert({
    where: { id: 24 },
    update: {},
    create: {
      nom: "Coup d'épée",
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 14,
      degatsMax: 22,
      degatsCritMin: 30,
      degatsCritMax: 40,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 25 },
    update: {},
    create: {
      nom: "Tir d'arbalète",
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 4,
      porteeMin: 3,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 28,
      degatsCritMax: 38,
      chanceCritBase: 0.08,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Araignée: Morsure venimeuse (prio 1), Jet de toile (prio 2)
  await prisma.sort.upsert({
    where: { id: 26 },
    update: {},
    create: {
      nom: 'Morsure venimeuse',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 22,
      degatsCritMin: 30,
      degatsCritMax: 40,
      chanceCritBase: 0.08,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 27 },
    update: {},
    create: {
      nom: 'Jet de toile',
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 3,
      porteeMin: 2,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 8,
      degatsMax: 16,
      degatsCritMin: 20,
      degatsCritMax: 30,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Squelette: Coup d'os (prio 1)
  await prisma.sort.upsert({
    where: { id: 28 },
    update: {},
    create: {
      nom: "Coup d'os",
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 28,
      degatsCritMax: 38,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Troll: Écrasement (prio 1), Lancer de rocher (prio 2, cd:1)
  await prisma.sort.upsert({
    where: { id: 29 },
    update: {},
    create: {
      nom: 'Écrasement',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 25,
      degatsMax: 40,
      degatsCritMin: 55,
      degatsCritMax: 70,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 30 },
    update: {},
    create: {
      nom: 'Lancer de rocher',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 4,
      porteeMin: 2,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 18,
      degatsMax: 30,
      degatsCritMin: 40,
      degatsCritMax: 55,
      chanceCritBase: 0.05,
      cooldown: 1,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  console.log('Created 30 spells (20 for races, 10 specific for monsters)');

  // ==================== EQUIPEMENTS ====================
  await prisma.equipement.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Épée en fer',
      slot: SlotType.ARME,
      bonusForce: 10,
      bonusDexterite: 5,
      niveauMinimum: 1,
      // Données d'attaque arme
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 30,
      degatsCritMax: 40,
      chanceCritBase: 0.05,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      zoneId: zoneCase.id,
      statUtilisee: StatType.FORCE,
      cooldown: 0,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nom: 'Bâton de mage',
      slot: SlotType.ARME,
      bonusIntelligence: 15,
      bonusChance: 5,
      niveauMinimum: 1,
      // Données d'attaque arme
      degatsMin: 10,
      degatsMax: 18,
      degatsCritMin: 25,
      degatsCritMax: 35,
      chanceCritBase: 0.08,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 2,
      ligneDeVue: true,
      zoneId: zoneCase.id,
      statUtilisee: StatType.INTELLIGENCE,
      cooldown: 0,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 3 },
    update: { tauxEchec: 0.10 },
    create: {
      nom: 'Arc long',
      slot: SlotType.ARME,
      bonusDexterite: 12,
      bonusAgilite: 5,
      bonusPO: 1,
      niveauMinimum: 3,
      // Données d'attaque arme
      degatsMin: 14,
      degatsMax: 22,
      degatsCritMin: 28,
      degatsCritMax: 38,
      chanceCritBase: 0.08,
      coutPA: 3,
      porteeMin: 2,
      porteeMax: 5,
      ligneDeVue: true,
      zoneId: zoneCase.id,
      statUtilisee: StatType.DEXTERITE,
      cooldown: 0,
      tauxEchec: 0.10,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 4 },
    update: { tauxEchec: 0.05 },
    create: {
      nom: 'Dagues jumelles',
      slot: SlotType.ARME,
      bonusAgilite: 15,
      bonusChance: 10,
      niveauMinimum: 5,
      // Données d'attaque arme
      degatsMin: 10,
      degatsMax: 16,
      degatsCritMin: 30,
      degatsCritMax: 45,
      chanceCritBase: 0.15,
      coutPA: 2,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      zoneId: zoneCase.id,
      statUtilisee: StatType.AGILITE,
      cooldown: 0,
      tauxEchec: 0.05,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 5 },
    update: {},
    create: {
      nom: 'Casque de fer',
      slot: SlotType.COIFFE,
      bonusVie: 8,
      bonusForce: 3,
      niveauMinimum: 1,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 6 },
    update: {},
    create: {
      nom: 'Chapeau de sorcier',
      slot: SlotType.COIFFE,
      bonusIntelligence: 10,
      bonusChance: 5,
      niveauMinimum: 3,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 7 },
    update: {},
    create: {
      nom: 'Amulette de vie',
      slot: SlotType.AMULETTE,
      bonusVie: 15,
      niveauMinimum: 5,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 8 },
    update: {},
    create: {
      nom: 'Bouclier en bois',
      slot: SlotType.BOUCLIER,
      bonusVie: 10,
      bonusForce: 2,
      niveauMinimum: 1,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 9 },
    update: {},
    create: {
      nom: 'Plastron de cuir',
      slot: SlotType.HAUT,
      bonusVie: 12,
      bonusAgilite: 3,
      niveauMinimum: 1,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 10 },
    update: {},
    create: {
      nom: 'Jambières renforcées',
      slot: SlotType.BAS,
      bonusVie: 8,
      bonusPM: 1,
      niveauMinimum: 3,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 11 },
    update: {},
    create: {
      nom: 'Anneau de force',
      slot: SlotType.ANNEAU1,
      bonusForce: 8,
      niveauMinimum: 5,
    },
  });

  await prisma.equipement.upsert({
    where: { id: 12 },
    update: {},
    create: {
      nom: 'Anneau de sagesse',
      slot: SlotType.ANNEAU2,
      bonusIntelligence: 8,
      niveauMinimum: 5,
    },
  });

  console.log('Created 12 equipment items');

  // ==================== EFFETS ====================
  await prisma.effet.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Rage',
      type: EffetType.BUFF,
      statCiblee: StatType.FORCE,
      valeur: 20,
      duree: 3,
    },
  });

  await prisma.effet.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nom: 'Concentration',
      type: EffetType.BUFF,
      statCiblee: StatType.INTELLIGENCE,
      valeur: 15,
      duree: 2,
    },
  });

  await prisma.effet.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nom: 'Agilité accrue',
      type: EffetType.BUFF,
      statCiblee: StatType.AGILITE,
      valeur: 25,
      duree: 2,
    },
  });

  await prisma.effet.upsert({
    where: { id: 4 },
    update: {},
    create: {
      nom: 'Affaiblissement',
      type: EffetType.DEBUFF,
      statCiblee: StatType.FORCE,
      valeur: -15,
      duree: 2,
    },
  });

  await prisma.effet.upsert({
    where: { id: 5 },
    update: {},
    create: {
      nom: 'Ralentissement',
      type: EffetType.DEBUFF,
      statCiblee: StatType.AGILITE,
      valeur: -20,
      duree: 2,
    },
  });

  console.log('Created 5 effects');

  // ==================== SORTS AVEC EFFETS (buff/debuff) ====================
  // Sort 31: Cri de rage (Humain) - applique Rage sur lanceur
  await prisma.sort.upsert({
    where: { id: 31 },
    update: {},
    create: {
      nom: 'Cri de rage',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 2,
      porteeMin: 0,
      porteeMax: 0,
      ligneDeVue: false,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 3,
      niveauApprentissage: 3,
      raceId: humain.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 32: Méditation (Elfe) - applique Concentration sur lanceur
  await prisma.sort.upsert({
    where: { id: 32 },
    update: {},
    create: {
      nom: 'Méditation',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 2,
      porteeMin: 0,
      porteeMax: 0,
      ligneDeVue: false,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 3,
      niveauApprentissage: 3,
      raceId: elfe.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 33: Malédiction (Orc) - applique Affaiblissement sur cible
  await prisma.sort.upsert({
    where: { id: 33 },
    update: {},
    create: {
      nom: 'Malédiction',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      niveauApprentissage: 3,
      raceId: orc.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 34: Entrave (Halfelin) - applique Ralentissement sur cible
  await prisma.sort.upsert({
    where: { id: 34 },
    update: {},
    create: {
      nom: 'Entrave',
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      niveauApprentissage: 3,
      raceId: halfelin.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 35: Boost d'agilité (Nain) - applique Agilité accrue sur lanceur
  await prisma.sort.upsert({
    where: { id: 35 },
    update: {},
    create: {
      nom: "Pas lourd",
      type: SortType.SORT,
      statUtilisee: StatType.VIE,
      coutPA: 2,
      porteeMin: 0,
      porteeMax: 0,
      ligneDeVue: false,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 3,
      niveauApprentissage: 3,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  console.log('Created 5 buff/debuff spells');

  // ==================== SORTS DE DESENVOUTEMENT (1 par race) ====================
  // Sort 36: Purification (Humain)
  await prisma.sort.upsert({
    where: { id: 36 },
    update: {},
    create: {
      nom: 'Purification',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      estDispel: true,
      niveauApprentissage: 1,
      raceId: humain.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 37: Dissipation (Elfe)
  await prisma.sort.upsert({
    where: { id: 37 },
    update: {},
    create: {
      nom: 'Dissipation',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      estDispel: true,
      niveauApprentissage: 1,
      raceId: elfe.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 38: Briseur de sorts (Nain)
  await prisma.sort.upsert({
    where: { id: 38 },
    update: {},
    create: {
      nom: 'Briseur de sorts',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      estDispel: true,
      niveauApprentissage: 1,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 39: Annulation (Orc)
  await prisma.sort.upsert({
    where: { id: 39 },
    update: {},
    create: {
      nom: 'Annulation',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      estDispel: true,
      niveauApprentissage: 1,
      raceId: orc.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 40: Désenvoûtement (Halfelin)
  await prisma.sort.upsert({
    where: { id: 40 },
    update: {},
    create: {
      nom: 'Désenvoûtement',
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 2,
      estDispel: true,
      niveauApprentissage: 1,
      raceId: halfelin.id,
      zoneId: zoneCase.id,
    },
  });

  console.log('Created 5 dispel spells');

  // ==================== SORTS DE SOIN ====================
  // Sort 41: Soin (Humain)
  await prisma.sort.upsert({
    where: { id: 41 },
    update: {},
    create: {
      nom: 'Soin',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 15,
      degatsMax: 25,
      degatsCritMin: 30,
      degatsCritMax: 40,
      chanceCritBase: 0.05,
      cooldown: 2,
      estSoin: true,
      niveauApprentissage: 3,
      raceId: humain.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 42: Soin de lumière (Elfe)
  await prisma.sort.upsert({
    where: { id: 42 },
    update: {},
    create: {
      nom: 'Soin de lumière',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 18,
      degatsMax: 30,
      degatsCritMin: 35,
      degatsCritMax: 50,
      chanceCritBase: 0.08,
      cooldown: 1,
      estSoin: true,
      niveauApprentissage: 1,
      raceId: elfe.id,
      zoneId: zoneCase.id,
    },
  });

  // Sort 43: Second souffle (Nain)
  await prisma.sort.upsert({
    where: { id: 43 },
    update: {},
    create: {
      nom: 'Second souffle',
      type: SortType.SORT,
      statUtilisee: StatType.VIE,
      coutPA: 4,
      porteeMin: 0,
      porteeMax: 1,
      ligneDeVue: false,
      degatsMin: 20,
      degatsMax: 35,
      degatsCritMin: 40,
      degatsCritMax: 55,
      chanceCritBase: 0.05,
      cooldown: 3,
      estSoin: true,
      niveauApprentissage: 4,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  console.log('Created 3 heal spells');

  // ==================== REGIONS ====================
  const foretVertbois = await prisma.region.upsert({
    where: { nom: 'Forêt de Vertbois' },
    update: {},
    create: {
      nom: 'Forêt de Vertbois',
      description: 'Une forêt dense et mystérieuse aux arbres centenaires.',
      type: RegionType.FORET,
      niveauMin: 1,
      niveauMax: 5,
    },
  });

  const plainesDuSud = await prisma.region.upsert({
    where: { nom: 'Plaines du Sud' },
    update: {},
    create: {
      nom: 'Plaines du Sud',
      description: 'De vastes étendues herbeuses parsemées de villages.',
      type: RegionType.PLAINE,
      niveauMin: 1,
      niveauMax: 3,
    },
  });

  const montagneGrise = await prisma.region.upsert({
    where: { nom: 'Montagne Grise' },
    update: {},
    create: {
      nom: 'Montagne Grise',
      description: 'Des pics rocheux abritant des créatures dangereuses.',
      type: RegionType.MONTAGNE,
      niveauMin: 5,
      niveauMax: 10,
    },
  });

  console.log('Created 3 regions');

  // ==================== MONSTER TEMPLATES ====================
  const gobelin = await prisma.monstreTemplate.upsert({
    where: { id: 1 },
    update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Gobelin',
      force: 8,
      intelligence: 5,
      dexterite: 12,
      agilite: 15,
      vie: 6,
      chance: 5,
      pvBase: 30,
      paBase: 6,
      pmBase: 4,
      niveauBase: 1,
      xpRecompense: 15,
      iaType: IAType.AGGRESSIF,
    },
  });

  const loup = await prisma.monstreTemplate.upsert({
    where: { id: 2 },
    update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Loup',
      force: 12,
      intelligence: 3,
      dexterite: 10,
      agilite: 18,
      vie: 8,
      chance: 5,
      pvBase: 35,
      paBase: 6,
      pmBase: 5,
      niveauBase: 1,
      xpRecompense: 20,
      iaType: IAType.AGGRESSIF,
    },
  });

  const bandit = await prisma.monstreTemplate.upsert({
    where: { id: 3 },
    update: { iaType: IAType.EQUILIBRE },
    create: {
      nom: 'Bandit',
      force: 14,
      intelligence: 8,
      dexterite: 12,
      agilite: 10,
      vie: 12,
      chance: 8,
      pvBase: 50,
      paBase: 6,
      pmBase: 3,
      niveauBase: 2,
      xpRecompense: 30,
      iaType: IAType.EQUILIBRE,
    },
  });

  const araigneeGeante = await prisma.monstreTemplate.upsert({
    where: { id: 4 },
    update: { iaType: IAType.DISTANCE },
    create: {
      nom: 'Araignée Géante',
      force: 10,
      intelligence: 2,
      dexterite: 14,
      agilite: 12,
      vie: 10,
      chance: 3,
      pvBase: 40,
      paBase: 6,
      pmBase: 4,
      niveauBase: 2,
      xpRecompense: 25,
      iaType: IAType.DISTANCE,
    },
  });

  const squelette = await prisma.monstreTemplate.upsert({
    where: { id: 5 },
    update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Squelette',
      force: 10,
      intelligence: 2,
      dexterite: 8,
      agilite: 6,
      vie: 15,
      chance: 2,
      pvBase: 45,
      paBase: 6,
      pmBase: 3,
      niveauBase: 3,
      xpRecompense: 35,
      iaType: IAType.AGGRESSIF,
    },
  });

  const trollDesForets = await prisma.monstreTemplate.upsert({
    where: { id: 6 },
    update: { iaType: IAType.AGGRESSIF },
    create: {
      nom: 'Troll des Forêts',
      force: 25,
      intelligence: 4,
      dexterite: 6,
      agilite: 5,
      vie: 30,
      chance: 3,
      pvBase: 120,
      paBase: 6,
      pmBase: 2,
      niveauBase: 5,
      xpRecompense: 100,
      iaType: IAType.AGGRESSIF,
    },
  });

  // ==================== INVOCATION TEMPLATES ====================
  const gardienPierre = await prisma.monstreTemplate.upsert({
    where: { id: 7 },
    update: { iaType: IAType.AGGRESSIF, pvScalingInvocation: 0.25 },
    create: {
      nom: 'Gardien de Pierre',
      force: 15,
      intelligence: 3,
      dexterite: 5,
      agilite: 5,
      vie: 20,
      chance: 3,
      pvBase: 60,
      paBase: 6,
      pmBase: 2,
      niveauBase: 5,
      xpRecompense: 0,
      iaType: IAType.AGGRESSIF,
      pvScalingInvocation: 0.25,
    },
  });

  const espritLumiere = await prisma.monstreTemplate.upsert({
    where: { id: 8 },
    update: { iaType: IAType.SOUTIEN, pvScalingInvocation: 0.10 },
    create: {
      nom: 'Esprit de Lumière',
      force: 3,
      intelligence: 18,
      dexterite: 8,
      agilite: 12,
      vie: 8,
      chance: 5,
      pvBase: 30,
      paBase: 6,
      pmBase: 3,
      niveauBase: 5,
      xpRecompense: 0,
      iaType: IAType.SOUTIEN,
      pvScalingInvocation: 0.10,
    },
  });

  const loupSpectral = await prisma.monstreTemplate.upsert({
    where: { id: 9 },
    update: { iaType: IAType.AGGRESSIF, pvScalingInvocation: 0.10 },
    create: {
      nom: 'Loup Spectral',
      force: 14,
      intelligence: 3,
      dexterite: 10,
      agilite: 20,
      vie: 8,
      chance: 5,
      pvBase: 35,
      paBase: 6,
      pmBase: 5,
      niveauBase: 5,
      xpRecompense: 0,
      iaType: IAType.AGGRESSIF,
      pvScalingInvocation: 0.10,
    },
  });

  const ombreFurtive = await prisma.monstreTemplate.upsert({
    where: { id: 10 },
    update: { iaType: IAType.DISTANCE, pvScalingInvocation: 0.10 },
    create: {
      nom: 'Ombre Furtive',
      force: 8,
      intelligence: 8,
      dexterite: 16,
      agilite: 18,
      vie: 6,
      chance: 8,
      pvBase: 25,
      paBase: 6,
      pmBase: 4,
      niveauBase: 5,
      xpRecompense: 0,
      iaType: IAType.DISTANCE,
      pvScalingInvocation: 0.10,
    },
  });

  const golemArcanique = await prisma.monstreTemplate.upsert({
    where: { id: 11 },
    update: { iaType: IAType.EQUILIBRE, pvScalingInvocation: 0.25 },
    create: {
      nom: 'Golem Arcanique',
      force: 12,
      intelligence: 12,
      dexterite: 6,
      agilite: 6,
      vie: 15,
      chance: 5,
      pvBase: 50,
      paBase: 6,
      pmBase: 3,
      niveauBase: 5,
      xpRecompense: 0,
      iaType: IAType.EQUILIBRE,
      pvScalingInvocation: 0.25,
    },
  });

  console.log('Created 11 monster templates (6 enemies + 5 invocations)');

  // ==================== MAPS ====================
  // Forêt de Vertbois maps
  const oreeForet = await prisma.map.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Orée de la forêt',
      regionId: foretVertbois.id,
      type: MapType.WILDERNESS,
      combatMode: CombatMode.MANUEL,
      largeur: 20,
      hauteur: 15,
      tauxRencontre: 0.2,
    },
  });

  const sentierForestier = await prisma.map.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nom: 'Sentier forestier',
      regionId: foretVertbois.id,
      type: MapType.WILDERNESS,
      combatMode: CombatMode.MANUEL,
      largeur: 25,
      hauteur: 12,
      tauxRencontre: 0.25,
    },
  });

  const grotteAuxGobelins = await prisma.map.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nom: 'Grotte aux Gobelins',
      regionId: foretVertbois.id,
      type: MapType.DONJON,
      combatMode: CombatMode.AUTO,
      largeur: 15,
      hauteur: 30,
      tauxRencontre: 0.35,
    },
  });

  const clairiere = await prisma.map.upsert({
    where: { id: 4 },
    update: {},
    create: {
      nom: 'Clairière paisible',
      regionId: foretVertbois.id,
      type: MapType.SAFE,
      combatMode: CombatMode.MANUEL,
      largeur: 10,
      hauteur: 10,
      tauxRencontre: 0,
    },
  });

  // Plaines du Sud maps
  const routeCommerciale = await prisma.map.upsert({
    where: { id: 5 },
    update: {},
    create: {
      nom: 'Route commerciale',
      regionId: plainesDuSud.id,
      type: MapType.WILDERNESS,
      combatMode: CombatMode.MANUEL,
      largeur: 30,
      hauteur: 10,
      tauxRencontre: 0.15,
    },
  });

  const villageDepart = await prisma.map.upsert({
    where: { id: 6 },
    update: {},
    create: {
      nom: 'Village de Piedmont',
      regionId: plainesDuSud.id,
      type: MapType.VILLE,
      combatMode: CombatMode.MANUEL,
      largeur: 20,
      hauteur: 20,
      tauxRencontre: 0,
    },
  });

  console.log('Created 6 maps');

  // ==================== MAP CONNECTIONS (portails positionnés) ====================
  await prisma.mapConnection.upsert({ where: { id: 1 }, update: {}, create: { fromMapId: oreeForet.id, toMapId: sentierForestier.id, positionX: 19, positionY: 7, nom: 'Vers le sentier forestier' } });
  await prisma.mapConnection.upsert({ where: { id: 2 }, update: {}, create: { fromMapId: sentierForestier.id, toMapId: oreeForet.id, positionX: 0, positionY: 6, nom: "Retour à l'orée" } });
  await prisma.mapConnection.upsert({ where: { id: 3 }, update: {}, create: { fromMapId: sentierForestier.id, toMapId: grotteAuxGobelins.id, positionX: 20, positionY: 3, nom: 'Entrée de la grotte' } });
  await prisma.mapConnection.upsert({ where: { id: 4 }, update: {}, create: { fromMapId: grotteAuxGobelins.id, toMapId: sentierForestier.id, positionX: 7, positionY: 0, nom: 'Sortie de la grotte' } });
  await prisma.mapConnection.upsert({ where: { id: 5 }, update: {}, create: { fromMapId: sentierForestier.id, toMapId: clairiere.id, positionX: 12, positionY: 11, nom: 'Chemin vers la clairière' } });
  await prisma.mapConnection.upsert({ where: { id: 6 }, update: {}, create: { fromMapId: clairiere.id, toMapId: sentierForestier.id, positionX: 5, positionY: 0, nom: 'Retour au sentier' } });
  await prisma.mapConnection.upsert({ where: { id: 7 }, update: {}, create: { fromMapId: villageDepart.id, toMapId: routeCommerciale.id, positionX: 19, positionY: 10, nom: 'Sortie du village (Est)' } });
  await prisma.mapConnection.upsert({ where: { id: 8 }, update: {}, create: { fromMapId: routeCommerciale.id, toMapId: villageDepart.id, positionX: 0, positionY: 5, nom: 'Vers le village' } });
  await prisma.mapConnection.upsert({ where: { id: 9 }, update: {}, create: { fromMapId: routeCommerciale.id, toMapId: oreeForet.id, positionX: 29, positionY: 5, nom: 'Vers la Forêt de Vertbois' } });
  await prisma.mapConnection.upsert({ where: { id: 10 }, update: {}, create: { fromMapId: oreeForet.id, toMapId: routeCommerciale.id, positionX: 0, positionY: 7, nom: 'Vers les Plaines du Sud' } });

  console.log('Created 10 map connections');

  // ==================== MAP DIRECTIONAL NEIGHBORS ====================
  // Set directional links on each map (simpler than connections for navigation)
  await prisma.map.update({ where: { id: oreeForet.id }, data: { estMapId: sentierForestier.id, ouestMapId: routeCommerciale.id } });
  await prisma.map.update({ where: { id: sentierForestier.id }, data: { ouestMapId: oreeForet.id, nordMapId: grotteAuxGobelins.id, sudMapId: clairiere.id } });
  await prisma.map.update({ where: { id: grotteAuxGobelins.id }, data: { sudMapId: sentierForestier.id } });
  await prisma.map.update({ where: { id: clairiere.id }, data: { nordMapId: sentierForestier.id } });
  await prisma.map.update({ where: { id: routeCommerciale.id }, data: { ouestMapId: villageDepart.id, estMapId: oreeForet.id } });
  await prisma.map.update({ where: { id: villageDepart.id }, data: { estMapId: routeCommerciale.id } });

  console.log('Set directional neighbors for 6 maps');

  // ==================== REGION MONSTRES ====================
  await prisma.regionMonstre.upsert({ where: { id: 1 }, update: {}, create: { regionId: foretVertbois.id, monstreId: gobelin.id, probabilite: 0.30 } });
  await prisma.regionMonstre.upsert({ where: { id: 2 }, update: {}, create: { regionId: foretVertbois.id, monstreId: loup.id, probabilite: 0.35 } });
  await prisma.regionMonstre.upsert({ where: { id: 3 }, update: {}, create: { regionId: foretVertbois.id, monstreId: araigneeGeante.id, probabilite: 0.25 } });
  await prisma.regionMonstre.upsert({ where: { id: 4 }, update: {}, create: { regionId: foretVertbois.id, monstreId: trollDesForets.id, probabilite: 0.10 } });
  await prisma.regionMonstre.upsert({ where: { id: 5 }, update: {}, create: { regionId: plainesDuSud.id, monstreId: bandit.id, probabilite: 0.60 } });
  await prisma.regionMonstre.upsert({ where: { id: 6 }, update: {}, create: { regionId: plainesDuSud.id, monstreId: loup.id, probabilite: 0.40 } });
  await prisma.regionMonstre.upsert({ where: { id: 7 }, update: {}, create: { regionId: montagneGrise.id, monstreId: squelette.id, probabilite: 0.50 } });
  await prisma.regionMonstre.upsert({ where: { id: 8 }, update: {}, create: { regionId: montagneGrise.id, monstreId: trollDesForets.id, probabilite: 0.50 } });

  console.log('Created 8 region-monster links');

  // ==================== MONSTRE SORTS ====================
  await prisma.monstreSort.upsert({ where: { id: 1 }, update: {}, create: { monstreId: loup.id, sortId: 21, priorite: 1 } });        // Morsure du loup
  await prisma.monstreSort.upsert({ where: { id: 2 }, update: {}, create: { monstreId: loup.id, sortId: 22, priorite: 2 } });        // Griffure du loup
  await prisma.monstreSort.upsert({ where: { id: 3 }, update: {}, create: { monstreId: gobelin.id, sortId: 23, priorite: 1 } });     // Coup de dague
  await prisma.monstreSort.upsert({ where: { id: 4 }, update: {}, create: { monstreId: bandit.id, sortId: 24, priorite: 1 } });      // Coup d'épée
  await prisma.monstreSort.upsert({ where: { id: 5 }, update: {}, create: { monstreId: bandit.id, sortId: 25, priorite: 2 } });      // Tir d'arbalète
  await prisma.monstreSort.upsert({ where: { id: 6 }, update: {}, create: { monstreId: araigneeGeante.id, sortId: 26, priorite: 1 } }); // Morsure venimeuse
  await prisma.monstreSort.upsert({ where: { id: 7 }, update: {}, create: { monstreId: araigneeGeante.id, sortId: 27, priorite: 2 } }); // Jet de toile
  await prisma.monstreSort.upsert({ where: { id: 8 }, update: {}, create: { monstreId: squelette.id, sortId: 28, priorite: 1 } });   // Coup d'os
  await prisma.monstreSort.upsert({ where: { id: 9 }, update: {}, create: { monstreId: trollDesForets.id, sortId: 29, priorite: 1 } }); // Écrasement
  await prisma.monstreSort.upsert({ where: { id: 10 }, update: {}, create: { monstreId: trollDesForets.id, sortId: 30, priorite: 2 } }); // Lancer de rocher

  console.log('Created 10 monster-spell links');

  // ==================== GROUPES ENNEMIS ====================
  // Groupe 1: Orée de la forêt - Meute de loups
  const groupe1 = await prisma.groupeEnnemi.upsert({
    where: { id: 1 },
    update: {},
    create: {
      mapId: oreeForet.id,
      positionX: 15,
      positionY: 8,
      respawnTime: 300,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 1 },
    update: {},
    create: {
      groupeEnnemiId: groupe1.id,
      monstreId: loup.id,
      quantite: 3,
      niveau: 1,
    },
  });

  // Groupe 2: Orée de la forêt - Gobelins et loups
  const groupe2 = await prisma.groupeEnnemi.upsert({
    where: { id: 2 },
    update: {},
    create: {
      mapId: oreeForet.id,
      positionX: 10,
      positionY: 12,
      respawnTime: 300,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 2 },
    update: {},
    create: {
      groupeEnnemiId: groupe2.id,
      monstreId: gobelin.id,
      quantite: 2,
      niveau: 1,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 3 },
    update: {},
    create: {
      groupeEnnemiId: groupe2.id,
      monstreId: loup.id,
      quantite: 1,
      niveau: 2,
    },
  });

  // Groupe 3: Sentier forestier - Araignées géantes
  const groupe3 = await prisma.groupeEnnemi.upsert({
    where: { id: 3 },
    update: {},
    create: {
      mapId: sentierForestier.id,
      positionX: 12,
      positionY: 6,
      respawnTime: 300,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 4 },
    update: {},
    create: {
      groupeEnnemiId: groupe3.id,
      monstreId: araigneeGeante.id,
      quantite: 4,
      niveau: 2,
    },
  });

  // Groupe 4: Sentier forestier - Groupe mixte
  const groupe4 = await prisma.groupeEnnemi.upsert({
    where: { id: 4 },
    update: {},
    create: {
      mapId: sentierForestier.id,
      positionX: 20,
      positionY: 8,
      respawnTime: 300,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 5 },
    update: {},
    create: {
      groupeEnnemiId: groupe4.id,
      monstreId: loup.id,
      quantite: 2,
      niveau: 2,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 6 },
    update: {},
    create: {
      groupeEnnemiId: groupe4.id,
      monstreId: araigneeGeante.id,
      quantite: 2,
      niveau: 3,
    },
  });

  // Groupe 5: Route commerciale - Bandits
  const groupe5 = await prisma.groupeEnnemi.upsert({
    where: { id: 5 },
    update: {},
    create: {
      mapId: routeCommerciale.id,
      positionX: 15,
      positionY: 5,
      respawnTime: 300,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 7 },
    update: {},
    create: {
      groupeEnnemiId: groupe5.id,
      monstreId: bandit.id,
      quantite: 3,
      niveau: 2,
    },
  });

  // Groupe 6: Route commerciale - Groupe mixte bandits et loups
  const groupe6 = await prisma.groupeEnnemi.upsert({
    where: { id: 6 },
    update: {},
    create: {
      mapId: routeCommerciale.id,
      positionX: 25,
      positionY: 3,
      respawnTime: 300,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 8 },
    update: {},
    create: {
      groupeEnnemiId: groupe6.id,
      monstreId: bandit.id,
      quantite: 2,
      niveau: 2,
    },
  });
  await prisma.groupeEnnemiMembre.upsert({
    where: { id: 9 },
    update: {},
    create: {
      groupeEnnemiId: groupe6.id,
      monstreId: loup.id,
      quantite: 2,
      niveau: 1,
    },
  });

  console.log('Created 6 enemy groups with mixed monsters');

  // ==================== DONJONS ====================
  // Create 4 dungeon room maps for "Grotte aux Gobelins" dungeon
  const donjonSalle1 = await prisma.map.upsert({
    where: { id: 7 },
    update: {},
    create: {
      nom: 'Grotte - Entrée',
      regionId: foretVertbois.id,
      type: MapType.DONJON,
      combatMode: CombatMode.AUTO,
      largeur: 15,
      hauteur: 10,
      tauxRencontre: 1.0,
    },
  });

  const donjonSalle2 = await prisma.map.upsert({
    where: { id: 8 },
    update: {},
    create: {
      nom: 'Grotte - Passage étroit',
      regionId: foretVertbois.id,
      type: MapType.DONJON,
      combatMode: CombatMode.AUTO,
      largeur: 15,
      hauteur: 10,
      tauxRencontre: 1.0,
    },
  });

  const donjonSalle3 = await prisma.map.upsert({
    where: { id: 9 },
    update: {},
    create: {
      nom: 'Grotte - Salle des araignées',
      regionId: foretVertbois.id,
      type: MapType.DONJON,
      combatMode: CombatMode.AUTO,
      largeur: 15,
      hauteur: 10,
      tauxRencontre: 1.0,
    },
  });

  const donjonSalle4 = await prisma.map.upsert({
    where: { id: 10 },
    update: {},
    create: {
      nom: 'Grotte - Antre du Troll',
      regionId: foretVertbois.id,
      type: MapType.BOSS,
      combatMode: CombatMode.AUTO,
      largeur: 15,
      hauteur: 10,
      tauxRencontre: 1.0,
    },
  });

  console.log('Created 4 dungeon room maps');

  // Create the dungeon
  const grotteGobelinsDonjon = await prisma.donjon.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Grotte aux Gobelins',
      description: 'Un réseau de cavernes infesté de gobelins et de créatures dangereuses. Terminez les 4 salles pour vaincre le Troll des Forêts!',
      regionId: foretVertbois.id,
      niveauMin: 1,
      niveauMax: 3,
      bossId: trollDesForets.id,
    },
  });

  // Create the 4 dungeon rooms (salles)
  await prisma.donjonSalle.upsert({
    where: { id: 1 },
    update: {},
    create: {
      donjonId: grotteGobelinsDonjon.id,
      ordre: 1,
      mapId: donjonSalle1.id,
    },
  });

  await prisma.donjonSalle.upsert({
    where: { id: 2 },
    update: {},
    create: {
      donjonId: grotteGobelinsDonjon.id,
      ordre: 2,
      mapId: donjonSalle2.id,
    },
  });

  await prisma.donjonSalle.upsert({
    where: { id: 3 },
    update: {},
    create: {
      donjonId: grotteGobelinsDonjon.id,
      ordre: 3,
      mapId: donjonSalle3.id,
    },
  });

  await prisma.donjonSalle.upsert({
    where: { id: 4 },
    update: {},
    create: {
      donjonId: grotteGobelinsDonjon.id,
      ordre: 4,
      mapId: donjonSalle4.id,
    },
  });

  console.log('Created 1 dungeon with 4 rooms');

  // ==================== GRILLES DE COMBAT ====================
  // Helper to generate standard spawns (players left, enemies right)
  function standardSpawns(largeur: number, hauteur: number) {
    const spawns: { x: number; y: number; equipe: number; ordre: number }[] = [];
    // Player spawns (equipe=0) on left side
    const playerXPositions = [0, 1, 0, 1, 0, 1, 0, 1];
    const playerYOffsets = [-3, -2, -1, 0, 1, 2, 3, 4];
    const centerY = Math.floor(hauteur / 2);
    for (let i = 0; i < 8; i++) {
      spawns.push({
        x: playerXPositions[i],
        y: Math.max(0, Math.min(hauteur - 1, centerY + playerYOffsets[i])),
        equipe: 0,
        ordre: i + 1,
      });
    }
    // Enemy spawns (equipe=1) on right side
    const enemyXPositions = [largeur - 1, largeur - 2, largeur - 1, largeur - 2, largeur - 1, largeur - 2, largeur - 1, largeur - 2];
    const enemyYOffsets = [-3, -2, -1, 0, 1, 2, 3, 4];
    for (let i = 0; i < 8; i++) {
      spawns.push({
        x: enemyXPositions[i],
        y: Math.max(0, Math.min(hauteur - 1, centerY + enemyYOffsets[i])),
        equipe: 1,
        ordre: i + 1,
      });
    }
    return spawns;
  }

  // Helper to generate some obstacles in the middle
  function standardObstacles(largeur: number, hauteur: number) {
    const cases: { x: number; y: number; bloqueDeplacement: boolean; bloqueLigneDeVue: boolean }[] = [];
    const midX = Math.floor(largeur / 2);
    const midY = Math.floor(hauteur / 2);
    // A few rocks in the middle
    cases.push({ x: midX, y: midY - 2, bloqueDeplacement: true, bloqueLigneDeVue: false });
    cases.push({ x: midX, y: midY + 2, bloqueDeplacement: true, bloqueLigneDeVue: false });
    cases.push({ x: midX - 2, y: midY, bloqueDeplacement: true, bloqueLigneDeVue: true });
    cases.push({ x: midX + 2, y: midY, bloqueDeplacement: true, bloqueLigneDeVue: true });
    return cases;
  }

  // Grille 1: Orée de la forêt (map 1)
  const grilleOree = standardSpawns(15, 10);
  const casesOree = standardObstacles(15, 10);
  await prisma.grilleCombat.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'Clairière forestière',
      mapId: oreeForet.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesOree,
      },
      spawns: {
        create: grilleOree,
      },
    },
  });

  // Grille 2: Sentier forestier (map 2)
  const grilleSentier = standardSpawns(15, 10);
  const casesSentier = [
    { x: 5, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 5, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 9, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 9, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 7, y: 1, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 7, y: 8, bloqueDeplacement: true, bloqueLigneDeVue: true },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nom: 'Chemin bordé de rochers',
      mapId: sentierForestier.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesSentier,
      },
      spawns: {
        create: grilleSentier,
      },
    },
  });

  // Grille 3: Grotte aux Gobelins (map 3 - dungeon encounters)
  const grilleGrotte = standardSpawns(15, 10);
  const casesGrotte = [
    { x: 4, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 4, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 10, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 10, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 7, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 7, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nom: 'Galerie souterraine',
      mapId: grotteAuxGobelins.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesGrotte,
      },
      spawns: {
        create: grilleGrotte,
      },
    },
  });

  // Grille 4: Route commerciale (map 5)
  const grilleRoute = standardSpawns(15, 10);
  const casesRoute = [
    { x: 6, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 6, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 8, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 8, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 4 },
    update: {},
    create: {
      nom: 'Route ouverte',
      mapId: routeCommerciale.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesRoute,
      },
      spawns: {
        create: grilleRoute,
      },
    },
  });

  // Grille 5: Donjon Salle 1 (map 7)
  const grilleDonjon1 = standardSpawns(15, 10);
  const casesDonjon1 = [
    { x: 5, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 5, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 9, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 9, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: true },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 5 },
    update: {},
    create: {
      nom: 'Entrée de la grotte - Combat',
      mapId: donjonSalle1.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesDonjon1,
      },
      spawns: {
        create: grilleDonjon1,
      },
    },
  });

  // Grille 6: Donjon Salle 2 (map 8)
  const grilleDonjon2 = standardSpawns(15, 10);
  const casesDonjon2 = [
    { x: 3, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 3, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 7, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 7, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 11, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 11, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 6 },
    update: {},
    create: {
      nom: 'Passage étroit - Combat',
      mapId: donjonSalle2.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesDonjon2,
      },
      spawns: {
        create: grilleDonjon2,
      },
    },
  });

  // Grille 7: Donjon Salle 3 (map 9)
  const grilleDonjon3 = standardSpawns(15, 10);
  const casesDonjon3 = [
    { x: 5, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 5, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 7, y: 4, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 7, y: 5, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 9, y: 2, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 9, y: 7, bloqueDeplacement: true, bloqueLigneDeVue: true },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 7 },
    update: {},
    create: {
      nom: 'Salle des araignées - Combat',
      mapId: donjonSalle3.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesDonjon3,
      },
      spawns: {
        create: grilleDonjon3,
      },
    },
  });

  // Grille 8: Donjon Salle 4 - Boss room (map 10)
  const grilleBoss = standardSpawns(15, 10);
  const casesBoss = [
    { x: 4, y: 1, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 4, y: 8, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 10, y: 1, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 10, y: 8, bloqueDeplacement: true, bloqueLigneDeVue: true },
    { x: 7, y: 3, bloqueDeplacement: true, bloqueLigneDeVue: false },
    { x: 7, y: 6, bloqueDeplacement: true, bloqueLigneDeVue: false },
  ];
  await prisma.grilleCombat.upsert({
    where: { id: 8 },
    update: {},
    create: {
      nom: 'Antre du Troll - Combat',
      mapId: donjonSalle4.id,
      largeur: 15,
      hauteur: 10,
      cases: {
        create: casesBoss,
      },
      spawns: {
        create: grilleBoss,
      },
    },
  });

  console.log('Created 8 combat grid templates');

  // ==================== SORT EFFETS (liens sort → effet) ====================
  // Cri de rage (sort 31) → Rage (effet 1) sur lanceur (100%)
  await prisma.sortEffet.upsert({
    where: { id: 1 },
    update: {},
    create: {
      sortId: 31,
      effetId: 1, // Rage (+20 FORCE)
      chanceDeclenchement: 1.0,
      surCible: false, // sur lanceur
    },
  });

  // Méditation (sort 32) → Concentration (effet 2) sur lanceur (100%)
  await prisma.sortEffet.upsert({
    where: { id: 2 },
    update: {},
    create: {
      sortId: 32,
      effetId: 2, // Concentration (+15 INT)
      chanceDeclenchement: 1.0,
      surCible: false,
    },
  });

  // Malédiction (sort 33) → Affaiblissement (effet 4) sur cible (100%)
  await prisma.sortEffet.upsert({
    where: { id: 3 },
    update: {},
    create: {
      sortId: 33,
      effetId: 4, // Affaiblissement (-15 FORCE)
      chanceDeclenchement: 1.0,
      surCible: true,
    },
  });

  // Entrave (sort 34) → Ralentissement (effet 5) sur cible (100%)
  await prisma.sortEffet.upsert({
    where: { id: 4 },
    update: {},
    create: {
      sortId: 34,
      effetId: 5, // Ralentissement (-20 AGI)
      chanceDeclenchement: 1.0,
      surCible: true,
    },
  });

  // Pas lourd (sort 35) → Agilité accrue (effet 3) sur lanceur (100%)
  await prisma.sortEffet.upsert({
    where: { id: 5 },
    update: {},
    create: {
      sortId: 35,
      effetId: 3, // Agilité accrue (+25 AGI)
      chanceDeclenchement: 1.0,
      surCible: false,
    },
  });

  // Coup brutal (sort 13, Orc) → 25% chance d'Affaiblissement sur cible
  await prisma.sortEffet.upsert({
    where: { id: 6 },
    update: {},
    create: {
      sortId: 13, // Coup brutal
      effetId: 4, // Affaiblissement
      chanceDeclenchement: 0.25,
      surCible: true,
    },
  });

  // Morsure venimeuse (sort 26, Araignée) → 30% chance de Ralentissement
  await prisma.sortEffet.upsert({
    where: { id: 7 },
    update: {},
    create: {
      sortId: 26, // Morsure venimeuse
      effetId: 5, // Ralentissement
      chanceDeclenchement: 0.30,
      surCible: true,
    },
  });

  // Jet de toile (sort 27, Araignée) → 50% chance de Ralentissement
  await prisma.sortEffet.upsert({
    where: { id: 8 },
    update: {},
    create: {
      sortId: 27, // Jet de toile
      effetId: 5, // Ralentissement
      chanceDeclenchement: 0.50,
      surCible: true,
    },
  });

  console.log('Created 8 spell-effect links');

  // ==================== SORTS POUR INVOCATIONS ====================
  // Gardien de Pierre
  await prisma.sort.upsert({
    where: { id: 44 },
    update: {},
    create: {
      nom: 'Frappe de pierre',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 15,
      degatsMax: 25,
      degatsCritMin: 30,
      degatsCritMax: 45,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Esprit de Lumière
  await prisma.sort.upsert({
    where: { id: 45 },
    update: {},
    create: {
      nom: 'Rayon lumineux',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 2,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 10,
      degatsMax: 18,
      degatsCritMin: 22,
      degatsCritMax: 32,
      chanceCritBase: 0.08,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 46 },
    update: {},
    create: {
      nom: 'Soin mineur',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 10,
      degatsMax: 18,
      degatsCritMin: 20,
      degatsCritMax: 30,
      chanceCritBase: 0.05,
      cooldown: 1,
      estSoin: true,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Loup Spectral
  await prisma.sort.upsert({
    where: { id: 47 },
    update: {},
    create: {
      nom: 'Morsure spectrale',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 14,
      degatsMax: 22,
      degatsCritMin: 28,
      degatsCritMax: 40,
      chanceCritBase: 0.10,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Ombre Furtive
  await prisma.sort.upsert({
    where: { id: 48 },
    update: {},
    create: {
      nom: "Lancer d'ombre",
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 2,
      porteeMin: 2,
      porteeMax: 5,
      ligneDeVue: true,
      degatsMin: 8,
      degatsMax: 14,
      degatsCritMin: 18,
      degatsCritMax: 28,
      chanceCritBase: 0.12,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  // Golem Arcanique
  await prisma.sort.upsert({
    where: { id: 49 },
    update: {},
    create: {
      nom: 'Poing arcanique',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 3,
      porteeMin: 1,
      porteeMax: 1,
      ligneDeVue: true,
      degatsMin: 12,
      degatsMax: 20,
      degatsCritMin: 25,
      degatsCritMax: 38,
      chanceCritBase: 0.05,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 50 },
    update: {},
    create: {
      nom: 'Rayon arcanique',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4,
      porteeMin: 2,
      porteeMax: 4,
      ligneDeVue: true,
      degatsMin: 10,
      degatsMax: 18,
      degatsCritMin: 22,
      degatsCritMax: 32,
      chanceCritBase: 0.08,
      cooldown: 0,
      niveauApprentissage: 1,
      raceId: null,
      zoneId: zoneCase.id,
    },
  });

  console.log('Created 7 invocation spells');

  // ==================== SORTS D'INVOCATION (1 par race, niv 5) ====================
  await prisma.sort.upsert({
    where: { id: 51 },
    update: {},
    create: {
      nom: 'Invoquer Golem',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 5,
      porteeMin: 1,
      porteeMax: 3,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 5,
      estInvocation: true,
      invocationTemplateId: golemArcanique.id,
      niveauApprentissage: 5,
      raceId: humain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 52 },
    update: {},
    create: {
      nom: 'Invoquer Esprit',
      type: SortType.SORT,
      statUtilisee: StatType.INTELLIGENCE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 3,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 5,
      estInvocation: true,
      invocationTemplateId: espritLumiere.id,
      niveauApprentissage: 5,
      raceId: elfe.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 53 },
    update: {},
    create: {
      nom: 'Invoquer Gardien',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 5,
      porteeMin: 1,
      porteeMax: 2,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 5,
      estInvocation: true,
      invocationTemplateId: gardienPierre.id,
      niveauApprentissage: 5,
      raceId: nain.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 54 },
    update: {},
    create: {
      nom: 'Invoquer Loup Spectral',
      type: SortType.SORT,
      statUtilisee: StatType.FORCE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 2,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 4,
      estInvocation: true,
      invocationTemplateId: loupSpectral.id,
      niveauApprentissage: 5,
      raceId: orc.id,
      zoneId: zoneCase.id,
    },
  });

  await prisma.sort.upsert({
    where: { id: 55 },
    update: {},
    create: {
      nom: 'Invoquer Ombre',
      type: SortType.SORT,
      statUtilisee: StatType.DEXTERITE,
      coutPA: 4,
      porteeMin: 1,
      porteeMax: 3,
      ligneDeVue: true,
      degatsMin: 0,
      degatsMax: 0,
      degatsCritMin: 0,
      degatsCritMax: 0,
      chanceCritBase: 0,
      cooldown: 4,
      estInvocation: true,
      invocationTemplateId: ombreFurtive.id,
      niveauApprentissage: 5,
      raceId: halfelin.id,
      zoneId: zoneCase.id,
    },
  });

  console.log('Created 5 invocation race spells');

  // ==================== MONSTRE SORTS (invocations) ====================
  await prisma.monstreSort.upsert({ where: { id: 11 }, update: {}, create: { monstreId: gardienPierre.id, sortId: 44, priorite: 1 } });   // Frappe de pierre
  await prisma.monstreSort.upsert({ where: { id: 12 }, update: {}, create: { monstreId: espritLumiere.id, sortId: 46, priorite: 1 } });   // Soin mineur
  await prisma.monstreSort.upsert({ where: { id: 13 }, update: {}, create: { monstreId: espritLumiere.id, sortId: 45, priorite: 2 } });   // Rayon lumineux
  await prisma.monstreSort.upsert({ where: { id: 14 }, update: {}, create: { monstreId: loupSpectral.id, sortId: 47, priorite: 1 } });    // Morsure spectrale
  await prisma.monstreSort.upsert({ where: { id: 15 }, update: {}, create: { monstreId: ombreFurtive.id, sortId: 48, priorite: 1 } });    // Lancer d'ombre
  await prisma.monstreSort.upsert({ where: { id: 16 }, update: {}, create: { monstreId: golemArcanique.id, sortId: 49, priorite: 1 } });  // Poing arcanique
  await prisma.monstreSort.upsert({ where: { id: 17 }, update: {}, create: { monstreId: golemArcanique.id, sortId: 50, priorite: 2 } });  // Rayon arcanique

  console.log('Created 7 invocation monster-spell links');

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
