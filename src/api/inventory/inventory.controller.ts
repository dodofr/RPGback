import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { inventoryService } from '../../services/inventory.service';

const unequipSchema = z.object({
  slot: z.string().min(1),
});

const sendSchema = z.object({
  destinataireId: z.number().int().positive(),
  or: z.number().int().min(0).default(0),
  ressources: z.array(z.object({
    ressourceId: z.number().int().positive(),
    quantite: z.number().int().positive(),
  })).default([]),
  items: z.array(z.number().int().positive()).default([]),
});

export class InventoryController {
  async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const inventory = await inventoryService.getInventory(id);
      const setBonuses = await inventoryService.getSetBonuses(id);
      res.json({ ...inventory, setBonuses });
    } catch (error) {
      if (error instanceof Error && error.message === 'Character not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async destroyItem(req: Request, res: Response, next: NextFunction) {
    try {
      const personnageId = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(personnageId) || isNaN(itemId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await inventoryService.destroyItem(personnageId, itemId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('Cannot destroy')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async destroyResource(req: Request, res: Response, next: NextFunction) {
    try {
      const personnageId = parseInt(req.params.id, 10);
      const ressourceId = parseInt(req.params.ressourceId, 10);
      if (isNaN(personnageId) || isNaN(ressourceId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const quantite = parseInt(req.query.quantite as string, 10) || 1;
      await inventoryService.destroyResource(personnageId, ressourceId, quantite);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Not enough resources') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async equipItem(req: Request, res: Response, next: NextFunction) {
    try {
      const personnageId = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(personnageId) || isNaN(itemId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const inventory = await inventoryService.equipFromInventory(personnageId, itemId);
      res.json(inventory);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('level too low')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async unequipItem(req: Request, res: Response, next: NextFunction) {
    try {
      const personnageId = parseInt(req.params.id, 10);
      if (isNaN(personnageId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const data = unequipSchema.parse(req.body);
      const inventory = await inventoryService.unequipToInventory(personnageId, data.slot);
      res.json(inventory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error && error.message.includes('No item equipped')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
  async sendItems(req: Request, res: Response, next: NextFunction) {
    try {
      const expediteurId = parseInt(req.params.id, 10);
      if (isNaN(expediteurId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const data = sendSchema.parse(req.body);
      const result = await inventoryService.sendToCharacter(
        expediteurId,
        data.destinataireId,
        data.or,
        data.ressources,
        data.items,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        const msg = error.message;
        if (
          msg === 'Cannot send to yourself' ||
          msg === 'Not enough gold' ||
          msg.startsWith('Not enough of resource') ||
          msg.includes('not found in sender') ||
          msg.includes('is equipped') ||
          msg.includes('weight limit exceeded') ||
          msg === 'Nothing to send'
        ) {
          res.status(400).json({ error: msg });
          return;
        }
        if (msg === 'Sender not found' || msg === 'Recipient not found') {
          res.status(404).json({ error: msg });
          return;
        }
      }
      next(error);
    }
  }
}

export const inventoryController = new InventoryController();
