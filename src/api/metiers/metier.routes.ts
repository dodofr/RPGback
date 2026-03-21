import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { metierService } from '../../services/metier.service';

const router = Router();

// ── Métiers CRUD ──────────────────────────────────────────────────────────

// GET /api/metiers
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await metierService.getAll());
  } catch (error) { next(error); }
});

// GET /api/metiers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const metier = await metierService.getById(id);
    if (!metier) { res.status(404).json({ error: 'Metier not found' }); return; }
    res.json(metier);
  } catch (error) { next(error); }
});

// POST /api/metiers
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nom: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['RECOLTE', 'CRAFT']).optional(),
    });
    const data = schema.parse(req.body);
    res.status(201).json(await metierService.create(data));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/metiers/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      description: z.string().optional(),
      type: z.enum(['RECOLTE', 'CRAFT']).optional(),
    });
    const data = schema.parse(req.body);
    res.json(await metierService.update(id, data));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/metiers/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await metierService.delete(id);
    res.status(204).send();
  } catch (error) { next(error); }
});

// ── Noeuds de récolte ─────────────────────────────────────────────────────

// POST /api/metiers/:id/noeuds
router.post('/:id/noeuds', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metierId = parseInt(req.params.id, 10);
    if (isNaN(metierId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1),
      imageUrl: z.string().optional(),
      niveauMinAcces: z.number().int().min(1).optional(),
      xpRecolte: z.number().int().min(0).default(10),
    });
    const data = schema.parse(req.body);
    res.status(201).json(await metierService.createNoeud({ ...data, metierId }));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/metiers/noeuds/:noeudId
router.patch('/noeuds/:noeudId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.noeudId, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      imageUrl: z.string().nullable().optional(),
      niveauMinAcces: z.number().int().min(1).optional(),
      xpRecolte: z.number().int().min(0).optional(),
    });
    const data = schema.parse(req.body);
    res.json(await metierService.updateNoeud(id, data));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/metiers/noeuds/:noeudId
router.delete('/noeuds/:noeudId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.noeudId, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await metierService.deleteNoeud(id);
    res.status(204).send();
  } catch (error) { next(error); }
});

// ── Table de loot ─────────────────────────────────────────────────────────

// POST /api/metiers/noeuds/:noeudId/ressources
router.post('/noeuds/:noeudId/ressources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const noeudId = parseInt(req.params.noeudId, 10);
    if (isNaN(noeudId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      niveauRequis: z.number().int().min(1),
      ressourceId: z.number().int().positive(),
      quantiteMin: z.number().int().min(0),
      quantiteMax: z.number().int().min(1),
      tauxDrop: z.number().min(0).max(1).default(1.0),
    });
    const data = schema.parse(req.body);
    res.status(201).json(await metierService.addNoeudRessource({ ...data, noeudId }));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/metiers/noeuds/ressources/:id
router.patch('/noeuds/ressources/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      niveauRequis: z.number().int().min(1).optional(),
      quantiteMin: z.number().int().min(0).optional(),
      quantiteMax: z.number().int().min(1).optional(),
      tauxDrop: z.number().min(0).max(1).optional(),
    });
    const data = schema.parse(req.body);
    res.json(await metierService.updateNoeudRessource(id, data));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/metiers/noeuds/ressources/:id
router.delete('/noeuds/ressources/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await metierService.deleteNoeudRessource(id);
    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
