import { Router } from 'express';
import { z } from 'zod';
import { characterController } from './character.controller';
import { craftController } from '../craft/craft.controller';
import { questService } from '../../services/quest.service';
import { characterNavigationService } from '../../services/character-navigation.service';

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

// GET /api/characters/:id/quetes - Get active quests
router.get('/:id/quetes', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const quetes = await questService.getActiveQuests(id);
    res.json(quetes);
  } catch (error) { next(error); }
});

// ==================== Navigation solo ====================

const enterMapSchema = z.object({
  mapId: z.number().int().positive(),
  startX: z.number().int().min(0).optional(),
  startY: z.number().int().min(0).optional(),
});

const moveSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

const moveDirectionSchema = z.object({
  direction: z.enum(['NORD', 'SUD', 'EST', 'OUEST']),
});

const useConnectionSchema = z.object({
  connectionId: z.number().int().positive(),
  destinationConnectionId: z.number().int().positive().optional(),
  difficulte: z.number().int().refine(val => [4, 6, 8].includes(val)).optional(),
});

// POST /api/characters/:id/enter-map
router.post('/:id/enter-map', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = enterMapSchema.parse(req.body);
    const result = await characterNavigationService.enterMap(id, data.mapId, data.startX, data.startY);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'Character not found' || error.message === 'Map not found') { res.status(404).json({ error: error.message }); return; }
      if (error.message === 'Cannot enter dungeon room directly') { res.status(400).json({ error: error.message }); return; }
    }
    next(error);
  }
});

// PATCH /api/characters/:id/move
router.patch('/:id/move', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = moveSchema.parse(req.body);
    const result = await characterNavigationService.move(id, data.x, data.y);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'Character not found') { res.status(404).json({ error: error.message }); return; }
      if (error.message === 'Character is not on any map' || error.message === 'Position out of map bounds' || error.message === 'Cette case est bloquée') { res.status(400).json({ error: error.message }); return; }
    }
    next(error);
  }
});

// POST /api/characters/:id/move-direction
router.post('/:id/move-direction', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = moveDirectionSchema.parse(req.body);
    const result = await characterNavigationService.moveByDirection(id, data.direction as any);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'Character not found' || error.message === 'Map not found') { res.status(404).json({ error: error.message }); return; }
      if (error.message === 'Character is not on any map' || error.message.startsWith('No exit in direction') || error.message === 'Cannot navigate directly to a dungeon room') { res.status(400).json({ error: error.message }); return; }
    }
    next(error);
  }
});

// POST /api/characters/:id/use-connection
router.post('/:id/use-connection', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = useConnectionSchema.parse(req.body);
    const result = await characterNavigationService.useConnection(id, data.connectionId, data.destinationConnectionId, data.difficulte);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'Character not found' || error.message === 'Connection not found' || error.message === 'Destination portal not found') { res.status(404).json({ error: error.message }); return; }
      if (error.message === 'Character is not on the source map' || error.message === 'Character is not at the connection position' || error.message === 'Dungeon portals require a group' || error.message === 'destinationConnectionId required for non-dungeon portals') { res.status(400).json({ error: error.message }); return; }
    }
    next(error);
  }
});

// DELETE /api/characters/:id - Delete a character
router.delete('/:id', (req, res, next) => characterController.delete(req, res, next));

export default router;
