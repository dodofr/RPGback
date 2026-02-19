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
   * POST /api/donjons - Create a dungeon
   */
  async createDonjon(req: Request, res: Response, next: NextFunction) {
    try {
      const createDonjonSchema = z.object({
        nom: z.string().min(2).max(100),
        description: z.string().max(500).optional(),
        regionId: z.number().int().positive(),
        niveauMin: z.number().int().min(1).optional(),
        niveauMax: z.number().int().min(1).optional(),
        bossId: z.number().int().positive(),
        salles: z.array(z.object({
          ordre: z.number().int().min(1).max(4),
          mapId: z.number().int().positive(),
        })).min(4).max(4),
      });
      const data = createDonjonSchema.parse(req.body);
      const donjon = await donjonService.create(data);
      res.status(201).json(donjon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
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
   * PATCH /api/donjons/:id - Update a dungeon
   */
  async updateDonjon(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const updateDonjonSchema = z.object({
        nom: z.string().min(2).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        regionId: z.number().int().positive().optional(),
        niveauMin: z.number().int().min(1).optional(),
        niveauMax: z.number().int().min(1).optional(),
        bossId: z.number().int().positive().optional(),
        salles: z.array(z.object({
          ordre: z.number().int().min(1).max(4),
          mapId: z.number().int().positive(),
        })).min(4).max(4).optional(),
      });
      const data = updateDonjonSchema.parse(req.body);
      const donjon = await donjonService.update(id, data);
      res.json(donjon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  /**
   * DELETE /api/donjons/:id - Delete a dungeon
   */
  async deleteDonjon(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      await donjonService.delete(id);
      res.status(204).send();
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

  // ──────────────────────── COMPOSITIONS ────────────────────────

  /**
   * GET /api/donjons/:id/salles/:salleId/compositions
   */
  async getCompositions(req: Request, res: Response, next: NextFunction) {
    try {
      const salleId = parseInt(req.params.salleId, 10);
      if (isNaN(salleId)) { res.status(400).json({ error: 'Invalid salle ID' }); return; }
      const compositions = await donjonService.getCompositions(salleId);
      res.json(compositions);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/donjons/:id/salles/:salleId/compositions
   */
  async createComposition(req: Request, res: Response, next: NextFunction) {
    try {
      const salleId = parseInt(req.params.salleId, 10);
      if (isNaN(salleId)) { res.status(400).json({ error: 'Invalid salle ID' }); return; }

      const schema = z.object({
        difficulte: z.number().int().refine(v => [4, 6, 8].includes(v), { message: 'Difficulty must be 4, 6, or 8' }),
        monstreTemplateId: z.number().int().positive(),
        niveau: z.number().int().min(1),
        quantite: z.number().int().min(1).default(1),
      });
      const data = schema.parse(req.body);
      const comp = await donjonService.createComposition(salleId, data);
      res.status(201).json(comp);
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
      if (error instanceof Error && error.message.includes('not found')) { res.status(404).json({ error: error.message }); return; }
      next(error);
    }
  }

  /**
   * PATCH /api/donjons/:id/salles/:salleId/compositions/:compId
   */
  async updateComposition(req: Request, res: Response, next: NextFunction) {
    try {
      const compId = parseInt(req.params.compId, 10);
      if (isNaN(compId)) { res.status(400).json({ error: 'Invalid composition ID' }); return; }

      const schema = z.object({
        difficulte: z.number().int().refine(v => [4, 6, 8].includes(v)).optional(),
        monstreTemplateId: z.number().int().positive().optional(),
        niveau: z.number().int().min(1).optional(),
        quantite: z.number().int().min(1).optional(),
      });
      const data = schema.parse(req.body);
      const comp = await donjonService.updateComposition(compId, data);
      res.json(comp);
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
      next(error);
    }
  }

  /**
   * DELETE /api/donjons/:id/salles/:salleId/compositions/:compId
   */
  async deleteComposition(req: Request, res: Response, next: NextFunction) {
    try {
      const compId = parseInt(req.params.compId, 10);
      if (isNaN(compId)) { res.status(400).json({ error: 'Invalid composition ID' }); return; }
      await donjonService.deleteComposition(compId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/donjons/:id/portail - Set or update dungeon portal
   */
  async setPortail(req: Request, res: Response, next: NextFunction) {
    try {
      const donjonId = parseInt(req.params.id, 10);
      if (isNaN(donjonId)) {
        res.status(400).json({ error: 'Invalid dungeon ID' });
        return;
      }

      const setPortailSchema = z.object({
        fromMapId: z.number().int().positive(),
        positionX: z.number().int().min(0),
        positionY: z.number().int().min(0),
        nom: z.string().min(1).max(200).optional(),
      });

      const data = setPortailSchema.parse(req.body);
      const result = await donjonService.setPortail(donjonId, data);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Dungeon not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message === 'Dungeon has no rooms configured') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * DELETE /api/donjons/:id/portail - Delete dungeon portal
   */
  async deletePortail(req: Request, res: Response, next: NextFunction) {
    try {
      const donjonId = parseInt(req.params.id, 10);
      if (isNaN(donjonId)) {
        res.status(400).json({ error: 'Invalid dungeon ID' });
        return;
      }

      await donjonService.deletePortail(donjonId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'No portal found for this dungeon') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const donjonController = new DonjonController();
