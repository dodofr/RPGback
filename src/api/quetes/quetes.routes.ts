import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { questService } from '../../services/quest.service';
import { QueteEtapeType } from '@prisma/client';

const router = Router();

// GET /api/quetes
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const quetes = await questService.getAllQuests();
    res.json(quetes);
  } catch (error) { next(error); }
});

// GET /api/quetes/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const quete = await questService.getQuestById(id);
    if (!quete) { res.status(404).json({ error: 'Quest not found' }); return; }
    res.json(quete);
  } catch (error) { next(error); }
});

// POST /api/quetes
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nom: z.string().min(1),
      description: z.string().optional(),
      niveauRequis: z.number().int().min(1).default(1),
      pnjDepartId: z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);
    const quete = await questService.createQuest(data);
    res.status(201).json(quete);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/quetes/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      niveauRequis: z.number().int().min(1).optional(),
      pnjDepartId: z.number().int().positive().nullable().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await questService.getQuestById(id);
    if (!existing) { res.status(404).json({ error: 'Quest not found' }); return; }
    const quete = await questService.updateQuest(id, data);
    res.json(quete);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/quetes/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const existing = await questService.getQuestById(id);
    if (!existing) { res.status(404).json({ error: 'Quest not found' }); return; }
    await questService.deleteQuest(id);
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST /api/quetes/:id/etapes
router.post('/:id/etapes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queteId = parseInt(req.params.id, 10);
    if (isNaN(queteId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      ordre: z.number().int().min(1),
      description: z.string().min(1),
      type: z.nativeEnum(QueteEtapeType),
      pnjId: z.number().int().positive().optional(),
      monstreTemplateId: z.number().int().positive().optional(),
      quantite: z.number().int().min(1).optional(),
      ressourceId: z.number().int().positive().nullable().optional(),
      equipementId: z.number().int().positive().nullable().optional(),
    });
    const data = schema.parse(req.body);
    const etape = await questService.addEtape(queteId, data);
    res.status(201).json(etape);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/quetes/:id/etapes/:etapeId
router.patch('/:id/etapes/:etapeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const etapeId = parseInt(req.params.etapeId, 10);
    if (isNaN(etapeId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      ordre: z.number().int().min(1).optional(),
      description: z.string().min(1).optional(),
      type: z.nativeEnum(QueteEtapeType).optional(),
      pnjId: z.number().int().positive().nullable().optional(),
      monstreTemplateId: z.number().int().positive().nullable().optional(),
      quantite: z.number().int().min(1).nullable().optional(),
      ressourceId: z.number().int().positive().nullable().optional(),
      equipementId: z.number().int().positive().nullable().optional(),
    });
    const data = schema.parse(req.body);
    const etape = await questService.updateEtape(etapeId, data);
    res.json(etape);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/quetes/:id/etapes/:etapeId
router.delete('/:id/etapes/:etapeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const etapeId = parseInt(req.params.etapeId, 10);
    if (isNaN(etapeId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await questService.deleteEtape(etapeId);
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST /api/quetes/:id/recompenses
router.post('/:id/recompenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queteId = parseInt(req.params.id, 10);
    if (isNaN(queteId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      xp: z.number().int().min(0).default(0),
      or: z.number().int().min(0).default(0),
      ressourceId: z.number().int().positive().optional(),
      quantiteRessource: z.number().int().min(1).optional(),
      equipementId: z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);
    const recompense = await questService.addRecompense(queteId, data);
    res.status(201).json(recompense);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/quetes/:id/recompenses/:recompenseId
router.delete('/:id/recompenses/:recompenseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recompenseId = parseInt(req.params.recompenseId, 10);
    if (isNaN(recompenseId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await questService.deleteRecompense(recompenseId);
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST /api/quetes/:id/prerequis
router.post('/:id/prerequis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queteId = parseInt(req.params.id, 10);
    if (isNaN(queteId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({ prerequisQueteId: z.number().int().positive() });
    const { prerequisQueteId } = schema.parse(req.body);
    await questService.addPrerequisite(queteId, prerequisQueteId);
    res.status(201).json({ queteId, prerequisId: prerequisQueteId });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if ((error as any)?.code === 'P2002') { res.status(400).json({ error: 'Prérequis déjà ajouté' }); return; }
    if (error instanceof Error && error.message.includes('propre prérequis')) { res.status(400).json({ error: error.message }); return; }
    next(error);
  }
});

// DELETE /api/quetes/:id/prerequis/:prerequisId
router.delete('/:id/prerequis/:prerequisId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queteId = parseInt(req.params.id, 10);
    const prerequisId = parseInt(req.params.prerequisId, 10);
    if (isNaN(queteId) || isNaN(prerequisId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await questService.removePrerequisite(queteId, prerequisId);
    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
