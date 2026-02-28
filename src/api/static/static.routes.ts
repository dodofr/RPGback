import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { z } from 'zod';

// ============================================================
// Zod Schemas
// ============================================================

const StatTypeEnum = z.enum(['FORCE', 'INTELLIGENCE', 'DEXTERITE', 'AGILITE', 'VIE', 'CHANCE', 'PA', 'PM', 'PO', 'DOMMAGES', 'SOINS']);
const SortTypeEnum = z.enum(['ARME', 'SORT']);
const SlotTypeEnum = z.enum(['ARME', 'COIFFE', 'AMULETTE', 'BOUCLIER', 'HAUT', 'BAS', 'ANNEAU1', 'ANNEAU2', 'FAMILIER']);
const EffetTypeEnum = z.enum(['BUFF', 'DEBUFF', 'DISPEL', 'POUSSEE', 'ATTIRANCE', 'POISON', 'BOUCLIER', 'RESISTANCE']);
const ZoneTypeEnum = z.enum(['CASE', 'CROIX', 'LIGNE', 'CONE', 'CERCLE', 'LIGNE_PERPENDICULAIRE', 'DIAGONALE', 'CARRE', 'ANNEAU', 'CONE_INVERSE']);

// Race schemas
const createRaceSchema = z.object({
  nom: z.string().min(1),
  bonusForce: z.number().int().default(0),
  bonusIntelligence: z.number().int().default(0),
  bonusDexterite: z.number().int().default(0),
  bonusAgilite: z.number().int().default(0),
  bonusVie: z.number().int().default(0),
  bonusChance: z.number().int().default(0),
});

const updateRaceSchema = createRaceSchema.partial();

// Sort schemas
const createSortSchema = z.object({
  nom: z.string().min(1),
  type: SortTypeEnum,
  statUtilisee: StatTypeEnum,
  coutPA: z.number().int().min(0),
  porteeMin: z.number().int().min(0),
  porteeMax: z.number().int().min(0),
  ligneDeVue: z.boolean().default(true),
  degatsMin: z.number().int().min(0),
  degatsMax: z.number().int().min(0),
  degatsCritMin: z.number().int().min(0),
  degatsCritMax: z.number().int().min(0),
  chanceCritBase: z.number().min(0).max(1).default(0.01),
  cooldown: z.number().int().min(0).default(0),
  estSoin: z.boolean().default(false),
  tauxEchec: z.number().min(0).max(1).default(0),
  niveauApprentissage: z.number().int().min(1).default(1),
  zoneId: z.number().int().nullable().optional(),
  raceId: z.number().int().nullable().optional(),
  estInvocation: z.boolean().default(false),
  estVolDeVie: z.boolean().default(false),
  invocationTemplateId: z.number().int().nullable().optional(),
  porteeModifiable: z.boolean().default(true),
  ligneDirecte: z.boolean().default(false),
  estGlyphe: z.boolean().default(false),
  estPiege: z.boolean().default(false),
  poseDuree: z.number().int().min(1).nullable().optional(),
  estTeleportation: z.boolean().default(false),
  coefficient: z.number().min(0).max(10).default(1.0),
});

const updateSortSchema = createSortSchema.partial();

// Equipement schemas
const createEquipementSchema = z.object({
  nom: z.string().min(1),
  slot: SlotTypeEnum,
  niveauMinimum: z.number().int().min(1).default(1),
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
  degatsMin: z.number().int().nullable().optional(),
  degatsMax: z.number().int().nullable().optional(),
  chanceCritBase: z.number().nullable().optional(),
  coutPA: z.number().int().nullable().optional(),
  porteeMin: z.number().int().nullable().optional(),
  porteeMax: z.number().int().nullable().optional(),
  ligneDeVue: z.boolean().nullable().optional(),
  zoneId: z.number().int().nullable().optional(),
  statUtilisee: StatTypeEnum.nullable().optional(),
  cooldown: z.number().int().nullable().optional(),
  tauxEchec: z.number().nullable().optional(),
  estVolDeVie: z.boolean().default(false),
  bonusCrit: z.number().int().nullable().optional(),
  bonusDommages: z.number().int().min(0).optional(),
  bonusDommagesMax: z.number().int().min(0).nullable().optional(),
  bonusSoins: z.number().int().min(0).optional(),
  bonusSoinsMax: z.number().int().min(0).nullable().optional(),
  panoplieId: z.number().int().nullable().optional(),
});

const updateEquipementSchema = createEquipementSchema.partial();

// Effet schemas
const createEffetSchema = z.object({
  nom: z.string().min(1),
  type: EffetTypeEnum,
  statCiblee: StatTypeEnum,
  valeur: z.number().int(),
  valeurMin: z.number().int().nullable().optional(),
  duree: z.number().int().min(0),
  cumulable: z.boolean().optional(),
});

const updateEffetSchema = createEffetSchema.partial();

// Zone schemas
const createZoneSchema = z.object({
  nom: z.string().min(1),
  type: ZoneTypeEnum,
  taille: z.number().int().min(0),
});

const updateZoneSchema = createZoneSchema.partial();

// ============================================================
// Races routes
// ============================================================
const racesRouter = Router();

racesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const races = await prisma.race.findMany({
      include: {
        sorts: {
          include: {
            zone: true,
          },
          orderBy: { niveauApprentissage: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
    res.json(races);
  } catch (error) {
    next(error);
  }
});

racesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const race = await prisma.race.findUnique({
      where: { id },
      include: {
        sorts: {
          include: {
            zone: true,
          },
          orderBy: { niveauApprentissage: 'asc' },
        },
      },
    });

    if (!race) {
      res.status(404).json({ error: 'Race not found' });
      return;
    }

    res.json(race);
  } catch (error) {
    next(error);
  }
});

racesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createRaceSchema.parse(req.body);

    const race = await prisma.race.create({
      data,
      include: {
        sorts: {
          include: {
            zone: true,
          },
          orderBy: { niveauApprentissage: 'asc' },
        },
      },
    });

    res.status(201).json(race);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

racesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const data = updateRaceSchema.parse(req.body);

    const existing = await prisma.race.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Race not found' });
      return;
    }

    const race = await prisma.race.update({
      where: { id },
      data,
      include: {
        sorts: {
          include: {
            zone: true,
          },
          orderBy: { niveauApprentissage: 'asc' },
        },
      },
    });

    res.json(race);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

racesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const existing = await prisma.race.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Race not found' });
      return;
    }

    // Get all sorts belonging to this race
    const raceSorts = await prisma.sort.findMany({ where: { raceId: id }, select: { id: true } });
    const raceSortIds = raceSorts.map(s => s.id);

    if (raceSortIds.length > 0) {
      // Delete PersonnageSort entries for race sorts
      await prisma.personnageSort.deleteMany({ where: { sortId: { in: raceSortIds } } });
      // Delete SortEffet entries for race sorts
      await prisma.sortEffet.deleteMany({ where: { sortId: { in: raceSortIds } } });
      // Delete SortCooldown entries for race sorts
      await prisma.sortCooldown.deleteMany({ where: { sortId: { in: raceSortIds } } });
      // Delete MonstreSort entries for race sorts
      await prisma.monstreSort.deleteMany({ where: { sortId: { in: raceSortIds } } });
      // Delete the sorts themselves
      await prisma.sort.deleteMany({ where: { raceId: id } });
    }

    await prisma.race.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Spells routes
// ============================================================
const spellsRouter = Router();

spellsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const spells = await prisma.sort.findMany({
      include: {
        zone: true,
        race: true,
        effets: {
          include: {
            effet: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    res.json(spells);
  } catch (error) {
    next(error);
  }
});

spellsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const spell = await prisma.sort.findUnique({
      where: { id },
      include: {
        zone: true,
        race: true,
        effets: {
          include: {
            effet: true,
          },
        },
      },
    });

    if (!spell) {
      res.status(404).json({ error: 'Spell not found' });
      return;
    }

    res.json(spell);
  } catch (error) {
    next(error);
  }
});

spellsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSortSchema.parse(req.body);

    const spell = await prisma.sort.create({
      data,
      include: {
        zone: true,
        race: true,
      },
    });

    res.status(201).json(spell);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

spellsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const data = updateSortSchema.parse(req.body);

    const existing = await prisma.sort.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Spell not found' });
      return;
    }

    const spell = await prisma.sort.update({
      where: { id },
      data,
      include: {
        zone: true,
        race: true,
        effets: {
          include: {
            effet: true,
          },
        },
      },
    });

    res.json(spell);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

spellsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const existing = await prisma.sort.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Spell not found' });
      return;
    }

    // Clean up related data
    await prisma.sortEffet.deleteMany({ where: { sortId: id } });
    await prisma.personnageSort.deleteMany({ where: { sortId: id } });
    await prisma.sortCooldown.deleteMany({ where: { sortId: id } });
    await prisma.monstreSort.deleteMany({ where: { sortId: id } });

    await prisma.sort.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/spells/:id/effects - Add effect to spell
spellsRouter.post('/:id/effects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sortId = parseInt(req.params.id, 10);
    if (isNaN(sortId)) {
      res.status(400).json({ error: 'Invalid spell ID' });
      return;
    }

    const schema = z.object({
      effetId: z.number().int().positive(),
      chanceDeclenchement: z.number().min(0).max(1).default(1.0),
      surCible: z.boolean().default(true),
    });
    const data = schema.parse(req.body);

    const sortEffet = await prisma.sortEffet.create({
      data: {
        sortId,
        effetId: data.effetId,
        chanceDeclenchement: data.chanceDeclenchement,
        surCible: data.surCible,
      },
      include: { sort: true, effet: true },
    });
    res.status(201).json(sortEffet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

// DELETE /api/spells/:id/effects/:effetId - Remove effect from spell
spellsRouter.delete('/:id/effects/:effetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sortId = parseInt(req.params.id, 10);
    const effetId = parseInt(req.params.effetId, 10);
    if (isNaN(sortId) || isNaN(effetId)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    await prisma.sortEffet.delete({
      where: { sortId_effetId: { sortId, effetId } },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Equipment routes
// ============================================================
const equipmentRouter = Router();

equipmentRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.equipement.findMany({
      orderBy: { id: 'asc' },
      include: { lignesDegats: { orderBy: { ordre: 'asc' } } },
    });
    res.json(equipment);
  } catch (error) {
    next(error);
  }
});

equipmentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const item = await prisma.equipement.findUnique({
      where: { id },
      include: { lignesDegats: { orderBy: { ordre: 'asc' } } },
    });

    if (!item) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

equipmentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createEquipementSchema.parse(req.body);

    const item = await prisma.equipement.create({ data });

    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

equipmentRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const data = updateEquipementSchema.parse(req.body);

    const existing = await prisma.equipement.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    const item = await prisma.equipement.update({
      where: { id },
      data,
    });

    res.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

equipmentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const existing = await prisma.equipement.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    // Clean up damage lines
    await prisma.ligneDegatsArme.deleteMany({ where: { equipementId: id } });

    await prisma.equipement.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/equipment/:id/lignes - Add damage line to weapon
equipmentRouter.post('/:id/lignes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const equipementId = parseInt(req.params.id, 10);
    if (isNaN(equipementId)) {
      res.status(400).json({ error: 'Invalid equipment ID' });
      return;
    }

    const schema = z.object({
      ordre: z.number().int().min(1),
      degatsMin: z.number().int().min(0),
      degatsMax: z.number().int().min(0),
      statUtilisee: StatTypeEnum,
      estVolDeVie: z.boolean().default(false),
      estSoin: z.boolean().default(false),
    });
    const data = schema.parse(req.body);

    const ligne = await prisma.ligneDegatsArme.create({
      data: { equipementId, ...data },
    });
    res.status(201).json(ligne);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

// PATCH /api/equipment/:id/lignes/:ligneId - Update a damage line
equipmentRouter.patch('/:id/lignes/:ligneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ligneId = parseInt(req.params.ligneId, 10);
    if (isNaN(ligneId)) {
      res.status(400).json({ error: 'Invalid line ID' });
      return;
    }

    const schema = z.object({
      ordre: z.number().int().min(1).optional(),
      degatsMin: z.number().int().min(0).optional(),
      degatsMax: z.number().int().min(0).optional(),
      statUtilisee: StatTypeEnum.optional(),
      estVolDeVie: z.boolean().optional(),
      estSoin: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    const ligne = await prisma.ligneDegatsArme.update({
      where: { id: ligneId },
      data,
    });
    res.json(ligne);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

// DELETE /api/equipment/:id/lignes/:ligneId - Remove a damage line
equipmentRouter.delete('/:id/lignes/:ligneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ligneId = parseInt(req.params.ligneId, 10);
    if (isNaN(ligneId)) {
      res.status(400).json({ error: 'Invalid line ID' });
      return;
    }

    await prisma.ligneDegatsArme.delete({ where: { id: ligneId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Effects routes
// ============================================================
const effectsRouter = Router();

effectsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const effects = await prisma.effet.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(effects);
  } catch (error) {
    next(error);
  }
});

effectsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const effect = await prisma.effet.findUnique({
      where: { id },
    });

    if (!effect) {
      res.status(404).json({ error: 'Effect not found' });
      return;
    }

    res.json(effect);
  } catch (error) {
    next(error);
  }
});

effectsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createEffetSchema.parse(req.body);

    const effect = await prisma.effet.create({ data });

    res.status(201).json(effect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

effectsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const data = updateEffetSchema.parse(req.body);

    const existing = await prisma.effet.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Effect not found' });
      return;
    }

    const effect = await prisma.effet.update({
      where: { id },
      data,
    });

    res.json(effect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

effectsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const existing = await prisma.effet.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Effect not found' });
      return;
    }

    // Clean up related data
    await prisma.sortEffet.deleteMany({ where: { effetId: id } });
    await prisma.effetActif.deleteMany({ where: { effetId: id } });

    await prisma.effet.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Zones routes
// ============================================================
const zonesRouter = Router();

zonesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(zones);
  } catch (error) {
    next(error);
  }
});

zonesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const zone = await prisma.zone.findUnique({
      where: { id },
    });

    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    res.json(zone);
  } catch (error) {
    next(error);
  }
});

zonesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createZoneSchema.parse(req.body);

    const zone = await prisma.zone.create({ data });

    res.status(201).json(zone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

zonesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const data = updateZoneSchema.parse(req.body);

    const existing = await prisma.zone.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    const zone = await prisma.zone.update({
      where: { id },
      data,
    });

    res.json(zone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    next(error);
  }
});

zonesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const existing = await prisma.zone.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    // Nullify zoneId on sorts and equipements that reference this zone
    await prisma.sort.updateMany({ where: { zoneId: id }, data: { zoneId: null } });
    await prisma.equipement.updateMany({ where: { zoneId: id }, data: { zoneId: null } });

    await prisma.zone.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Resources routes
// ============================================================
const resourcesRouter = Router();

resourcesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const resources = await prisma.ressource.findMany({ orderBy: { id: 'asc' } });
    res.json(resources);
  } catch (error) { next(error); }
});

resourcesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const resource = await prisma.ressource.findUnique({ where: { id } });
    if (!resource) { res.status(404).json({ error: 'Resource not found' }); return; }
    res.json(resource);
  } catch (error) { next(error); }
});

resourcesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nom: z.string().min(1),
      description: z.string().nullable().optional(),
      poids: z.number().int().min(0).default(1),
      estPremium: z.boolean().default(false),
    });
    const data = schema.parse(req.body);
    const resource = await prisma.ressource.create({ data });
    res.status(201).json(resource);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

resourcesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      poids: z.number().int().min(0).optional(),
      estPremium: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.ressource.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Resource not found' }); return; }
    const resource = await prisma.ressource.update({ where: { id }, data });
    res.json(resource);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

resourcesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const existing = await prisma.ressource.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Resource not found' }); return; }
    // Clean up relations
    await prisma.inventaireRessource.deleteMany({ where: { ressourceId: id } });
    await prisma.recetteIngredient.deleteMany({ where: { ressourceId: id } });
    await prisma.monstreDrop.deleteMany({ where: { ressourceId: id } });
    await prisma.ressource.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

// ============================================================
// Sets (Panoplies) routes
// ============================================================
const setsRouter = Router();

setsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sets = await prisma.panoplie.findMany({
      include: { equipements: true, bonus: { orderBy: { nombrePieces: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    res.json(sets);
  } catch (error) { next(error); }
});

setsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const set = await prisma.panoplie.findUnique({
      where: { id },
      include: { equipements: true, bonus: { orderBy: { nombrePieces: 'asc' } } },
    });
    if (!set) { res.status(404).json({ error: 'Set not found' }); return; }
    res.json(set);
  } catch (error) { next(error); }
});

setsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nom: z.string().min(1),
      description: z.string().nullable().optional(),
    });
    const data = schema.parse(req.body);
    const set = await prisma.panoplie.create({ data });
    res.status(201).json(set);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

setsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.panoplie.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Set not found' }); return; }
    const set = await prisma.panoplie.update({ where: { id }, data });
    res.json(set);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

setsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const existing = await prisma.panoplie.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Set not found' }); return; }
    // Nullify panoplieId on equipments
    await prisma.equipement.updateMany({ where: { panoplieId: id }, data: { panoplieId: null } });
    await prisma.panoplieBonus.deleteMany({ where: { panoplieId: id } });
    await prisma.panoplie.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST /api/sets/:id/bonuses
setsRouter.post('/:id/bonuses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const panoplieId = parseInt(req.params.id, 10);
    if (isNaN(panoplieId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nombrePieces: z.number().int().min(2),
      bonusForce: z.number().int().default(0),
      bonusIntelligence: z.number().int().default(0),
      bonusDexterite: z.number().int().default(0),
      bonusAgilite: z.number().int().default(0),
      bonusVie: z.number().int().default(0),
      bonusChance: z.number().int().default(0),
      bonusPA: z.number().int().default(0),
      bonusPM: z.number().int().default(0),
      bonusPO: z.number().int().default(0),
      bonusCritique: z.number().int().default(0),
    });
    const data = schema.parse(req.body);
    const bonus = await prisma.panoplieBonus.create({ data: { panoplieId, ...data } });
    res.status(201).json(bonus);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/sets/:id/bonuses/:bonusId
setsRouter.patch('/:id/bonuses/:bonusId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bonusId = parseInt(req.params.bonusId, 10);
    if (isNaN(bonusId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nombrePieces: z.number().int().min(2).optional(),
      bonusForce: z.number().int().optional(),
      bonusIntelligence: z.number().int().optional(),
      bonusDexterite: z.number().int().optional(),
      bonusAgilite: z.number().int().optional(),
      bonusVie: z.number().int().optional(),
      bonusChance: z.number().int().optional(),
      bonusPA: z.number().int().optional(),
      bonusPM: z.number().int().optional(),
      bonusPO: z.number().int().optional(),
      bonusCritique: z.number().int().optional(),
    });
    const data = schema.parse(req.body);
    const bonus = await prisma.panoplieBonus.update({ where: { id: bonusId }, data });
    res.json(bonus);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/sets/:id/bonuses/:bonusId
setsRouter.delete('/:id/bonuses/:bonusId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bonusId = parseInt(req.params.bonusId, 10);
    if (isNaN(bonusId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await prisma.panoplieBonus.delete({ where: { id: bonusId } });
    res.status(204).send();
  } catch (error) { next(error); }
});

// ============================================================
// Recipes (admin) routes
// ============================================================
const recipesRouter = Router();

recipesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const recipes = await prisma.recette.findMany({
      include: { equipement: true, ingredients: { include: { ressource: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(recipes);
  } catch (error) { next(error); }
});

recipesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const recipe = await prisma.recette.findUnique({
      where: { id },
      include: { equipement: true, ingredients: { include: { ressource: true } } },
    });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }
    res.json(recipe);
  } catch (error) { next(error); }
});

recipesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nom: z.string().min(1),
      description: z.string().nullable().optional(),
      equipementId: z.number().int().positive(),
      niveauMinimum: z.number().int().min(1).default(1),
      coutOr: z.number().int().min(0).default(0),
    });
    const data = schema.parse(req.body);
    const recipe = await prisma.recette.create({ data, include: { equipement: true } });
    res.status(201).json(recipe);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

recipesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      equipementId: z.number().int().positive().optional(),
      niveauMinimum: z.number().int().min(1).optional(),
      coutOr: z.number().int().min(0).optional(),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.recette.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Recipe not found' }); return; }
    const recipe = await prisma.recette.update({ where: { id }, data });
    res.json(recipe);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

recipesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const existing = await prisma.recette.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Recipe not found' }); return; }
    await prisma.recetteIngredient.deleteMany({ where: { recetteId: id } });
    await prisma.recette.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST /api/recipes/:id/ingredients
recipesRouter.post('/:id/ingredients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recetteId = parseInt(req.params.id, 10);
    if (isNaN(recetteId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      ressourceId: z.number().int().positive(),
      quantite: z.number().int().min(1).default(1),
    });
    const data = schema.parse(req.body);
    const ingredient = await prisma.recetteIngredient.create({
      data: { recetteId, ...data },
      include: { ressource: true },
    });
    res.status(201).json(ingredient);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/recipes/:id/ingredients/:ingredientId
recipesRouter.delete('/:id/ingredients/:ingredientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId, 10);
    if (isNaN(ingredientId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await prisma.recetteIngredient.delete({ where: { id: ingredientId } });
    res.status(204).send();
  } catch (error) { next(error); }
});

// ============================================================
// Compétences Passives routes
// ============================================================
const passivesRouter = Router();

const createPassiveSchema = z.object({
  nom: z.string().min(1),
  description: z.string().nullable().optional(),
  niveauDeblocage: z.number().int().min(1),
  bonusForce: z.number().int().default(0),
  bonusIntelligence: z.number().int().default(0),
  bonusDexterite: z.number().int().default(0),
  bonusAgilite: z.number().int().default(0),
  bonusVie: z.number().int().default(0),
  bonusChance: z.number().int().default(0),
  bonusPa: z.number().int().default(0),
  bonusPm: z.number().int().default(0),
  bonusPo: z.number().int().default(0),
  bonusCritique: z.number().int().default(0),
  bonusDommages: z.number().int().default(0),
  bonusSoins: z.number().int().default(0),
});

const updatePassiveSchema = createPassiveSchema.partial();

passivesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const passives = await prisma.competencePassive.findMany({ orderBy: { niveauDeblocage: 'asc' } });
    res.json(passives);
  } catch (error) { next(error); }
});

passivesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const passive = await prisma.competencePassive.findUnique({ where: { id } });
    if (!passive) { res.status(404).json({ error: 'Passive skill not found' }); return; }
    res.json(passive);
  } catch (error) { next(error); }
});

passivesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createPassiveSchema.parse(req.body);
    const passive = await prisma.competencePassive.create({ data });
    res.status(201).json(passive);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

passivesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = updatePassiveSchema.parse(req.body);
    const existing = await prisma.competencePassive.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Passive skill not found' }); return; }
    const passive = await prisma.competencePassive.update({ where: { id }, data });
    res.json(passive);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

passivesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const existing = await prisma.competencePassive.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Passive skill not found' }); return; }
    await prisma.competencePassive.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

export default {
  races: racesRouter,
  spells: spellsRouter,
  equipment: equipmentRouter,
  effects: effectsRouter,
  zones: zonesRouter,
  resources: resourcesRouter,
  sets: setsRouter,
  recipes: recipesRouter,
  passives: passivesRouter,
};
