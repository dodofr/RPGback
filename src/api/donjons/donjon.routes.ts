import { Router } from 'express';
import { donjonController } from './donjon.controller';

const router = Router();

// GET /api/donjons - List all dungeons
router.get('/', (req, res, next) => donjonController.getAllDonjons(req, res, next));

// POST /api/donjons - Create a dungeon
router.post('/', (req, res, next) => donjonController.createDonjon(req, res, next));

// GET /api/donjons/run/:groupeId - Get current dungeon run state (must be before /:id to avoid conflict)
router.get('/run/:groupeId', (req, res, next) => donjonController.getDungeonState(req, res, next));

// POST /api/donjons/run/:groupeId/abandon - Abandon the dungeon
router.post('/run/:groupeId/abandon', (req, res, next) => donjonController.abandonDungeon(req, res, next));

// GET /api/donjons/:id - Get dungeon details
router.get('/:id', (req, res, next) => donjonController.getDonjonById(req, res, next));

// PATCH /api/donjons/:id - Update a dungeon
router.patch('/:id', (req, res, next) => donjonController.updateDonjon(req, res, next));

// DELETE /api/donjons/:id - Delete a dungeon
router.delete('/:id', (req, res, next) => donjonController.deleteDonjon(req, res, next));

// POST /api/donjons/:id/enter - Enter a dungeon
router.post('/:id/enter', (req, res, next) => donjonController.enterDungeon(req, res, next));

// PUT /api/donjons/:id/portail - Set or update dungeon portal
router.put('/:id/portail', (req, res, next) => donjonController.setPortail(req, res, next));

// DELETE /api/donjons/:id/portail - Delete dungeon portal
router.delete('/:id/portail', (req, res, next) => donjonController.deletePortail(req, res, next));

export default router;
