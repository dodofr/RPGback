import { Router } from 'express';
import { characterController } from './character.controller';
import { craftController } from '../craft/craft.controller';

const router = Router();

// POST /api/characters - Create a character
router.post('/', (req, res, next) => characterController.create(req, res, next));

// GET /api/characters - List all characters
router.get('/', (req, res, next) => characterController.getAll(req, res, next));

// GET /api/characters/:id - Get a character by ID
router.get('/:id', (req, res, next) => characterController.getById(req, res, next));

// PATCH /api/characters/:id - Update a character
router.patch('/:id', (req, res, next) => characterController.update(req, res, next));

// GET /api/characters/:id/spells - Get character's available spells
router.get('/:id/spells', (req, res, next) => characterController.getSpells(req, res, next));

// POST /api/characters/:id/sync-spells - Learn all missing race spells up to current level
router.post('/:id/sync-spells', (req, res, next) => characterController.syncSpells(req, res, next));

// POST /api/characters/:id/allocate-stats - Allocate stat points
router.post('/:id/allocate-stats', (req, res, next) => characterController.allocateStats(req, res, next));

// POST /api/characters/:id/reset-stats - Reset all allocated stat points to base (10)
router.post('/:id/reset-stats', (req, res, next) => characterController.resetStats(req, res, next));

// GET /api/characters/:id/progression - Get progression info (XP, level, etc.)
router.get('/:id/progression', (req, res, next) => characterController.getProgression(req, res, next));

// POST /api/characters/:id/craft/:recetteId - Craft an item
router.post('/:id/craft/:recetteId', (req, res, next) => craftController.craft(req, res, next));

// DELETE /api/characters/:id - Delete a character
router.delete('/:id', (req, res, next) => characterController.delete(req, res, next));

export default router;
