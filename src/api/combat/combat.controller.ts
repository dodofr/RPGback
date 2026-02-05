import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { combatService } from '../../services/combat/combat.service';

const monsterSchema = z.object({
  nom: z.string().min(1),
  force: z.number().int().min(1),
  intelligence: z.number().int().min(1),
  dexterite: z.number().int().min(1),
  agilite: z.number().int().min(1),
  vie: z.number().int().min(1),
  chance: z.number().int().min(1),
  pvMax: z.number().int().min(1),
  paMax: z.number().int().min(1),
  pmMax: z.number().int().min(1),
});

const createCombatSchema = z.object({
  groupeId: z.number().int().positive(),
  monstres: z.array(monsterSchema).min(1),
  mapId: z.number().int().positive(),
});

const actionSchema = z.object({
  entiteId: z.number().int().positive(),
  sortId: z.number().int().positive().optional(),
  useArme: z.boolean().optional().default(false),
  targetX: z.number().int().min(0),
  targetY: z.number().int().min(0),
}).refine(
  (data) => data.sortId !== undefined || data.useArme === true,
  { message: 'Either sortId or useArme: true must be provided' }
);

const moveSchema = z.object({
  entiteId: z.number().int().positive(),
  targetX: z.number().int().min(0),
  targetY: z.number().int().min(0),
});

const endTurnSchema = z.object({
  entiteId: z.number().int().positive(),
});

export class CombatController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCombatSchema.parse(req.body);
      const combat = await combatService.create(data);
      res.status(201).json(combat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Group not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message === 'Group has no characters' ||
          error.message.startsWith('No combat grid templates configured') ||
          error.message.startsWith('Not enough')
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const state = await combatService.getState(id);
      if (!state) {
        res.status(404).json({ error: 'Combat not found' });
        return;
      }

      res.json(state);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const combats = await combatService.findAll();
      res.json(combats);
    } catch (error) {
      next(error);
    }
  }

  async action(req: Request, res: Response, next: NextFunction) {
    try {
      const combatId = parseInt(req.params.id, 10);
      if (isNaN(combatId)) {
        res.status(400).json({ error: 'Invalid combat ID' });
        return;
      }

      const data = actionSchema.parse(req.body);
      const result = await combatService.action(
        combatId,
        data.entiteId,
        data.sortId ?? null,
        data.targetX,
        data.targetY,
        data.useArme
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async move(req: Request, res: Response, next: NextFunction) {
    try {
      const combatId = parseInt(req.params.id, 10);
      if (isNaN(combatId)) {
        res.status(400).json({ error: 'Invalid combat ID' });
        return;
      }

      const data = moveSchema.parse(req.body);
      const result = await combatService.move(
        combatId,
        data.entiteId,
        data.targetX,
        data.targetY
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async endTurn(req: Request, res: Response, next: NextFunction) {
    try {
      const combatId = parseInt(req.params.id, 10);
      if (isNaN(combatId)) {
        res.status(400).json({ error: 'Invalid combat ID' });
        return;
      }

      const data = endTurnSchema.parse(req.body);
      const result = await combatService.endTurn(combatId, data.entiteId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async flee(req: Request, res: Response, next: NextFunction) {
    try {
      const combatId = parseInt(req.params.id, 10);
      if (isNaN(combatId)) {
        res.status(400).json({ error: 'Invalid combat ID' });
        return;
      }

      const result = await combatService.flee(combatId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const combatController = new CombatController();
