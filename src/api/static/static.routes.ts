import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { z } from 'zod';

// ============================================================
// Zod Schemas
// ============================================================

const StatTypeEnum = z.enum(['FORCE', 'INTELLIGENCE', 'DEXTERITE', 'AGILITE', 'VIE', 'CHANCE']);
const SortTypeEnum = z.enum(['ARME', 'SORT']);
const SlotTypeEnum = z.enum(['ARME', 'COIFFE', 'AMULETTE', 'BOUCLIER', 'HAUT', 'BAS', 'ANNEAU1', 'ANNEAU2', 'FAMILIER']);
const EffetTypeEnum = z.enum(['BUFF', 'DEBUFF']);
const ZoneTypeEnum = z.enum(['CASE', 'CROIX', 'LIGNE', 'CONE', 'CERCLE']);

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
  estDispel: z.boolean().default(false),
  tauxEchec: z.number().min(0).max(1).default(0),
  niveauApprentissage: z.number().int().min(1).default(1),
  zoneId: z.number().int().nullable().optional(),
  raceId: z.number().int().nullable().optional(),
  estInvocation: z.boolean().default(false),
  invocationTemplateId: z.number().int().nullable().optional(),
});

const updateSortSchema = createSortSchema.partial();

// Equipement schemas
const createEquipementSchema = z.object({
  nom: z.string().min(1),
  slot: SlotTypeEnum,
  niveauMinimum: z.number().int().min(1).default(1),
  bonusForce: z.number().int().default(0),
  bonusIntelligence: z.number().int().default(0),
  bonusDexterite: z.number().int().default(0),
  bonusAgilite: z.number().int().default(0),
  bonusVie: z.number().int().default(0),
  bonusChance: z.number().int().default(0),
  bonusPA: z.number().int().default(0),
  bonusPM: z.number().int().default(0),
  bonusPO: z.number().int().default(0),
  degatsMin: z.number().int().nullable().optional(),
  degatsMax: z.number().int().nullable().optional(),
  degatsCritMin: z.number().int().nullable().optional(),
  degatsCritMax: z.number().int().nullable().optional(),
  chanceCritBase: z.number().nullable().optional(),
  coutPA: z.number().int().nullable().optional(),
  porteeMin: z.number().int().nullable().optional(),
  porteeMax: z.number().int().nullable().optional(),
  ligneDeVue: z.boolean().nullable().optional(),
  zoneId: z.number().int().nullable().optional(),
  statUtilisee: StatTypeEnum.nullable().optional(),
  cooldown: z.number().int().nullable().optional(),
  tauxEchec: z.number().nullable().optional(),
});

const updateEquipementSchema = createEquipementSchema.partial();

// Effet schemas
const createEffetSchema = z.object({
  nom: z.string().min(1),
  type: EffetTypeEnum,
  statCiblee: StatTypeEnum,
  valeur: z.number().int(),
  duree: z.number().int().min(1),
});

const updateEffetSchema = createEffetSchema.partial();

// Zone schemas
const createZoneSchema = z.object({
  nom: z.string().min(1),
  type: ZoneTypeEnum,
  taille: z.number().int().min(1),
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

    await prisma.equipement.delete({ where: { id } });

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

export default {
  races: racesRouter,
  spells: spellsRouter,
  equipment: equipmentRouter,
  effects: effectsRouter,
  zones: zonesRouter,
};
