import { Router } from 'express';
import { grilleController } from './grille.controller';

const router = Router();

// POST /api/grilles - Create a combat grid
router.post('/', (req, res, next) => grilleController.create(req, res, next));

// GET /api/grilles - List all combat grids
router.get('/', (req, res, next) => grilleController.getAll(req, res, next));

// GET /api/grilles/:id - Get combat grid details
router.get('/:id', (req, res, next) => grilleController.getById(req, res, next));

// PUT /api/grilles/:id - Full update of a combat grid
router.put('/:id', (req, res, next) => grilleController.update(req, res, next));

// DELETE /api/grilles/:id - Delete a combat grid
router.delete('/:id', (req, res, next) => grilleController.delete(req, res, next));

// PUT /api/grilles/:id/cases - Replace obstacles
router.put('/:id/cases', (req, res, next) => grilleController.replaceCases(req, res, next));

// PUT /api/grilles/:id/spawns - Replace spawn positions
router.put('/:id/spawns', (req, res, next) => grilleController.replaceSpawns(req, res, next));

export default router;
