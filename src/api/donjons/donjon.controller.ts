import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { donjonService } from '../../services/donjon.service';

// Validation schemas
const enterDungeonSchema = z.object({
  groupeId: z.number().int().positive(),
  difficulte: z.number().int().refine(val => [4, 6, 8].includes(val), {
    message: 'Difficulty must be 4, 6, or 8',
  }),
});

export class DonjonController {
  /**
   * GET /api/donjons - List all dungeons
   */
  async getAllDonjons(req: Request, res: Response, next: NextFunction) {
    try {
      const donjons = await donjonService.findAll();
      res.json(donjons);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/donjons/:id - Get dungeon details
   */
  async getDonjonById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const donjon = await donjonService.findById(id);
      if (!donjon) {
        res.status(404).json({ error: 'Dungeon not found' });
        return;
      }

      res.json(donjon);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/donjons/:id/enter - Enter a dungeon
   */
  async enterDungeon(req: Request, res: Response, next: NextFunction) {
    try {
      const donjonId = parseInt(req.params.id, 10);
      if (isNaN(donjonId)) {
        res.status(400).json({ error: 'Invalid dungeon ID' });
        return;
      }

      const data = enterDungeonSchema.parse(req.body);
      const result = await donjonService.enterDungeon(donjonId, data.groupeId, data.difficulte);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        const notFoundErrors = ['Group not found', 'Dungeon not found', 'First room not found'];
        if (notFoundErrors.some(msg => error.message.includes(msg))) {
          res.status(404).json({ error: error.message });
          return;
        }
        const badRequestErrors = [
          'Difficulty must be',
          'Group has no characters',
          'Group already has an active dungeon run',
          'Dungeon is not properly configured',
        ];
        if (badRequestErrors.some(msg => error.message.includes(msg))) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * GET /api/donjons/run/:groupeId - Get current dungeon run state
   */
  async getDungeonState(req: Request, res: Response, next: NextFunction) {
    try {
      const groupeId = parseInt(req.params.groupeId, 10);
      if (isNaN(groupeId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const state = await donjonService.getDungeonState(groupeId);
      if (!state) {
        res.status(404).json({ error: 'No active dungeon run found for this group' });
        return;
      }

      res.json(state);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/donjons/run/:groupeId/abandon - Abandon the dungeon
   */
  async abandonDungeon(req: Request, res: Response, next: NextFunction) {
    try {
      const groupeId = parseInt(req.params.groupeId, 10);
      if (isNaN(groupeId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const result = await donjonService.abandonDungeon(groupeId);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No active dungeon run')) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const donjonController = new DonjonController();
