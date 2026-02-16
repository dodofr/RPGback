import { Router } from 'express';
import { craftController } from './craft.controller';

const router = Router();

// GET /api/recipes
router.get('/', (req, res, next) => craftController.getRecipes(req, res, next));

// GET /api/recipes/:id
router.get('/:id', (req, res, next) => craftController.getRecipeById(req, res, next));

export default router;
