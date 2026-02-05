import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { playerService } from '../../services/player.service';

const createPlayerSchema = z.object({
  nom: z.string().min(2).max(50),
});

export class PlayerController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createPlayerSchema.parse(req.body);
      const player = await playerService.create(data);
      res.status(201).json(player);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
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

      const player = await playerService.findById(id);
      if (!player) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      res.json(player);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const players = await playerService.findAll();
      res.json(players);
    } catch (error) {
      next(error);
    }
  }

  async getCharacters(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const player = await playerService.findById(id);
      if (!player) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      const characters = await playerService.getCharacters(id);
      res.json(characters);
    } catch (error) {
      next(error);
    }
  }

  async getGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const player = await playerService.findById(id);
      if (!player) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      const groups = await playerService.getGroups(id);
      res.json(groups);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await playerService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const playerController = new PlayerController();
