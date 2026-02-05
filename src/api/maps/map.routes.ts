import { Router } from 'express';
import { mapController } from './map.controller';

// ==================== REGIONS ====================
const regionsRouter = Router();

// GET /api/regions - List all regions
regionsRouter.get('/', (req, res, next) => mapController.getAllRegions(req, res, next));

// GET /api/regions/:id - Get region details
regionsRouter.get('/:id', (req, res, next) => mapController.getRegionById(req, res, next));

// POST /api/regions - Create a region
regionsRouter.post('/', (req, res, next) => mapController.createRegion(req, res, next));

// ==================== MAPS ====================
const mapsRouter = Router();

// GET /api/maps - List all maps
mapsRouter.get('/', (req, res, next) => mapController.getAllMaps(req, res, next));

// GET /api/maps/:id - Get map details with enemies and connections
mapsRouter.get('/:id', (req, res, next) => mapController.getMapById(req, res, next));

// POST /api/maps - Create a map
mapsRouter.post('/', (req, res, next) => mapController.createMap(req, res, next));

// POST /api/maps/:id/spawns - Add spawn configuration
mapsRouter.post('/:id/spawns', (req, res, next) => mapController.addSpawn(req, res, next));

// POST /api/maps/:id/connections - Add connection to another map
mapsRouter.post('/:id/connections', (req, res, next) => mapController.addConnection(req, res, next));

// POST /api/maps/:id/spawn-enemies - Spawn enemies on the map (MANUEL mode)
mapsRouter.post('/:id/spawn-enemies', (req, res, next) => mapController.spawnEnemies(req, res, next));

// POST /api/maps/:id/engage - Engage an enemy (start combat)
mapsRouter.post('/:id/engage', (req, res, next) => mapController.engageEnemy(req, res, next));

// POST /api/maps/:id/respawn - Process respawns for defeated enemies
mapsRouter.post('/:id/respawn', (req, res, next) => mapController.processRespawns(req, res, next));

// ==================== MONSTRES ====================
const monstresRouter = Router();

// GET /api/monstres - List all monster templates
monstresRouter.get('/', (req, res, next) => mapController.getAllMonstres(req, res, next));

// GET /api/monstres/:id - Get monster template details
monstresRouter.get('/:id', (req, res, next) => mapController.getMonstreById(req, res, next));

// POST /api/monstres - Create a monster template
monstresRouter.post('/', (req, res, next) => mapController.createMonstre(req, res, next));

export default {
  regions: regionsRouter,
  maps: mapsRouter,
  monstres: monstresRouter,
};
