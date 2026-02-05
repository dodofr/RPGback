import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mapService } from '../../services/map.service';
import { regionService } from '../../services/region.service';
import { monstreService } from '../../services/monstre.service';

// Validation schemas
const createMapSchema = z.object({
  nom: z.string().min(2).max(100),
  regionId: z.number().int().positive(),
  type: z.enum(['WILDERNESS', 'VILLE', 'DONJON', 'BOSS', 'SAFE']),
  combatMode: z.enum(['MANUEL', 'AUTO']),
  largeur: z.number().int().min(5).max(100),
  hauteur: z.number().int().min(5).max(100),
  tauxRencontre: z.number().min(0).max(1).optional(),
});

const createRegionSchema = z.object({
  nom: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['FORET', 'PLAINE', 'DESERT', 'MONTAGNE', 'MARAIS', 'CAVERNE', 'CITE']),
  niveauMin: z.number().int().min(1).optional(),
  niveauMax: z.number().int().min(1).optional(),
});

const createMonstreSchema = z.object({
  nom: z.string().min(2).max(100),
  force: z.number().int().min(1),
  intelligence: z.number().int().min(1),
  dexterite: z.number().int().min(1),
  agilite: z.number().int().min(1),
  vie: z.number().int().min(1),
  chance: z.number().int().min(1),
  pvBase: z.number().int().min(1),
  paBase: z.number().int().min(1).optional(),
  pmBase: z.number().int().min(1).optional(),
  niveauBase: z.number().int().min(1).optional(),
  xpRecompense: z.number().int().min(0).optional(),
});

const addConnectionSchema = z.object({
  toMapId: z.number().int().positive(),
  positionX: z.number().int().min(0),
  positionY: z.number().int().min(0),
  nom: z.string().min(2).max(100),
});

const engageSchema = z.object({
  groupeId: z.number().int().positive(),
  groupeEnnemiId: z.number().int().positive(),
});

export class MapController {
  // ==================== REGIONS ====================

  async getAllRegions(req: Request, res: Response, next: NextFunction) {
    try {
      const regions = await regionService.findAll();
      res.json(regions);
    } catch (error) {
      next(error);
    }
  }

  async getRegionById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const region = await regionService.findById(id);
      if (!region) {
        res.status(404).json({ error: 'Region not found' });
        return;
      }

      res.json(region);
    } catch (error) {
      next(error);
    }
  }

  async createRegion(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createRegionSchema.parse(req.body);
      const region = await regionService.create(data);
      res.status(201).json(region);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  // ==================== MAPS ====================

  async getAllMaps(req: Request, res: Response, next: NextFunction) {
    try {
      const maps = await mapService.findAll();
      res.json(maps);
    } catch (error) {
      next(error);
    }
  }

  async getMapById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const map = await mapService.findById(id);
      if (!map) {
        res.status(404).json({ error: 'Map not found' });
        return;
      }

      res.json(map);
    } catch (error) {
      next(error);
    }
  }

  async createMap(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createMapSchema.parse(req.body);
      const map = await mapService.create(data);
      res.status(201).json(map);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async addConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const fromMapId = parseInt(req.params.id, 10);
      if (isNaN(fromMapId)) {
        res.status(400).json({ error: 'Invalid map ID' });
        return;
      }

      const data = addConnectionSchema.parse(req.body);
      const connection = await mapService.addConnection({ fromMapId, ...data });
      res.status(201).json(connection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async spawnEnemies(req: Request, res: Response, next: NextFunction) {
    try {
      const mapId = parseInt(req.params.id, 10);
      if (isNaN(mapId)) {
        res.status(400).json({ error: 'Invalid map ID' });
        return;
      }

      const groups = await mapService.spawnEnemyGroups(mapId);
      res.json({ message: `Spawned ${groups.length} enemy groups`, groupesEnnemis: groups });
    } catch (error) {
      if (error instanceof Error && error.message === 'Map not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async engageEnemy(req: Request, res: Response, next: NextFunction) {
    try {
      const mapId = parseInt(req.params.id, 10);
      if (isNaN(mapId)) {
        res.status(400).json({ error: 'Invalid map ID' });
        return;
      }

      const data = engageSchema.parse(req.body);

      const combat = await mapService.engageEnemyGroup(mapId, data.groupeEnnemiId, data.groupeId);

      res.status(201).json(combat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof Error) {
        const notFoundErrors = ['Map not found', 'Enemy group not found on this map', 'Group not found'];
        if (notFoundErrors.includes(error.message)) {
          res.status(404).json({ error: error.message });
          return;
        }
        const badRequestErrors = ['Cannot manually engage enemies in AUTO mode', 'Enemy group already defeated'];
        if (badRequestErrors.includes(error.message)) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async processRespawns(req: Request, res: Response, next: NextFunction) {
    try {
      const mapId = parseInt(req.params.id, 10);
      if (isNaN(mapId)) {
        res.status(400).json({ error: 'Invalid map ID' });
        return;
      }

      const respawnedGroups = await mapService.processGroupRespawns(mapId);

      res.json({
        message: `Respawned ${respawnedGroups.length} enemy groups`,
        groupesEnnemis: respawnedGroups,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== MONSTRES ====================

  async getAllMonstres(req: Request, res: Response, next: NextFunction) {
    try {
      const monstres = await monstreService.findAll();
      res.json(monstres);
    } catch (error) {
      next(error);
    }
  }

  async getMonstreById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const monstre = await monstreService.findById(id);
      if (!monstre) {
        res.status(404).json({ error: 'Monster template not found' });
        return;
      }

      res.json(monstre);
    } catch (error) {
      next(error);
    }
  }

  async createMonstre(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createMonstreSchema.parse(req.body);
      const monstre = await monstreService.create(data);
      res.status(201).json(monstre);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }
}

export const mapController = new MapController();
