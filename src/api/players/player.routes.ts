import { Router } from 'express';
import { playerController } from './player.controller';

const router = Router();

// POST /api/players - Create a player
router.post('/', (req, res, next) => playerController.create(req, res, next));

// GET /api/players - List all players
router.get('/', (req, res, next) => playerController.getAll(req, res, next));

// GET /api/players/:id - Get a player by ID
router.get('/:id', (req, res, next) => playerController.getById(req, res, next));

// GET /api/players/:id/characters - Get player's characters
router.get('/:id/characters', (req, res, next) => playerController.getCharacters(req, res, next));

// GET /api/players/:id/groups - Get player's groups
router.get('/:id/groups', (req, res, next) => playerController.getGroups(req, res, next));

// DELETE /api/players/:id - Delete a player
router.delete('/:id', (req, res, next) => playerController.delete(req, res, next));

export default router;
