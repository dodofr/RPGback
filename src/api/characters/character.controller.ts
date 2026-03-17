import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { characterService } from '../../services/character.service';
import { spellService } from '../../services/spell.service';
import prisma from '../../config/database';

const createCharacterSchema = z.object({
  nom: z.string().min(2).max(50),
  joueurId: z.number().int().positive(),
  raceId: z.number().int().positive(),
  sexe: z.enum(['HOMME', 'FEMME']).optional(),
  force: z.number().int().min(1).max(100).optional(),
  intelligence: z.number().int().min(1).max(100).optional(),
  dexterite: z.number().int().min(1).max(100).optional(),
  agilite: z.number().int().min(1).max(100).optional(),
  vie: z.number().int().min(1).max(100).optional(),
  chance: z.number().int().min(1).max(100).optional(),
});

const updateCharacterSchema = z.object({
  nom: z.string().min(2).max(50).optional(),
  sexe: z.enum(['HOMME', 'FEMME']).optional(),
  force: z.number().int().min(1).max(100).optional(),
  intelligence: z.number().int().min(1).max(100).optional(),
  dexterite: z.number().int().min(1).max(100).optional(),
  agilite: z.number().int().min(1).max(100).optional(),
  vie: z.number().int().min(1).max(100).optional(),
  chance: z.number().int().min(1).max(100).optional(),
});

const allocateStatsSchema = z.object({
  force: z.number().int().min(0).optional(),
  intelligence: z.number().int().min(0).optional(),
  dexterite: z.number().int().min(0).optional(),
  agilite: z.number().int().min(0).optional(),
  vie: z.number().int().min(0).optional(),
  chance: z.number().int().min(0).optional(),
});

export class CharacterController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCharacterSchema.parse(req.body);
      const character = await characterService.create(data);
      res.status(201).json(character);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error && error.message === 'Race not found') {
        res.status(404).json({ error: error.message });
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

      const character = await characterService.findById(id);
      if (!character) {
        res.status(404).json({ error: 'Character not found' });
        return;
      }

      // Get total stats with bonuses
      const totalStats = await characterService.getTotalStats(id);

      res.json({
        ...character,
        totalStats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const characters = await characterService.findAll();
      res.json(characters);
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

      const data = updateCharacterSchema.parse(req.body);
      const character = await characterService.update(id, data);
      res.json(character);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async getSpells(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const spells = await characterService.getSpells(id);
      res.json(spells);
    } catch (error) {
      if (error instanceof Error && error.message === 'Character not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async syncSpells(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const personnage = await prisma.personnage.findUnique({ where: { id } });
      if (!personnage) {
        res.status(404).json({ error: 'Character not found' });
        return;
      }
      const newSpells = await spellService.learnSpellsForLevel(id, personnage.niveau);
      res.json({ message: `${newSpells.length} nouveau(x) sort(s) appris`, sorts: newSpells });
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

      await characterService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async allocateStats(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const data = allocateStatsSchema.parse(req.body);
      const result = await characterService.allocateStatPoints(id, data);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Character not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.startsWith('Not enough stat points') || error.message === 'No points to allocate') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async resetStats(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const result = await characterService.resetStatPoints(id);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Character not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async getProgression(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const progression = await characterService.getProgressionInfo(id);
      res.json(progression);
    } catch (error) {
      if (error instanceof Error && error.message === 'Character not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const characterController = new CharacterController();
