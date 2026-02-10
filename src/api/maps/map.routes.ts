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

export default {
  regions: regionsRouter,
  maps: mapsRouter,
  monstres: monstresRouter,
};
