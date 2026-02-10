import { Router } from 'express';
import { combatController } from './combat.controller';

const router = Router();

// POST /api/combats - Create a combat
router.post('/', (req, res, next) => combatController.create(req, res, next));

// GET /api/combats - List all combats
router.get('/', (req, res, next) => combatController.getAll(req, res, next));

// GET /api/combats/:id - Get combat state
router.get('/:id', (req, res, next) => combatController.getById(req, res, next));

// POST /api/combats/:id/action - Execute an action (attack/spell)
router.post('/:id/action', (req, res, next) => combatController.action(req, res, next));

// POST /api/combats/:id/move - Move an entity
router.post('/:id/move', (req, res, next) => combatController.move(req, res, next));

// POST /api/combats/:id/end-turn - End current turn
router.post('/:id/end-turn', (req, res, next) => combatController.endTurn(req, res, next));

// POST /api/combats/:id/flee - Flee from combat
router.post('/:id/flee', (req, res, next) => combatController.flee(req, res, next));

// GET /api/combats/:id/entities/:entiteId/spells - Get spells for a combat entity
router.get('/:id/entities/:entiteId/spells', (req, res, next) => combatController.getEntitySpells(req, res, next));

// DELETE /api/combats/:id - Delete a combat
router.delete('/:id', (req, res, next) => combatController.delete(req, res, next));

export default router;
