import { Router } from 'express';
import { groupController } from './group.controller';

const router = Router();

// POST /api/groups - Create a group
router.post('/', (req, res, next) => groupController.create(req, res, next));

// GET /api/groups - List all groups
router.get('/', (req, res, next) => groupController.getAll(req, res, next));

// GET /api/groups/:id - Get a group by ID
router.get('/:id', (req, res, next) => groupController.getById(req, res, next));

// POST /api/groups/:id/characters - Add a character to group
router.post('/:id/characters', (req, res, next) => groupController.addCharacter(req, res, next));

// DELETE /api/groups/:id/characters/:charId - Remove a character from group
router.delete('/:id/characters/:charId', (req, res, next) =>
  groupController.removeCharacter(req, res, next)
);

// PATCH /api/groups/:id/move - Move group on the map
router.patch('/:id/move', (req, res, next) => groupController.move(req, res, next));

// POST /api/groups/:id/enter-map - Enter a map
router.post('/:id/enter-map', (req, res, next) => groupController.enterMap(req, res, next));

// POST /api/groups/:id/use-connection - Use a connection to travel to another map
router.post('/:id/use-connection', (req, res, next) => groupController.useConnection(req, res, next));

// POST /api/groups/:id/leave-map - Leave current map
router.post('/:id/leave-map', (req, res, next) => groupController.leaveMap(req, res, next));

// POST /api/groups/:id/move-direction - Move to another map by direction
router.post('/:id/move-direction', (req, res, next) => groupController.moveByDirection(req, res, next));

// DELETE /api/groups/:id - Delete a group
router.delete('/:id', (req, res, next) => groupController.delete(req, res, next));

export default router;
