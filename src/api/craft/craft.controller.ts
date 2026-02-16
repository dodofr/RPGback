import { Request, Response, NextFunction } from 'express';
import { craftService } from '../../services/craft.service';

export class CraftController {
  async getRecipes(_req: Request, res: Response, next: NextFunction) {
    try {
      const recipes = await craftService.getRecipes();
      res.json(recipes);
    } catch (error) {
      next(error);
    }
  }

  async getRecipeById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const recipe = await craftService.getRecipeById(id);
      if (!recipe) {
        res.status(404).json({ error: 'Recipe not found' });
        return;
      }
      res.json(recipe);
    } catch (error) {
      next(error);
    }
  }

  async craft(req: Request, res: Response, next: NextFunction) {
    try {
      const personnageId = parseInt(req.params.id, 10);
      const recetteId = parseInt(req.params.recetteId, 10);
      if (isNaN(personnageId) || isNaN(recetteId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const item = await craftService.craft(personnageId, recetteId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('Need') || error.message.includes('Cannot') || error.message.includes('full') || error.message.includes('enough')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}

export const craftController = new CraftController();
