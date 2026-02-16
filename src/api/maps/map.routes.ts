import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { mapController } from './map.controller';

// ==================== REGIONS ====================
const regionsRouter = Router();

// GET /api/regions - List all regions
regionsRouter.get('/', (req, res, next) => mapController.getAllRegions(req, res, next));

// GET /api/regions/:id - Get region details
regionsRouter.get('/:id', (req, res, next) => mapController.getRegionById(req, res, next));

// POST /api/regions - Create a region
regionsRouter.post('/', (req, res, next) => mapController.createRegion(req, res, next));

// PATCH /api/regions/:id - Update a region
regionsRouter.patch('/:id', (req, res, next) => mapController.updateRegion(req, res, next));

// DELETE /api/regions/:id - Delete a region
regionsRouter.delete('/:id', (req, res, next) => mapController.deleteRegion(req, res, next));

// POST /api/regions/:id/monstres - Add monster to region
regionsRouter.post('/:id/monstres', (req, res, next) => mapController.addRegionMonstre(req, res, next));

// DELETE /api/regions/:id/monstres/:monstreId - Remove monster from region
regionsRouter.delete('/:id/monstres/:monstreId', (req, res, next) => mapController.removeRegionMonstre(req, res, next));

// ==================== MAPS ====================
const mapsRouter = Router();

// GET /api/maps - List all maps
mapsRouter.get('/', (req, res, next) => mapController.getAllMaps(req, res, next));

// GET /api/maps/:id - Get map details with enemies and connections
mapsRouter.get('/:id', (req, res, next) => mapController.getMapById(req, res, next));

// POST /api/maps - Create a map
mapsRouter.post('/', (req, res, next) => mapController.createMap(req, res, next));

// POST /api/maps/:id/connections - Add connection to another map
mapsRouter.post('/:id/connections', (req, res, next) => mapController.addConnection(req, res, next));

// GET /api/maps/:id/grilles - Get combat grids linked to this map
mapsRouter.get('/:id/grilles', (req, res, next) => mapController.getMapGrilles(req, res, next));

// POST /api/maps/:id/spawn-enemies - Spawn enemies on the map (MANUEL mode)
mapsRouter.post('/:id/spawn-enemies', (req, res, next) => mapController.spawnEnemies(req, res, next));

// POST /api/maps/:id/engage - Engage an enemy (start combat)
mapsRouter.post('/:id/engage', (req, res, next) => mapController.engageEnemy(req, res, next));

// POST /api/maps/:id/respawn - Process respawns for defeated enemies
mapsRouter.post('/:id/respawn', (req, res, next) => mapController.processRespawns(req, res, next));

// PATCH /api/maps/:id - Update a map
mapsRouter.patch('/:id', (req, res, next) => mapController.updateMap(req, res, next));

// DELETE /api/maps/:id - Delete a map
mapsRouter.delete('/:id', (req, res, next) => mapController.deleteMap(req, res, next));

// DELETE /api/maps/:id/connections/:connId - Delete a map connection
mapsRouter.delete('/:id/connections/:connId', (req, res, next) => mapController.deleteConnection(req, res, next));

// ==================== MONSTRES ====================
const monstresRouter = Router();

// GET /api/monstres - List all monster templates
monstresRouter.get('/', (req, res, next) => mapController.getAllMonstres(req, res, next));

// GET /api/monstres/:id - Get monster template details
monstresRouter.get('/:id', (req, res, next) => mapController.getMonstreById(req, res, next));

// POST /api/monstres - Create a monster template
monstresRouter.post('/', (req, res, next) => mapController.createMonstre(req, res, next));

// PATCH /api/monstres/:id - Update a monster template
monstresRouter.patch('/:id', (req, res, next) => mapController.updateMonstre(req, res, next));

// DELETE /api/monstres/:id - Delete a monster template
monstresRouter.delete('/:id', (req, res, next) => mapController.deleteMonstre(req, res, next));

// POST /api/monstres/:id/sorts - Add spell to monster
monstresRouter.post('/:id/sorts', (req, res, next) => mapController.addMonstreSort(req, res, next));

// DELETE /api/monstres/:id/sorts/:sortId - Remove spell from monster
monstresRouter.delete('/:id/sorts/:sortId', (req, res, next) => mapController.removeMonstreSort(req, res, next));

// POST /api/monstres/:id/drops - Add drop to monster
monstresRouter.post('/:id/drops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const monstreId = parseInt(req.params.id, 10);
    if (isNaN(monstreId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      ressourceId: z.number().int().positive().nullable().optional(),
      equipementId: z.number().int().positive().nullable().optional(),
      tauxDrop: z.number().min(0).max(1).default(0.3),
      quantiteMin: z.number().int().min(1).default(1),
      quantiteMax: z.number().int().min(1).default(1),
    });
    const data = schema.parse(req.body);
    const drop = await prisma.monstreDrop.create({
      data: { monstreId, ...data },
      include: { ressource: true, equipement: true },
    });
    res.status(201).json(drop);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/monstres/:id/drops/:dropId - Update a drop
monstresRouter.patch('/:id/drops/:dropId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);
    if (isNaN(dropId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      ressourceId: z.number().int().positive().nullable().optional(),
      equipementId: z.number().int().positive().nullable().optional(),
      tauxDrop: z.number().min(0).max(1).optional(),
      quantiteMin: z.number().int().min(1).optional(),
      quantiteMax: z.number().int().min(1).optional(),
    });
    const data = schema.parse(req.body);
    const drop = await prisma.monstreDrop.update({
      where: { id: dropId },
      data,
      include: { ressource: true, equipement: true },
    });
    res.json(drop);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/monstres/:id/drops/:dropId - Remove a drop
monstresRouter.delete('/:id/drops/:dropId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);
    if (isNaN(dropId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await prisma.monstreDrop.delete({ where: { id: dropId } });
    res.status(204).send();
  } catch (error) { next(error); }
});

export default {
  regions: regionsRouter,
  maps: mapsRouter,
  monstres: monstresRouter,
};
