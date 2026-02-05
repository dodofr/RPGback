import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';

// Races routes
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

// Spells routes
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

// Equipment routes
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

// Effects routes (bonus)
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

// Zones routes (bonus)
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

export default {
  races: racesRouter,
  spells: spellsRouter,
  equipment: equipmentRouter,
  effects: effectsRouter,
  zones: zonesRouter,
};
