import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { mapController } from './map.controller';
import { metierService } from '../../services/metier.service';
import { familierService } from '../../services/familier.service';

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

// PUT /api/maps/world-positions - Batch update world positions + rebuild directional links
mapsRouter.put('/world-positions', (req, res, next) => mapController.updateWorldPositions(req, res, next));

// GET /api/maps/portals - List all non-dungeon portals (must be before /:id)
mapsRouter.get('/portals', (req, res, next) => mapController.getAllPortals(req, res, next));

// GET /api/maps - List all maps
mapsRouter.get('/', (req, res, next) => mapController.getAllMaps(req, res, next));

// GET /api/maps/:id - Get map details with enemies and connections
mapsRouter.get('/:id', (req, res, next) => mapController.getMapById(req, res, next));

// POST /api/maps - Create a map
mapsRouter.post('/', (req, res, next) => mapController.createMap(req, res, next));

// POST /api/maps/:id/connections - Add connection to another map
mapsRouter.post('/:id/connections', (req, res, next) => mapController.addConnection(req, res, next));

// GET /api/maps/:id/grid - Get map grid (cases + spawns)
mapsRouter.get('/:id/grid', (req, res, next) => mapController.getMapGrid(req, res, next));

// PUT /api/maps/:id/grid/cases - Replace map cases (obstacles + excluded)
mapsRouter.put('/:id/grid/cases', (req, res, next) => mapController.setMapCases(req, res, next));

// PUT /api/maps/:id/grid/spawns - Replace map spawns
mapsRouter.put('/:id/grid/spawns', (req, res, next) => mapController.setMapSpawns(req, res, next));

// GET /api/maps/:id/pnj - Get all NPCs on a map
mapsRouter.get('/:id/pnj', (req, res, next) => mapController.getMapPNJ(req, res, next));

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

// GET /api/maps/:id/enclos - Get familier enclos assignments on a map
mapsRouter.get('/:id/enclos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mapId = parseInt(req.params.id, 10);
    if (isNaN(mapId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    res.json(await familierService.getEnclosByMap(mapId));
  } catch (error) { next(error); }
});

// GET /api/maps/:id/ressources - Get resource nodes on a map
mapsRouter.get('/:id/ressources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mapId = parseInt(req.params.id, 10);
    if (isNaN(mapId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    res.json(await metierService.getMapRessources(mapId));
  } catch (error) { next(error); }
});

// POST /api/maps/:id/ressources - Add resource node on a map
mapsRouter.post('/:id/ressources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mapId = parseInt(req.params.id, 10);
    if (isNaN(mapId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      caseX: z.number().int().min(0),
      caseY: z.number().int().min(0),
      noeudId: z.number().int().positive(),
      respawnMinutes: z.number().int().min(1).optional(),
    });
    const data = schema.parse(req.body);
    res.status(201).json(await metierService.addMapRessource({ ...data, mapId }));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/maps/:id/ressources/:ressourceId - Remove resource node from map
mapsRouter.delete('/:id/ressources/:ressourceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.ressourceId, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await metierService.deleteMapRessource(id);
    res.status(204).send();
  } catch (error) { next(error); }
});

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
      familierRaceId: z.number().int().positive().nullable().optional(),
      tauxDrop: z.number().min(0).max(1).default(0.3),
      quantiteMin: z.number().int().min(1).default(1),
      quantiteMax: z.number().int().min(1).default(1),
    });
    const data = schema.parse(req.body);
    const drop = await prisma.monstreDrop.create({
      data: { monstreId, ...data },
      include: { ressource: true, equipement: true, familierRace: true },
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
      familierRaceId: z.number().int().positive().nullable().optional(),
      tauxDrop: z.number().min(0).max(1).optional(),
      quantiteMin: z.number().int().min(1).optional(),
      quantiteMax: z.number().int().min(1).optional(),
    });
    const data = schema.parse(req.body);
    const drop = await prisma.monstreDrop.update({
      where: { id: dropId },
      data,
      include: { ressource: true, equipement: true, familierRace: true },
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
