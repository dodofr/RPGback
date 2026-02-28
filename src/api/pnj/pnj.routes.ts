import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pnjService } from '../../services/pnj.service';

const router = Router();

// ============================================================
// Admin CRUD
// ============================================================

// GET /api/pnj
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjs = await pnjService.getAll();
    res.json(pnjs);
  } catch (error) { next(error); }
});

// GET /api/pnj/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const pnj = await pnjService.getById(id);
    if (!pnj) { res.status(404).json({ error: 'PNJ not found' }); return; }
    res.json(pnj);
  } catch (error) { next(error); }
});

// POST /api/pnj
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nom: z.string().min(1),
      mapId: z.number().int().positive(),
      positionX: z.number().int().min(0),
      positionY: z.number().int().min(0),
      description: z.string().nullable().optional(),
      estMarchand: z.boolean().default(true),
    });
    const data = schema.parse(req.body);
    const pnj = await pnjService.create(data);
    res.status(201).json(pnj);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/pnj/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      nom: z.string().min(1).optional(),
      mapId: z.number().int().positive().optional(),
      positionX: z.number().int().min(0).optional(),
      positionY: z.number().int().min(0).optional(),
      description: z.string().nullable().optional(),
      estMarchand: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await pnjService.getById(id);
    if (!existing) { res.status(404).json({ error: 'PNJ not found' }); return; }
    const pnj = await pnjService.update(id, data);
    res.json(pnj);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/pnj/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const existing = await pnjService.getById(id);
    if (!existing) { res.status(404).json({ error: 'PNJ not found' }); return; }
    await pnjService.delete(id);
    res.status(204).send();
  } catch (error) { next(error); }
});

// ============================================================
// Lignes
// ============================================================

// POST /api/pnj/:id/lignes
router.post('/:id/lignes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      equipementId: z.number().int().positive().nullable().optional(),
      ressourceId: z.number().int().positive().nullable().optional(),
      prixMarchand: z.number().int().min(0).nullable().optional(),
      prixRachat: z.number().int().min(0).nullable().optional(),
    });
    const data = schema.parse(req.body);
    const ligne = await pnjService.addLigne(pnjId, data);
    res.status(201).json(ligne);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) { res.status(400).json({ error: error.message }); return; }
    next(error);
  }
});

// PATCH /api/pnj/:id/lignes/:ligneId
router.patch('/:id/lignes/:ligneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ligneId = parseInt(req.params.ligneId, 10);
    if (isNaN(ligneId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      prixMarchand: z.number().int().min(0).nullable().optional(),
      prixRachat: z.number().int().min(0).nullable().optional(),
    });
    const data = schema.parse(req.body);
    const ligne = await pnjService.updateLigne(ligneId, data);
    res.json(ligne);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/pnj/:id/lignes/:ligneId
router.delete('/:id/lignes/:ligneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ligneId = parseInt(req.params.ligneId, 10);
    if (isNaN(ligneId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await pnjService.deleteLigne(ligneId);
    res.status(204).send();
  } catch (error) { next(error); }
});

// ============================================================
// Gameplay: achat/vente
// ============================================================

// POST /api/pnj/:id/buy
router.post('/:id/buy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      personnageId: z.number().int().positive(),
      ligneId: z.number().int().positive(),
      quantite: z.number().int().min(1).default(1),
    });
    const data = schema.parse(req.body);
    const result = await pnjService.buyFromMerchant(pnjId, data.personnageId, data.ligneId, data.quantite);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      const notFoundMsgs = ['PNJ not found', 'Ligne not found', 'Character not found'];
      if (notFoundMsgs.includes(error.message)) { res.status(404).json({ error: error.message }); return; }
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// POST /api/pnj/:id/sell
router.post('/:id/sell', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      personnageId: z.number().int().positive(),
      ligneId: z.number().int().positive(),
      quantite: z.number().int().min(1).default(1),
      itemId: z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);
    const result = await pnjService.sellToMerchant(pnjId, data.personnageId, data.ligneId, data.quantite, data.itemId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      const notFoundMsgs = ['PNJ not found', 'Ligne not found', 'Character not found', 'Item not found in inventory'];
      if (notFoundMsgs.includes(error.message)) { res.status(404).json({ error: error.message }); return; }
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
