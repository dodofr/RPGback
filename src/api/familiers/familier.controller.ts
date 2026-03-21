import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { familierService } from '../../services/familier.service';

// ==================== SCHEMAS ====================

const createFamilleSchema = z.object({ nom: z.string().min(1) });

const createRaceSchema = z.object({
  nom: z.string().min(1),
  familleId: z.number().int().positive(),
  imageUrl: z.string().optional(),
  spriteScale: z.number().optional(),
  spriteOffsetX: z.number().optional(),
  spriteOffsetY: z.number().optional(),
  generation: z.number().int().min(1).optional(),
  baseForce: z.number().int().min(0).optional(),
  baseIntelligence: z.number().int().min(0).optional(),
  baseDexterite: z.number().int().min(0).optional(),
  baseAgilite: z.number().int().min(0).optional(),
  baseVie: z.number().int().min(0).optional(),
  baseChance: z.number().int().min(0).optional(),
  basePA: z.number().int().min(0).optional(),
  basePM: z.number().int().min(0).optional(),
  basePO: z.number().int().min(0).optional(),
  baseCritique: z.number().int().min(0).optional(),
  baseDommages: z.number().int().min(0).optional(),
  baseSoins: z.number().int().min(0).optional(),
  croissanceForce: z.number().min(0).optional(),
  croissanceIntelligence: z.number().min(0).optional(),
  croissanceDexterite: z.number().min(0).optional(),
  croissanceAgilite: z.number().min(0).optional(),
  croissanceVie: z.number().min(0).optional(),
  croissanceChance: z.number().min(0).optional(),
  croissancePA: z.number().min(0).optional(),
  croissancePM: z.number().min(0).optional(),
  croissancePO: z.number().min(0).optional(),
  croissanceCritique: z.number().min(0).optional(),
  croissanceDommages: z.number().min(0).optional(),
  croissanceSoins: z.number().min(0).optional(),
});

const depositSchema = z.object({
  enclosType: z.enum(['ENTRAINEMENT', 'BONHEUR', 'RENCONTRE']),
  mapId: z.number().int().positive(),
  dureeMinutes: z.number().int().min(1),
  personnageId: z.number().int().positive(),
});

const breedSchema = z.object({
  familierAId: z.number().int().positive(),
  familierBId: z.number().int().positive(),
  mapId: z.number().int().positive(),
  dureeMinutes: z.number().int().min(1),
  personnageId: z.number().int().positive(),
});

const breedCollectSchema = z.object({
  assignmentId: z.number().int().positive(),
  personnageId: z.number().int().positive(),
});

const croisementSchema = z.object({
  raceAId: z.number().int().positive(),
  raceBId: z.number().int().positive(),
  raceEnfantId: z.number().int().positive(),
  probabilite: z.number().min(0).max(1).optional(),
});

// ==================== HELPERS ====================

function parseId(req: Request, res: Response, param = 'id'): number | null {
  const id = parseInt(req.params[param], 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return null; }
  return id;
}

function handleError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation error', details: error.errors });
    return;
  }
  if (error instanceof Error) {
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}

// ==================== FAMILLES ====================

export async function getAllFamilles(req: Request, res: Response, next: NextFunction) {
  try { res.json(await familierService.getAllFamilles()); } catch (e) { next(e); }
}

export async function getFamilleById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const f = await familierService.getFamilleById(id);
    if (!f) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(f);
  } catch (e) { next(e); }
}

export async function createFamille(req: Request, res: Response, next: NextFunction) {
  try {
    const { nom } = createFamilleSchema.parse(req.body);
    res.status(201).json(await familierService.createFamille(nom));
  } catch (e) { handleError(e, res, next); }
}

export async function updateFamille(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const { nom } = createFamilleSchema.parse(req.body);
    res.json(await familierService.updateFamille(id, nom));
  } catch (e) { handleError(e, res, next); }
}

export async function deleteFamille(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    await familierService.deleteFamille(id);
    res.status(204).send();
  } catch (e) { next(e); }
}

// ==================== RACES ====================

export async function getAllRaces(req: Request, res: Response, next: NextFunction) {
  try { res.json(await familierService.getAllRaces()); } catch (e) { next(e); }
}

export async function getRaceById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const r = await familierService.getRaceById(id);
    if (!r) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(r);
  } catch (e) { next(e); }
}

export async function createRace(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createRaceSchema.parse(req.body);
    res.status(201).json(await familierService.createRace(data));
  } catch (e) { handleError(e, res, next); }
}

export async function updateRace(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const data = createRaceSchema.partial().parse(req.body);
    res.json(await familierService.updateRace(id, data));
  } catch (e) { handleError(e, res, next); }
}

export async function deleteRace(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    await familierService.deleteRace(id);
    res.status(204).send();
  } catch (e) { next(e); }
}

export async function getAllCroisements(req: Request, res: Response, next: NextFunction) {
  try {
    const { raceAId, raceBId } = req.query;
    if (raceAId && raceBId) {
      res.json(await familierService.getCroisementsByPaire(Number(raceAId), Number(raceBId)));
    } else {
      res.json(await familierService.getAllCroisements());
    }
  } catch (e) { next(e); }
}

export async function createCroisement(req: Request, res: Response, next: NextFunction) {
  try {
    const { raceAId, raceBId, raceEnfantId, probabilite } = croisementSchema.parse(req.body);
    res.status(201).json(await familierService.addCroisement(raceAId, raceBId, raceEnfantId, probabilite));
  } catch (e) { handleError(e, res, next); }
}

export async function updateCroisement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const { probabilite } = z.object({ probabilite: z.number().min(0).max(1) }).parse(req.body);
    res.json(await familierService.updateCroisement(id, probabilite));
  } catch (e) { handleError(e, res, next); }
}

export async function deleteCroisementById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    await familierService.deleteCroisement(id);
    res.status(204).send();
  } catch (e) { next(e); }
}

// Conservé pour la route imbriquée /familier-races/:id/croisements/:croisementId
export async function addCroisement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const { raceBId, raceEnfantId, probabilite } = croisementSchema.omit({ raceAId: true }).parse(req.body);
    res.status(201).json(await familierService.addCroisement(id, raceBId, raceEnfantId, probabilite));
  } catch (e) { handleError(e, res, next); }
}

export async function deleteCroisement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res, 'croisementId'); if (id === null) return;
    await familierService.deleteCroisement(id);
    res.status(204).send();
  } catch (e) { next(e); }
}

// ==================== PLAYER ENDPOINTS ====================

export async function getFamiliersByCharacter(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    res.json(await familierService.getFamiliersByPersonnage(id));
  } catch (e) { next(e); }
}

export async function equipFamilier(req: Request, res: Response, next: NextFunction) {
  try {
    const charId = parseId(req, res); if (charId === null) return;
    const famId = parseId(req, res, 'fId'); if (famId === null) return;
    res.json(await familierService.equipFamilier(charId, famId));
  } catch (e) { handleError(e, res, next); }
}

export async function unequipFamilier(req: Request, res: Response, next: NextFunction) {
  try {
    const charId = parseId(req, res); if (charId === null) return;
    res.json(await familierService.unequipFamilier(charId));
  } catch (e) { handleError(e, res, next); }
}

export async function depositFamilier(req: Request, res: Response, next: NextFunction) {
  try {
    const famId = parseId(req, res); if (famId === null) return;
    const { enclosType, mapId, dureeMinutes, personnageId } = depositSchema.parse(req.body);
    res.status(201).json(await familierService.depositInEnclos(famId, personnageId, enclosType, mapId, dureeMinutes));
  } catch (e) { handleError(e, res, next); }
}

export async function collectFamilier(req: Request, res: Response, next: NextFunction) {
  try {
    const famId = parseId(req, res); if (famId === null) return;
    const { personnageId } = z.object({ personnageId: z.number().int().positive() }).parse(req.body);
    res.json(await familierService.collectFromEnclos(famId, personnageId));
  } catch (e) { handleError(e, res, next); }
}

export async function startBreeding(req: Request, res: Response, next: NextFunction) {
  try {
    const { familierAId, familierBId, mapId, dureeMinutes, personnageId } = breedSchema.parse(req.body);
    res.status(201).json(await familierService.startBreeding(familierAId, familierBId, mapId, dureeMinutes));
    void personnageId; // validation only
  } catch (e) { handleError(e, res, next); }
}

export async function collectBreeding(req: Request, res: Response, next: NextFunction) {
  try {
    const { assignmentId, personnageId } = breedCollectSchema.parse(req.body);
    res.json(await familierService.collectBreeding(assignmentId, personnageId));
  } catch (e) { handleError(e, res, next); }
}

export async function renameFamilier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req, res); if (id === null) return;
    const { personnageId, nom } = z.object({
      personnageId: z.number().int().positive(),
      nom: z.string().min(1).max(50),
    }).parse(req.body);
    res.json(await familierService.renameFamilier(id, personnageId, nom));
  } catch (e) { handleError(e, res, next); }
}
