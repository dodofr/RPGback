import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { z } from 'zod';

// ============================================================
// Enum schemas (same values as static.routes.ts)
// ============================================================
const StatTypeEnum = z.enum(['FORCE', 'INTELLIGENCE', 'DEXTERITE', 'AGILITE', 'VIE', 'CHANCE', 'PA', 'PM', 'PO', 'DOMMAGES', 'SOINS']);
const SlotTypeEnum = z.enum(['ARME', 'COIFFE', 'AMULETTE', 'BOUCLIER', 'HAUT', 'BAS', 'ANNEAU1', 'ANNEAU2', 'FAMILIER']);
const EffetTypeEnum = z.enum(['BUFF', 'DEBUFF', 'DISPEL', 'POUSSEE', 'ATTIRANCE', 'POISON', 'BOUCLIER', 'RESISTANCE']);
const ZoneTypeEnum = z.enum(['CASE', 'CROIX', 'LIGNE', 'CONE', 'CERCLE', 'LIGNE_PERPENDICULAIRE', 'DIAGONALE', 'CARRE', 'ANNEAU', 'CONE_INVERSE']);
const IATypeEnum = z.enum(['EQUILIBRE', 'AGGRESSIF', 'SOUTIEN', 'DISTANCE']);
const RegionTypeEnum = z.enum(['FORET', 'PLAINE', 'DESERT', 'MONTAGNE', 'MARAIS', 'CAVERNE', 'CITE']);
const MapTypeEnum = z.enum(['WILDERNESS', 'VILLE', 'DONJON', 'BOSS', 'SAFE']);
const CombatModeEnum = z.enum(['MANUEL', 'AUTO']);

// ============================================================
// Sub-schemas (inline references by name)
// ============================================================

const zoneInlineSchema = z.object({
  type: ZoneTypeEnum,
  taille: z.number().int().min(0),
  nom: z.string().optional(),
});

const sortEffetInlineSchema = z.object({
  effet: z.string().min(1),
  chanceDeclenchement: z.number().min(0).max(1).default(1.0),
  surCible: z.boolean().default(true),
});

const monstreSortInlineSchema = z.object({
  sort: z.string().min(1),
  priorite: z.number().int().min(1).default(1),
});

const monstreDropRessourceSchema = z.object({
  ressource: z.string().min(1),
  tauxDrop: z.number().min(0).max(1),
  quantiteMin: z.number().int().min(1),
  quantiteMax: z.number().int().min(1),
});

const monstreDropEquipementSchema = z.object({
  equipement: z.string().min(1),
  tauxDrop: z.number().min(0).max(1),
  quantiteMin: z.number().int().min(1),
  quantiteMax: z.number().int().min(1),
});

const monstreDropInlineSchema = z.union([monstreDropRessourceSchema, monstreDropEquipementSchema]);

const ligneImportSchema = z.object({
  ordre: z.number().int().min(1),
  degatsMin: z.number().int().min(0),
  degatsMax: z.number().int().min(0),
  statUtilisee: StatTypeEnum,
  estVolDeVie: z.boolean().default(false),
  estSoin: z.boolean().default(false),
});

const recetteIngredientInlineSchema = z.object({
  ressource: z.string().min(1),
  quantite: z.number().int().min(1),
});

const mapCaseInlineSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  bloqueDeplacement: z.boolean().default(false),
  bloqueLigneDeVue: z.boolean().default(false),
  estExclue: z.boolean().default(false),
});

const mapSpawnInlineSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  equipe: z.number().int().min(0).max(1),
  ordre: z.number().int().min(1).max(8),
});

// ============================================================
// Main entity schemas
// ============================================================

const ressourceImportSchema = z.object({
  nom: z.string().min(1),
  poids: z.number().int().min(0).default(1),
  estPremium: z.boolean().default(false),
});

const effetImportSchema = z.object({
  nom: z.string().min(1),
  type: EffetTypeEnum,
  statCiblee: StatTypeEnum.default('FORCE'),
  // For BUFF/DEBUFF: use valeur (stat change). For POISON: use valeurMin + valeurMax.
  valeur: z.number().int().default(0),
  valeurMin: z.number().int().optional(),
  valeurMax: z.number().int().optional(), // alias for schema.valeur in POISON context
  duree: z.number().int().min(0),
  cumulable: z.boolean().default(false),
});

const raceImportSchema = z.object({
  nom: z.string().min(1),
  bonusForce: z.number().int().default(0),
  bonusIntelligence: z.number().int().default(0),
  bonusDexterite: z.number().int().default(0),
  bonusAgilite: z.number().int().default(0),
  bonusVie: z.number().int().default(0),
  bonusChance: z.number().int().default(0),
});

const sortImportSchema = z.object({
  nom: z.string().min(1),
  race: z.string().optional(),              // nom race → raceId (null = neutre)
  type: z.enum(['ARME', 'SORT']).default('SORT'),
  statUtilisee: StatTypeEnum.default('FORCE'),
  niveauRequis: z.number().int().min(1).default(1), // maps to niveauApprentissage
  coutPA: z.number().int().min(0),
  porteeMin: z.number().int().min(0).default(0),
  porteeMax: z.number().int().min(0),
  ligneDeVue: z.boolean().default(true),
  degatsMin: z.number().int().min(0).default(0),
  degatsMax: z.number().int().min(0).default(0),
  degatsCritMin: z.number().int().min(0).default(0),
  degatsCritMax: z.number().int().min(0).default(0),
  chanceCritBase: z.number().min(0).max(1).default(0.01),
  cooldown: z.number().int().min(0).default(0),
  estSoin: z.boolean().default(false),
  tauxEchec: z.number().min(0).max(1).default(0),
  zone: zoneInlineSchema.optional(),
  estInvocation: z.boolean().default(false),
  estVolDeVie: z.boolean().default(false),
  invocationTemplate: z.string().optional(), // nom MonstreTemplate → invocationTemplateId
  porteeModifiable: z.boolean().default(true),
  ligneDirecte: z.boolean().default(false),
  estGlyphe: z.boolean().default(false),
  estPiege: z.boolean().default(false),
  poseDuree: z.number().int().min(1).optional(),
  estTeleportation: z.boolean().default(false),
  estSelfBuff: z.boolean().default(false),
  coefficient: z.number().min(0).max(10).default(1.0),
  effets: z.array(sortEffetInlineSchema).optional(),
});

const monstreImportSchema = z.object({
  nom: z.string().min(1),
  force: z.number().int().default(10),
  intelligence: z.number().int().default(10),
  dexterite: z.number().int().default(10),
  agilite: z.number().int().default(10),
  vie: z.number().int().default(10),
  chance: z.number().int().default(10),
  pvBase: z.number().int().optional(), // if absent, computed as 50 + vie*5
  paBase: z.number().int().default(6),
  pmBase: z.number().int().default(3),
  niveauBase: z.number().int().default(1),
  xpRecompense: z.number().int().default(10),
  orMin: z.number().int().default(0),
  orMax: z.number().int().default(0),
  iaType: IATypeEnum.default('EQUILIBRE'),
  pvScalingInvocation: z.number().nullable().optional(),
  resistanceForce: z.number().int().default(0),
  resistanceIntelligence: z.number().int().default(0),
  resistanceDexterite: z.number().int().default(0),
  resistanceAgilite: z.number().int().default(0),
  sorts: z.array(monstreSortInlineSchema).optional(),
  drops: z.array(monstreDropInlineSchema).optional(), // absent = skip, [] = clear
  regions: z.array(z.object({
    region: z.string().min(1),
    probabilite: z.number().min(0).default(1.0),
  })).optional(), // absent = skip, [] = clear
});

const equipementImportSchema = z.object({
  nom: z.string().min(1),
  slot: SlotTypeEnum,
  niveauRequis: z.number().int().min(1).default(1), // maps to niveauMinimum
  poids: z.number().int().min(0).default(1),
  bonusForce: z.number().int().default(0),
  bonusIntelligence: z.number().int().default(0),
  bonusDexterite: z.number().int().default(0),
  bonusAgilite: z.number().int().default(0),
  bonusVie: z.number().int().default(0),
  bonusChance: z.number().int().default(0),
  bonusPA: z.number().int().default(0),
  bonusPM: z.number().int().default(0),
  bonusPO: z.number().int().default(0),
  bonusForceMax: z.number().int().nullable().optional(),
  bonusIntelligenceMax: z.number().int().nullable().optional(),
  bonusDexteriteMax: z.number().int().nullable().optional(),
  bonusAgiliteMax: z.number().int().nullable().optional(),
  bonusVieMax: z.number().int().nullable().optional(),
  bonusChanceMax: z.number().int().nullable().optional(),
  bonusPAMax: z.number().int().nullable().optional(),
  bonusPMMax: z.number().int().nullable().optional(),
  bonusPOMax: z.number().int().nullable().optional(),
  bonusCritiqueMax: z.number().int().nullable().optional(),
  resistanceForce: z.number().int().min(0).max(75).default(0),
  resistanceIntelligence: z.number().int().min(0).max(75).default(0),
  resistanceDexterite: z.number().int().min(0).max(75).default(0),
  resistanceAgilite: z.number().int().min(0).max(75).default(0),
  resistanceForceMax: z.number().int().min(0).max(75).nullable().optional(),
  resistanceIntelligenceMax: z.number().int().min(0).max(75).nullable().optional(),
  resistanceDexteriteMax: z.number().int().min(0).max(75).nullable().optional(),
  resistanceAgiliteMax: z.number().int().min(0).max(75).nullable().optional(),
  bonusDommages: z.number().int().default(0),
  bonusDommagesMax: z.number().int().nullable().optional(),
  bonusSoins: z.number().int().default(0),
  bonusSoinsMax: z.number().int().nullable().optional(),
  // Weapon-specific fields (nullable)
  degatsMin: z.number().int().nullable().optional(),
  degatsMax: z.number().int().nullable().optional(),
  chanceCritBase: z.number().nullable().optional(),
  bonusCrit: z.number().int().nullable().optional(),
  coutPA: z.number().int().nullable().optional(),
  porteeMin: z.number().int().nullable().optional(),
  porteeMax: z.number().int().nullable().optional(),
  ligneDeVue: z.boolean().nullable().optional(),
  statUtilisee: StatTypeEnum.nullable().optional(),
  cooldown: z.number().int().nullable().optional(),
  tauxEchec: z.number().nullable().optional(),
  estVolDeVie: z.boolean().default(false),
  lignes: z.array(ligneImportSchema).optional(),
});

const recetteImportSchema = z.object({
  nom: z.string().min(1),
  equipement: z.string().min(1), // nom équipement → equipementId
  niveauMinimum: z.number().int().min(1).default(1),
  coutOr: z.number().int().min(0).default(0),
  ingredients: z.array(recetteIngredientInlineSchema),
});

const regionImportSchema = z.object({
  nom: z.string().min(1),
  type: RegionTypeEnum,
  niveauMin: z.number().int().min(1).default(1),
  niveauMax: z.number().int().min(1).default(10),
  description: z.string().optional(),
});

const mapImportSchema = z.object({
  nom: z.string().min(1),
  region: z.string().min(1),          // nom région → regionId
  type: MapTypeEnum,
  combatMode: CombatModeEnum,
  largeur: z.number().int().min(1).default(16),
  hauteur: z.number().int().min(1).default(18),
  // Spawns : spawnsDefaut=true → layout standard (x=1 joueurs / x=largeur-2 ennemis, y pair 2-16)
  // spawns=[...] → positions explicites. Absent → spawns existants préservés
  spawnsDefaut: z.boolean().default(false),
  spawns: z.array(mapSpawnInlineSchema).optional(),
  // Cases : absent → cases existantes préservées. [] → suppression. [...] → remplacement
  cases: z.array(mapCaseInlineSchema).optional(),
});

// ============================================================
// Root pack schema — all sections optional
// ============================================================
const importPackSchema = z.object({
  regions: z.array(regionImportSchema).optional(),
  maps: z.array(mapImportSchema).optional(),
  ressources: z.array(ressourceImportSchema).optional(),
  effets: z.array(effetImportSchema).optional(),
  zones: z.array(zoneInlineSchema).optional(),
  races: z.array(raceImportSchema).optional(),
  sorts: z.array(sortImportSchema).optional(),
  monstres: z.array(monstreImportSchema).optional(),
  equipements: z.array(equipementImportSchema).optional(),
  recettes: z.array(recetteImportSchema).optional(),
});

// ============================================================
// Custom error for reference failures (triggers 400, not 500)
// ============================================================
class ImportRefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportRefError';
  }
}

// ============================================================
// Router
// ============================================================
const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    // ── 1. Validate input ───────────────────────────────────
    const parsed = importPackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
      return;
    }
    const pack = parsed.data;

    // ── 2. Check for duplicate names within each named section ──
    const namedSections: [string, { nom: string }[] | undefined][] = [
      ['regions', pack.regions],
      ['ressources', pack.ressources],
      ['effets', pack.effets],
      ['races', pack.races],
      ['sorts', pack.sorts],
      ['monstres', pack.monstres],
      ['equipements', pack.equipements],
      ['recettes', pack.recettes],
    ];
    for (const [sectionName, items] of namedSections) {
      if (!items?.length) continue;
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item.nom)) {
          res.status(400).json({ error: `Doublon dans la section '${sectionName}' : '${item.nom}' apparaît plusieurs fois` });
          return;
        }
        seen.add(item.nom);
      }
    }
    // Map duplicates use composite key nom+region
    if (pack.maps?.length) {
      const seen = new Set<string>();
      for (const m of pack.maps) {
        const key = `${m.nom}_${m.region}`;
        if (seen.has(key)) {
          res.status(400).json({ error: `Doublon dans la section 'maps' : '${m.nom}' dans région '${m.region}' apparaît plusieurs fois` });
          return;
        }
        seen.add(key);
      }
    }

    // Zone duplicates use composite key type+taille
    if (pack.zones?.length) {
      const seen = new Set<string>();
      for (const z of pack.zones) {
        const key = `${z.type}_${z.taille}`;
        if (seen.has(key)) {
          res.status(400).json({ error: `Doublon dans la section 'zones' : '${key}' apparaît plusieurs fois` });
          return;
        }
        seen.add(key);
      }
    }

    // ── 3. Transaction ──────────────────────────────────────
    const counters = {
      regions: 0, maps: 0, mapCases: 0, mapSpawns: 0,
      ressources: 0, effets: 0, zones: 0, races: 0,
      sorts: 0, sortEffets: 0, monstres: 0, regionMonstres: 0,
      monstreSorts: 0, monstreDrops: 0,
      equipements: 0, lignesDegats: 0,
      recettes: 0, recetteIngredients: 0,
    };

    await prisma.$transaction(async (tx) => {
      // Name → id caches
      const cache = {
        regions: new Map<string, number>(),         // nom → id
        maps: new Map<string, number>(),            // "nom_regionId" → id
        ressources: new Map<string, number>(),
        effets: new Map<string, number>(),
        zones: new Map<string, number>(),           // "TYPE_N" → id
        races: new Map<string, number>(),
        sorts: new Map<string, number>(),
        monstres: new Map<string, number>(),
        equipements: new Map<string, number>(),
      };

      // ── PRE-LOAD: populate cache with existing DB entries ──
      const dbRegions = await tx.region.findMany({ select: { id: true, nom: true } });
      const dbMaps = await tx.map.findMany({ select: { id: true, nom: true, regionId: true } });
      const dbRessources = await tx.ressource.findMany({ select: { id: true, nom: true } });
      const dbEffets = await tx.effet.findMany({ select: { id: true, nom: true } });
      const dbZones = await tx.zone.findMany({ select: { id: true, type: true, taille: true } });
      const dbRaces = await tx.race.findMany({ select: { id: true, nom: true } });
      const dbSorts = await tx.sort.findMany({ select: { id: true, nom: true } });
      const dbMonstres = await tx.monstreTemplate.findMany({ select: { id: true, nom: true } });
      const dbEquipements = await tx.equipement.findMany({ select: { id: true, nom: true } });

      for (const r of dbRegions) cache.regions.set(r.nom, r.id);
      for (const m of dbMaps) cache.maps.set(`${m.nom}_${m.regionId}`, m.id);
      for (const r of dbRessources) cache.ressources.set(r.nom, r.id);
      for (const e of dbEffets) cache.effets.set(e.nom, e.id);
      for (const z of dbZones) cache.zones.set(`${z.type}_${z.taille}`, z.id);
      for (const r of dbRaces) cache.races.set(r.nom, r.id);
      for (const s of dbSorts) cache.sorts.set(s.nom, s.id);
      for (const m of dbMonstres) cache.monstres.set(m.nom, m.id);
      for (const e of dbEquipements) cache.equipements.set(e.nom, e.id);

      // ── STEP 0: Régions ───────────────────────────────────
      for (const r of pack.regions ?? []) {
        const data = {
          type: r.type as any,
          niveauMin: r.niveauMin,
          niveauMax: r.niveauMax,
          description: r.description ?? null,
        };
        const upserted = await tx.region.upsert({
          where: { nom: r.nom },
          update: data,
          create: { nom: r.nom, ...data },
          select: { id: true },
        });
        cache.regions.set(r.nom, upserted.id);
        counters.regions++;
      }

      // ── STEP 0.5: Maps ────────────────────────────────────
      for (const m of pack.maps ?? []) {
        // Résolution région
        if (!cache.regions.has(m.region)) {
          throw new ImportRefError(`Map '${m.nom}' : région '${m.region}' introuvable en BDD ni dans le pack`);
        }
        const regionId = cache.regions.get(m.region)!;

        const data = {
          type: m.type as any,
          combatMode: m.combatMode as any,
          largeur: m.largeur,
          hauteur: m.hauteur,
        };

        const existing = await tx.map.findFirst({ where: { nom: m.nom, regionId }, select: { id: true } });
        let mapId: number;
        if (existing) {
          await tx.map.update({ where: { id: existing.id }, data });
          mapId = existing.id;
        } else {
          const created = await tx.map.create({ data: { nom: m.nom, regionId, ...data }, select: { id: true } });
          mapId = created.id;
        }
        cache.maps.set(`${m.nom}_${regionId}`, mapId);
        counters.maps++;

        // Cases : absent → préservées. [] ou [...] → remplacement
        if (m.cases !== undefined) {
          await tx.mapCase.deleteMany({ where: { mapId } });
          for (const c of m.cases) {
            await tx.mapCase.create({
              data: {
                mapId,
                x: c.x,
                y: c.y,
                bloqueDeplacement: c.bloqueDeplacement,
                bloqueLigneDeVue: c.bloqueLigneDeVue,
                estExclue: c.estExclue,
              },
            });
            counters.mapCases++;
          }
        }

        // Spawns : absent → préservés. spawnsDefaut → layout standard. spawns=[...] → explicite
        const spawnsToCreate: Array<{ x: number; y: number; equipe: number; ordre: number }> = [];
        if (m.spawnsDefaut) {
          const ys = [2, 4, 6, 8, 10, 12, 14, 16];
          for (let i = 0; i < 8; i++) {
            spawnsToCreate.push({ x: 1, y: ys[i], equipe: 0, ordre: i + 1 });
            spawnsToCreate.push({ x: m.largeur - 2, y: ys[i], equipe: 1, ordre: i + 1 });
          }
        } else if (m.spawns !== undefined) {
          spawnsToCreate.push(...m.spawns);
        }

        if (spawnsToCreate.length > 0) {
          await tx.mapSpawn.deleteMany({ where: { mapId } });
          for (const s of spawnsToCreate) {
            await tx.mapSpawn.create({
              data: { mapId, x: s.x, y: s.y, equipe: s.equipe, ordre: s.ordre },
            });
            counters.mapSpawns++;
          }
        }
      }

      // ── STEP 1: Ressources ────────────────────────────────
      for (const r of pack.ressources ?? []) {
        const upserted = await tx.ressource.upsert({
          where: { nom: r.nom },
          update: { poids: r.poids, estPremium: r.estPremium },
          create: { nom: r.nom, poids: r.poids, estPremium: r.estPremium },
          select: { id: true },
        });
        cache.ressources.set(r.nom, upserted.id);
        counters.ressources++;
      }

      // ── STEP 2: Effets ────────────────────────────────────
      for (const e of pack.effets ?? []) {
        // valeurMax overrides valeur (POISON convention: min-max per tick)
        const schemaValeur = e.valeurMax !== undefined ? e.valeurMax : e.valeur;
        const data = {
          type: e.type as any,
          statCiblee: e.statCiblee as any,
          valeur: schemaValeur,
          valeurMin: e.valeurMin ?? null,
          duree: e.duree,
          cumulable: e.cumulable,
        };
        const existing = await tx.effet.findFirst({ where: { nom: e.nom }, select: { id: true } });
        let effetId: number;
        if (existing) {
          await tx.effet.update({ where: { id: existing.id }, data });
          effetId = existing.id;
        } else {
          const created = await tx.effet.create({ data: { nom: e.nom, ...data }, select: { id: true } });
          effetId = created.id;
        }
        cache.effets.set(e.nom, effetId);
        counters.effets++;
      }

      // ── STEP 3: Zones ─────────────────────────────────────
      // Only creates zones not already in DB (identified by type+taille composite key)
      for (const z of pack.zones ?? []) {
        const key = `${z.type}_${z.taille}`;
        if (!cache.zones.has(key)) {
          const created = await tx.zone.create({
            data: { nom: z.nom ?? `${z.type} ${z.taille}`, type: z.type as any, taille: z.taille },
            select: { id: true },
          });
          cache.zones.set(key, created.id);
          counters.zones++;
        }
      }

      // ── STEP 4: Races ─────────────────────────────────────
      for (const r of pack.races ?? []) {
        const data = {
          bonusForce: r.bonusForce,
          bonusIntelligence: r.bonusIntelligence,
          bonusDexterite: r.bonusDexterite,
          bonusAgilite: r.bonusAgilite,
          bonusVie: r.bonusVie,
          bonusChance: r.bonusChance,
        };
        const upserted = await tx.race.upsert({
          where: { nom: r.nom },
          update: data,
          create: { nom: r.nom, ...data },
          select: { id: true },
        });
        cache.races.set(r.nom, upserted.id);
        counters.races++;
      }

      // ── STEP 5: Monstres (base, without sorts/drops) ──────
      // Must come before sorts so invocationTemplate refs are resolvable in step 6
      for (const m of pack.monstres ?? []) {
        const pvBase = m.pvBase ?? (50 + m.vie * 5);
        const data = {
          force: m.force,
          intelligence: m.intelligence,
          dexterite: m.dexterite,
          agilite: m.agilite,
          vie: m.vie,
          chance: m.chance,
          pvBase,
          paBase: m.paBase,
          pmBase: m.pmBase,
          niveauBase: m.niveauBase,
          xpRecompense: m.xpRecompense,
          orMin: m.orMin,
          orMax: m.orMax,
          iaType: m.iaType as any,
          pvScalingInvocation: m.pvScalingInvocation ?? null,
          resistanceForce: m.resistanceForce,
          resistanceIntelligence: m.resistanceIntelligence,
          resistanceDexterite: m.resistanceDexterite,
          resistanceAgilite: m.resistanceAgilite,
        };
        const existing = await tx.monstreTemplate.findFirst({ where: { nom: m.nom }, select: { id: true } });
        let monstreId: number;
        if (existing) {
          await tx.monstreTemplate.update({ where: { id: existing.id }, data });
          monstreId = existing.id;
        } else {
          const created = await tx.monstreTemplate.create({ data: { nom: m.nom, ...data }, select: { id: true } });
          monstreId = created.id;
        }
        cache.monstres.set(m.nom, monstreId);
        counters.monstres++;

        // RegionMonstre : absent → préservé. [] → suppression. [...] → remplacement
        if (m.regions !== undefined) {
          await tx.regionMonstre.deleteMany({ where: { monstreId } });
          for (const rm of m.regions) {
            if (!cache.regions.has(rm.region)) {
              throw new ImportRefError(`Monstre '${m.nom}' : région '${rm.region}' introuvable en BDD ni dans le pack`);
            }
            const regionId = cache.regions.get(rm.region)!;
            await tx.regionMonstre.create({
              data: { regionId, monstreId, probabilite: rm.probabilite },
            });
            counters.regionMonstres++;
          }
        }
      }

      // ── STEP 6: Sorts ─────────────────────────────────────
      for (const s of pack.sorts ?? []) {
        // Resolve zone (create on-the-fly if not already cached)
        let zoneId: number | null = null;
        if (s.zone) {
          const key = `${s.zone.type}_${s.zone.taille}`;
          if (cache.zones.has(key)) {
            zoneId = cache.zones.get(key)!;
          } else {
            const newZone = await tx.zone.create({
              data: { nom: s.zone.nom ?? `${s.zone.type} ${s.zone.taille}`, type: s.zone.type as any, taille: s.zone.taille },
              select: { id: true },
            });
            cache.zones.set(key, newZone.id);
            zoneId = newZone.id;
          }
        }

        // Resolve raceId
        let raceId: number | null = null;
        if (s.race) {
          if (!cache.races.has(s.race)) {
            throw new ImportRefError(`Sort '${s.nom}' : race '${s.race}' introuvable en BDD ni dans le pack`);
          }
          raceId = cache.races.get(s.race)!;
        }

        // Resolve invocationTemplateId
        let invocationTemplateId: number | null = null;
        if (s.invocationTemplate) {
          if (!cache.monstres.has(s.invocationTemplate)) {
            throw new ImportRefError(`Sort '${s.nom}' : invocationTemplate '${s.invocationTemplate}' introuvable en BDD ni dans le pack`);
          }
          invocationTemplateId = cache.monstres.get(s.invocationTemplate)!;
        }

        const data = {
          type: s.type as any,
          statUtilisee: s.statUtilisee as any,
          niveauApprentissage: s.niveauRequis,
          coutPA: s.coutPA,
          porteeMin: s.porteeMin,
          porteeMax: s.porteeMax,
          ligneDeVue: s.ligneDeVue,
          degatsMin: s.degatsMin,
          degatsMax: s.degatsMax,
          degatsCritMin: s.degatsCritMin,
          degatsCritMax: s.degatsCritMax,
          chanceCritBase: s.chanceCritBase,
          cooldown: s.cooldown,
          estSoin: s.estSoin,
          tauxEchec: s.tauxEchec,
          estInvocation: s.estInvocation,
          estVolDeVie: s.estVolDeVie,
          porteeModifiable: s.porteeModifiable,
          ligneDirecte: s.ligneDirecte,
          estGlyphe: s.estGlyphe,
          estPiege: s.estPiege,
          poseDuree: s.poseDuree ?? null,
          estTeleportation: s.estTeleportation,
          estSelfBuff: s.estSelfBuff,
          coefficient: s.coefficient,
          zoneId,
          raceId,
          invocationTemplateId,
        };
        const existing = await tx.sort.findFirst({ where: { nom: s.nom }, select: { id: true } });
        let sortId: number;
        if (existing) {
          await tx.sort.update({ where: { id: existing.id }, data });
          sortId = existing.id;
        } else {
          const created = await tx.sort.create({ data: { nom: s.nom, ...data }, select: { id: true } });
          sortId = created.id;
        }
        cache.sorts.set(s.nom, sortId);
        counters.sorts++;
      }

      // ── STEP 7: SortEffets ────────────────────────────────
      for (const s of pack.sorts ?? []) {
        if (!s.effets?.length) continue;
        const sortId = cache.sorts.get(s.nom)!;
        for (const se of s.effets) {
          if (!cache.effets.has(se.effet)) {
            throw new ImportRefError(`Sort '${s.nom}' : effet '${se.effet}' introuvable en BDD ni dans le pack`);
          }
          const effetId = cache.effets.get(se.effet)!;
          await tx.sortEffet.upsert({
            where: { sortId_effetId: { sortId, effetId } },
            update: { chanceDeclenchement: se.chanceDeclenchement, surCible: se.surCible },
            create: { sortId, effetId, chanceDeclenchement: se.chanceDeclenchement, surCible: se.surCible },
          });
          counters.sortEffets++;
        }
      }

      // ── STEP 8: MonstreSorts ──────────────────────────────
      for (const m of pack.monstres ?? []) {
        if (!m.sorts?.length) continue;
        const monstreId = cache.monstres.get(m.nom)!;
        for (const ms of m.sorts) {
          if (!cache.sorts.has(ms.sort)) {
            throw new ImportRefError(`Monstre '${m.nom}' : sort '${ms.sort}' introuvable en BDD ni dans le pack`);
          }
          const sortId = cache.sorts.get(ms.sort)!;
          await tx.monstreSort.upsert({
            where: { monstreId_sortId: { monstreId, sortId } },
            update: { priorite: ms.priorite },
            create: { monstreId, sortId, priorite: ms.priorite },
          });
          counters.monstreSorts++;
        }
      }

      // ── STEP 9: Equipements (before drops, to allow equip drop refs) ──
      for (const e of pack.equipements ?? []) {
        const data = {
          slot: e.slot as any,
          niveauMinimum: e.niveauRequis,
          poids: e.poids,
          bonusForce: e.bonusForce,
          bonusIntelligence: e.bonusIntelligence,
          bonusDexterite: e.bonusDexterite,
          bonusAgilite: e.bonusAgilite,
          bonusVie: e.bonusVie,
          bonusChance: e.bonusChance,
          bonusPA: e.bonusPA,
          bonusPM: e.bonusPM,
          bonusPO: e.bonusPO,
          bonusForceMax: e.bonusForceMax ?? null,
          bonusIntelligenceMax: e.bonusIntelligenceMax ?? null,
          bonusDexteriteMax: e.bonusDexteriteMax ?? null,
          bonusAgiliteMax: e.bonusAgiliteMax ?? null,
          bonusVieMax: e.bonusVieMax ?? null,
          bonusChanceMax: e.bonusChanceMax ?? null,
          bonusPAMax: e.bonusPAMax ?? null,
          bonusPMMax: e.bonusPMMax ?? null,
          bonusPOMax: e.bonusPOMax ?? null,
          bonusCritiqueMax: e.bonusCritiqueMax ?? null,
          resistanceForce: e.resistanceForce,
          resistanceIntelligence: e.resistanceIntelligence,
          resistanceDexterite: e.resistanceDexterite,
          resistanceAgilite: e.resistanceAgilite,
          resistanceForceMax: e.resistanceForceMax ?? null,
          resistanceIntelligenceMax: e.resistanceIntelligenceMax ?? null,
          resistanceDexteriteMax: e.resistanceDexteriteMax ?? null,
          resistanceAgiliteMax: e.resistanceAgiliteMax ?? null,
          bonusDommages: e.bonusDommages,
          bonusDommagesMax: e.bonusDommagesMax ?? null,
          bonusSoins: e.bonusSoins,
          bonusSoinsMax: e.bonusSoinsMax ?? null,
          degatsMin: e.degatsMin ?? null,
          degatsMax: e.degatsMax ?? null,
          chanceCritBase: e.chanceCritBase ?? null,
          bonusCrit: e.bonusCrit ?? null,
          coutPA: e.coutPA ?? null,
          porteeMin: e.porteeMin ?? null,
          porteeMax: e.porteeMax ?? null,
          ligneDeVue: e.ligneDeVue ?? null,
          statUtilisee: (e.statUtilisee as any) ?? null,
          cooldown: e.cooldown ?? null,
          tauxEchec: e.tauxEchec ?? null,
          estVolDeVie: e.estVolDeVie,
        };
        const existing = await tx.equipement.findFirst({ where: { nom: e.nom }, select: { id: true } });
        let equipementId: number;
        if (existing) {
          await tx.equipement.update({ where: { id: existing.id }, data });
          equipementId = existing.id;
        } else {
          const created = await tx.equipement.create({ data: { nom: e.nom, ...data }, select: { id: true } });
          equipementId = created.id;
        }
        cache.equipements.set(e.nom, equipementId);
        counters.equipements++;
      }

      // ── STEP 10: LigneDegatsArme ──────────────────────────
      for (const e of pack.equipements ?? []) {
        if (!e.lignes?.length) continue;
        const equipementId = cache.equipements.get(e.nom)!;
        for (const ligne of e.lignes) {
          await tx.ligneDegatsArme.upsert({
            where: { equipementId_ordre: { equipementId, ordre: ligne.ordre } },
            update: {
              degatsMin: ligne.degatsMin,
              degatsMax: ligne.degatsMax,
              statUtilisee: ligne.statUtilisee as any,
              estVolDeVie: ligne.estVolDeVie,
              estSoin: ligne.estSoin,
            },
            create: {
              equipementId,
              ordre: ligne.ordre,
              degatsMin: ligne.degatsMin,
              degatsMax: ligne.degatsMax,
              statUtilisee: ligne.statUtilisee as any,
              estVolDeVie: ligne.estVolDeVie,
              estSoin: ligne.estSoin,
            },
          });
          counters.lignesDegats++;
        }
      }

      // ── STEP 11: MonstreDrops (after equipements) ─────────
      // Only processed when the 'drops' key is present in the object.
      // Absent = leave existing drops untouched. [] = clear all drops.
      for (const m of pack.monstres ?? []) {
        if (m.drops === undefined) continue;
        const monstreId = cache.monstres.get(m.nom)!;
        await tx.monstreDrop.deleteMany({ where: { monstreId } });
        for (const drop of m.drops) {
          if ('ressource' in drop) {
            if (!cache.ressources.has(drop.ressource)) {
              throw new ImportRefError(`Monstre '${m.nom}' : ressource '${drop.ressource}' introuvable en BDD ni dans le pack`);
            }
            await tx.monstreDrop.create({
              data: {
                monstreId,
                ressourceId: cache.ressources.get(drop.ressource)!,
                tauxDrop: drop.tauxDrop,
                quantiteMin: drop.quantiteMin,
                quantiteMax: drop.quantiteMax,
              },
            });
          } else {
            if (!cache.equipements.has(drop.equipement)) {
              throw new ImportRefError(`Monstre '${m.nom}' : équipement '${drop.equipement}' introuvable en BDD ni dans le pack`);
            }
            await tx.monstreDrop.create({
              data: {
                monstreId,
                equipementId: cache.equipements.get(drop.equipement)!,
                tauxDrop: drop.tauxDrop,
                quantiteMin: drop.quantiteMin,
                quantiteMax: drop.quantiteMax,
              },
            });
          }
          counters.monstreDrops++;
        }
      }

      // ── STEP 12 & 13: Recettes + Ingrédients ─────────────
      for (const r of pack.recettes ?? []) {
        if (!cache.equipements.has(r.equipement)) {
          throw new ImportRefError(`Recette '${r.nom}' : équipement '${r.equipement}' introuvable en BDD ni dans le pack`);
        }
        const equipementId = cache.equipements.get(r.equipement)!;
        const recette = await tx.recette.upsert({
          where: { nom: r.nom },
          update: { equipementId, niveauMinimum: r.niveauMinimum, coutOr: r.coutOr },
          create: { nom: r.nom, equipementId, niveauMinimum: r.niveauMinimum, coutOr: r.coutOr },
          select: { id: true },
        });
        counters.recettes++;

        // Replace all ingredients (deleteMany + createMany for simplicity)
        await tx.recetteIngredient.deleteMany({ where: { recetteId: recette.id } });
        for (const ing of r.ingredients) {
          if (!cache.ressources.has(ing.ressource)) {
            throw new ImportRefError(`Recette '${r.nom}' : ressource '${ing.ressource}' introuvable en BDD ni dans le pack`);
          }
          await tx.recetteIngredient.create({
            data: {
              recetteId: recette.id,
              ressourceId: cache.ressources.get(ing.ressource)!,
              quantite: ing.quantite,
            },
          });
          counters.recetteIngredients++;
        }
      }
    }, { timeout: 30000 });

    res.json({ success: true, imported: counters });
  } catch (err: any) {
    if (err?.name === 'ImportRefError') {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Import failed — database rolled back', details: err?.message });
    }
  }
});

export default router;
