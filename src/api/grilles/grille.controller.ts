import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { grilleService } from '../../services/grille.service';

const caseSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  bloqueDeplacement: z.boolean(),
  bloqueLigneDeVue: z.boolean(),
});

const spawnSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  equipe: z.number().int().min(0).max(1),
  ordre: z.number().int().min(1).max(8),
});

const createGrilleSchema = z.object({
  nom: z.string().min(1),
  mapId: z.number().int().positive(),
  largeur: z.number().int().min(5).max(30),
  hauteur: z.number().int().min(5).max(30),
  cases: z.array(caseSchema),
  spawns: z.array(spawnSchema).length(16),
});

const updateGrilleSchema = createGrilleSchema;

const replaceCasesSchema = z.object({
  cases: z.array(caseSchema),
});

const replaceSpawnsSchema = z.object({
  spawns: z.array(spawnSchema).length(16),
});

export class GrilleController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createGrilleSchema.parse(req.body);
      const grille = await grilleService.create(data);
      res.status(201).json(grille);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Map not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message.startsWith('Exactly') ||
          error.message.includes('out of grid bounds') ||
          error.message.includes('conflicts with')
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const grilles = await grilleService.findAll();
      res.json(grilles);
    } catch (error) {
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

      const grille = await grilleService.findById(id);
      if (!grille) {
        res.status(404).json({ error: 'Grid not found' });
        return;
      }

      res.json(grille);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const data = updateGrilleSchema.parse(req.body);
      const grille = await grilleService.update(id, data);
      res.json(grille);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Grid not found' || error.message === 'Map not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message.startsWith('Exactly') ||
          error.message.includes('out of grid bounds') ||
          error.message.includes('conflicts with')
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
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

      await grilleService.delete(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Grid not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async replaceCases(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const data = replaceCasesSchema.parse(req.body);
      const grille = await grilleService.replaceCases(id, data.cases);
      res.json(grille);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Grid not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message.includes('out of grid bounds') ||
          error.message.includes('conflicts with')
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async replaceSpawns(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const data = replaceSpawnsSchema.parse(req.body);
      const grille = await grilleService.replaceSpawns(id, data.spawns);
      res.json(grille);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Grid not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message.startsWith('Exactly') ||
          error.message.includes('out of grid bounds') ||
          error.message.includes('conflicts with')
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}

export const grilleController = new GrilleController();
