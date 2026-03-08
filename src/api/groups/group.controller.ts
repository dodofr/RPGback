import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { groupService } from '../../services/group.service';
import { Direction } from '../../types';

const createGroupSchema = z.object({
  nom: z.string().min(2).max(50),
  joueurId: z.number().int().positive(),
  leaderId: z.number().int().positive(),
});

const addCharacterSchema = z.object({
  characterId: z.number().int().positive(),
});

const moveSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

const enterMapSchema = z.object({
  mapId: z.number().int().positive(),
  startX: z.number().int().min(0).optional(),
  startY: z.number().int().min(0).optional(),
});

const useConnectionSchema = z.object({
  connectionId: z.number().int().positive(),
  destinationConnectionId: z.number().int().positive().optional(),
  difficulte: z.number().int().refine(val => [4, 6, 8].includes(val), {
    message: 'Difficulty must be 4, 6, or 8',
  }).optional(),
});

const moveDirectionSchema = z.object({
  direction: z.enum(['NORD', 'SUD', 'EST', 'OUEST']),
});

export class GroupController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createGroupSchema.parse(req.body);
      const group = await groupService.create(data);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Leader character not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message === 'Leader does not belong to this player' ||
          error.message === 'Leader must be on a map to create a group' ||
          error.message === 'Leader is already in a group'
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

      const group = await groupService.findById(id);
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      res.json(group);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await groupService.findAll();
      res.json(groups);
    } catch (error) {
      next(error);
    }
  }

  async addCharacter(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const data = addCharacterSchema.parse(req.body);
      const group = await groupService.addCharacter(groupId, data.characterId);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (
          error.message === 'Character not found' ||
          error.message === 'Group not found'
        ) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (
          error.message === 'Character does not belong to this player' ||
          error.message === 'Character already in group' ||
          error.message === 'Character is already in a group' ||
          error.message === 'Character must be on the same map as the group leader' ||
          error.message === 'Group is full (max 6 characters)'
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async removeCharacter(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      const charId = parseInt(req.params.charId, 10);

      if (isNaN(groupId) || isNaN(charId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const group = await groupService.removeCharacter(groupId, charId);
      res.json(group);
    } catch (error) {
      if (error instanceof Error && error.message === 'Character not in group') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async move(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const data = moveSchema.parse(req.body);
      const result = await groupService.move(groupId, data.x, data.y);
      res.json(result);
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
        if (error.message === 'Position out of map bounds') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async enterMap(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const data = enterMapSchema.parse(req.body);
      const group = await groupService.enterMap(groupId, data.mapId, data.startX, data.startY);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Group not found' || error.message === 'Map not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('Cannot enter dungeon room')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async useConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const data = useConnectionSchema.parse(req.body);
      const result = await groupService.useConnection(groupId, data.connectionId, data.difficulte, data.destinationConnectionId);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        if (error.message === 'Group not found' || error.message === 'Connection not found' ||
            error.message === 'Dungeon not found' || error.message === 'Destination portal not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message === 'Group is not on the source map' ||
            error.message === 'Group is not at the connection position' ||
            error.message.includes('Difficulty required') ||
            error.message.includes('Difficulty must be') ||
            error.message.includes('destinationConnectionId required') ||
            error.message.includes('Group already has an active dungeon run') ||
            error.message.includes('Group has no characters')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async leaveMap(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const group = await groupService.leaveMap(groupId);
      res.json(group);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Group not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message === 'Cannot leave during dungeon. Use abandon.') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async moveByDirection(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) {
        res.status(400).json({ error: 'Invalid group ID' });
        return;
      }

      const data = moveDirectionSchema.parse(req.body);
      const group = await groupService.moveByDirection(groupId, data.direction as Direction);
      res.json(group);
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
        if (error.message === 'Group is not on any map' ||
            error.message.startsWith('No exit in direction') ||
            error.message === 'Cannot navigate directly to a dungeon room') {
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

      await groupService.delete(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot delete group during active dungeon run') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const groupController = new GroupController();
