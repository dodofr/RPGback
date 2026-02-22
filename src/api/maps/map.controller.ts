import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
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
  orMin: z.number().int().min(0).default(0),
  orMax: z.number().int().min(0).default(0),
  iaType: z.enum(['EQUILIBRE', 'AGGRESSIF', 'SOUTIEN', 'DISTANCE']).default('EQUILIBRE'),
  pvScalingInvocation: z.number().min(0).max(1).nullable().optional(),
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

  // ==================== WORLD POSITIONS ====================

  async updateWorldPositions(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        positions: z.array(z.object({
          mapId: z.number().int().positive(),
          worldX: z.number().int(),
          worldY: z.number().int(),
        })),
      });
      const { positions } = schema.parse(req.body);
      const maps = await mapService.updateWorldPositions(positions);
      res.json(maps);
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

      // Prevent manual engage on AUTO maps (proximity auto-engage is handled by move())
      const map = await mapService.findById(mapId);
      if (!map) {
        res.status(404).json({ error: 'Map not found' });
        return;
      }
      const isDungeonRoom = map.type === 'DONJON' || map.type === 'BOSS';
      if (map.combatMode !== 'MANUEL' && !isDungeonRoom) {
        res.status(400).json({ error: 'Cannot manually engage enemies in AUTO mode' });
        return;
      }

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
        const badRequestErrors = ['Enemy group already defeated'];
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

  // ==================== MAP GRID (cases + spawns) ====================

  async getMapGrid(req: Request, res: Response, next: NextFunction) {
    try {
      const mapId = parseInt(req.params.id, 10);
      if (isNaN(mapId)) { res.status(400).json({ error: 'Invalid map ID' }); return; }
      const map = await prisma.map.findUnique({
        where: { id: mapId },
        include: {
          cases: true,
          spawns: { orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }] },
        },
      });
      if (!map) { res.status(404).json({ error: 'Map not found' }); return; }
      res.json({ cases: map.cases, spawns: map.spawns });
    } catch (error) {
      next(error);
    }
  }

  async setMapCases(req: Request, res: Response, next: NextFunction) {
    try {
      const mapId = parseInt(req.params.id, 10);
      if (isNaN(mapId)) { res.status(400).json({ error: 'Invalid map ID' }); return; }
      const schema = z.object({
        cases: z.array(z.object({
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          bloqueDeplacement: z.boolean().default(false),
          bloqueLigneDeVue: z.boolean().default(false),
          estExclue: z.boolean().default(false),
        })),
      });
      const { cases } = schema.parse(req.body);
      const map = await prisma.map.findUnique({ where: { id: mapId } });
      if (!map) { res.status(404).json({ error: 'Map not found' }); return; }
      await prisma.mapCase.deleteMany({ where: { mapId } });
      if (cases.length > 0) {
        await prisma.mapCase.createMany({ data: cases.map(c => ({ ...c, mapId })) });
      }
      const updated = await prisma.mapCase.findMany({ where: { mapId } });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
      next(error);
    }
  }

  async setMapSpawns(req: Request, res: Response, next: NextFunction) {
    try {
      const mapId = parseInt(req.params.id, 10);
      if (isNaN(mapId)) { res.status(400).json({ error: 'Invalid map ID' }); return; }
      const schema = z.object({
        spawns: z.array(z.object({
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          equipe: z.number().int().min(0).max(1),
          ordre: z.number().int().min(1).max(8),
        })),
      });
      const { spawns } = schema.parse(req.body);
      const playerSpawns = spawns.filter(s => s.equipe === 0);
      const enemySpawns = spawns.filter(s => s.equipe === 1);
      if (playerSpawns.length !== 8) { res.status(400).json({ error: 'Exactly 8 player spawns (equipe=0) required' }); return; }
      if (enemySpawns.length !== 8) { res.status(400).json({ error: 'Exactly 8 enemy spawns (equipe=1) required' }); return; }
      const map = await prisma.map.findUnique({ where: { id: mapId } });
      if (!map) { res.status(404).json({ error: 'Map not found' }); return; }
      await prisma.mapSpawn.deleteMany({ where: { mapId } });
      await prisma.mapSpawn.createMany({ data: spawns.map(s => ({ ...s, mapId })) });
      const updated = await prisma.mapSpawn.findMany({
        where: { mapId },
        orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }],
      });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
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

  async updateMonstre(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const updateMonstreSchema = z.object({
        nom: z.string().min(2).max(100).optional(),
        force: z.number().int().min(1).optional(),
        intelligence: z.number().int().min(1).optional(),
        dexterite: z.number().int().min(1).optional(),
        agilite: z.number().int().min(1).optional(),
        vie: z.number().int().min(1).optional(),
        chance: z.number().int().min(1).optional(),
        pvBase: z.number().int().min(1).optional(),
        paBase: z.number().int().min(1).optional(),
        pmBase: z.number().int().min(1).optional(),
        niveauBase: z.number().int().min(1).optional(),
        xpRecompense: z.number().int().min(0).optional(),
        orMin: z.number().int().min(0).optional(),
        orMax: z.number().int().min(0).optional(),
        iaType: z.enum(['EQUILIBRE', 'AGGRESSIF', 'SOUTIEN', 'DISTANCE']).optional(),
        pvScalingInvocation: z.number().min(0).max(1).nullable().optional(),
      });
      const data = updateMonstreSchema.parse(req.body);
      const monstre = await monstreService.update(id, data);
      res.json(monstre);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async deleteMonstre(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      await monstreService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ==================== MAPS (update/delete) ====================

  async updateMap(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const updateMapSchema = z.object({
        nom: z.string().min(2).max(100).optional(),
        type: z.enum(['WILDERNESS', 'VILLE', 'DONJON', 'BOSS', 'SAFE']).optional(),
        combatMode: z.enum(['MANUEL', 'AUTO']).optional(),
        largeur: z.number().int().min(5).max(100).optional(),
        hauteur: z.number().int().min(5).max(100).optional(),
        tauxRencontre: z.number().min(0).max(1).optional(),
        nordMapId: z.number().int().positive().nullable().optional(),
        sudMapId: z.number().int().positive().nullable().optional(),
        estMapId: z.number().int().positive().nullable().optional(),
        ouestMapId: z.number().int().positive().nullable().optional(),
      });
      const data = updateMapSchema.parse(req.body);
      const map = await mapService.update(id, data);
      res.json(map);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async deleteMap(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      await mapService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async deleteConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const connId = parseInt(req.params.connId, 10);
      if (isNaN(connId)) {
        res.status(400).json({ error: 'Invalid connection ID' });
        return;
      }
      await mapService.deleteConnection(connId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ==================== REGIONS (update/delete) ====================

  async updateRegion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const updateRegionSchema = z.object({
        nom: z.string().min(2).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        type: z.enum(['FORET', 'PLAINE', 'DESERT', 'MONTAGNE', 'MARAIS', 'CAVERNE', 'CITE']).optional(),
        niveauMin: z.number().int().min(1).optional(),
        niveauMax: z.number().int().min(1).optional(),
      });
      const data = updateRegionSchema.parse(req.body);
      const region = await regionService.update(id, data);
      res.json(region);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async deleteRegion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      await regionService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ==================== RELATION: RegionMonstre ====================

  async addRegionMonstre(req: Request, res: Response, next: NextFunction) {
    try {
      const regionId = parseInt(req.params.id, 10);
      if (isNaN(regionId)) {
        res.status(400).json({ error: 'Invalid region ID' });
        return;
      }
      const schema = z.object({
        monstreId: z.number().int().positive(),
        probabilite: z.number().min(0).default(1.0),
      });
      const data = schema.parse(req.body);
      const regionMonstre = await prisma.regionMonstre.create({
        data: { regionId, monstreId: data.monstreId, probabilite: data.probabilite },
        include: { monstre: true, region: true },
      });
      res.status(201).json(regionMonstre);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async removeRegionMonstre(req: Request, res: Response, next: NextFunction) {
    try {
      const regionId = parseInt(req.params.id, 10);
      const monstreId = parseInt(req.params.monstreId, 10);
      if (isNaN(regionId) || isNaN(monstreId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      await prisma.regionMonstre.delete({
        where: { regionId_monstreId: { regionId, monstreId } },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ==================== RELATION: MonstreSort ====================

  async addMonstreSort(req: Request, res: Response, next: NextFunction) {
    try {
      const monstreId = parseInt(req.params.id, 10);
      if (isNaN(monstreId)) {
        res.status(400).json({ error: 'Invalid monster ID' });
        return;
      }
      const schema = z.object({
        sortId: z.number().int().positive(),
        priorite: z.number().int().min(1).default(1),
      });
      const data = schema.parse(req.body);
      const monstreSort = await prisma.monstreSort.create({
        data: { monstreId, sortId: data.sortId, priorite: data.priorite },
        include: { sort: true, monstre: true },
      });
      res.status(201).json(monstreSort);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  async removeMonstreSort(req: Request, res: Response, next: NextFunction) {
    try {
      const monstreId = parseInt(req.params.id, 10);
      const sortId = parseInt(req.params.sortId, 10);
      if (isNaN(monstreId) || isNaN(sortId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      await prisma.monstreSort.delete({
        where: { monstreId_sortId: { monstreId, sortId } },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const mapController = new MapController();
