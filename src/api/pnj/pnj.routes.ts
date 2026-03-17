import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pnjService } from '../../services/pnj.service';
import { questService } from '../../services/quest.service';
import { QueteEtapeType, QueteStatut } from '@prisma/client';
import prisma from '../../config/database';

const router = Router();

// ============================================================
// Admin CRUD
// ============================================================

// GET /api/pnj/map-status?mapId=X&personnageIds=1,2,3
// MUST be before GET /:id
router.get('/map-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      mapId: z.string().transform(v => parseInt(v, 10)),
      personnageIds: z.string().transform(s => s.split(',').map(Number)),
    });
    const { mapId, personnageIds } = schema.parse(req.query);
    if (isNaN(mapId) || personnageIds.some(isNaN)) {
      res.status(400).json({ error: 'Invalid parameters' }); return;
    }

    const [pnjs, personnages, allQP] = await Promise.all([
      prisma.pNJ.findMany({
        where: { mapId },
        select: {
          id: true,
          quetesDepart: {
            select: { id: true, niveauRequis: true, prerequis: { select: { prerequisId: true } } },
          },
          quetesEtapes: {
            select: { id: true, queteId: true, ordre: true, type: true, pnjId: true },
          },
        },
      }),
      prisma.personnage.findMany({
        where: { id: { in: personnageIds } },
        select: { id: true, niveau: true },
      }),
      prisma.quetePersonnage.findMany({
        where: { personnageId: { in: personnageIds } },
        select: { personnageId: true, queteId: true, statut: true, etapeActuelle: true },
      }),
    ]);

    const result = pnjs.map(pnj => {
      let hasAvailable = false;
      let hasPending = false;

      for (const perso of personnages) {
        const qpForPerso = allQP.filter(qp => qp.personnageId === perso.id);
        const acceptedIds = new Set(qpForPerso.map(qp => qp.queteId));
        const completedIds = new Set(qpForPerso.filter(qp => qp.statut === 'TERMINEE').map(qp => qp.queteId));

        // Check available quests
        for (const q of pnj.quetesDepart) {
          if (q.niveauRequis > perso.niveau) continue;
          if (acceptedIds.has(q.id)) continue;
          if ((q as any).prerequis?.some((p: any) => !completedIds.has(p.prerequisId))) continue;
          hasAvailable = true;
          break;
        }

        // Check pending steps (manual types at this PNJ)
        for (const qp of qpForPerso) {
          if (qp.statut !== QueteStatut.EN_COURS) continue;
          const etape = pnj.quetesEtapes.find(
            e => e.queteId === qp.queteId && e.ordre === qp.etapeActuelle && e.pnjId === pnj.id &&
            (e.type === QueteEtapeType.PARLER_PNJ || e.type === QueteEtapeType.APPORTER_RESSOURCE || e.type === QueteEtapeType.APPORTER_EQUIPEMENT)
          );
          if (etape) { hasPending = true; break; }
        }

        if (hasAvailable && hasPending) break;
      }

      return { pnjId: pnj.id, hasAvailable, hasPending };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

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
      imageUrl: z.string().nullable().optional(),
      spriteScale: z.number().optional(),
      spriteOffsetX: z.number().optional(),
      spriteOffsetY: z.number().optional(),
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
// Dialogues
// ============================================================

const dialogueSchema = z.object({
  type: z.enum(['ACCUEIL', 'SANS_INTERACTION']),
  texte: z.string().min(1),
  ordre: z.number().int().min(0).optional(),
  queteId: z.number().int().positive().nullable().optional(),
  etapeOrdre: z.number().int().positive().nullable().optional(),
});

// POST /api/pnj/:id/dialogues
router.post('/:id/dialogues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = dialogueSchema.parse(req.body);
    const dialogue = await pnjService.addDialogue(pnjId, data);
    res.status(201).json(dialogue);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// PATCH /api/pnj/:id/dialogues/:dialogueId
router.patch('/:id/dialogues/:dialogueId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dialogueId = parseInt(req.params.dialogueId, 10);
    if (isNaN(dialogueId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = dialogueSchema.partial().parse(req.body);
    const dialogue = await pnjService.updateDialogue(dialogueId, data);
    res.json(dialogue);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    next(error);
  }
});

// DELETE /api/pnj/:id/dialogues/:dialogueId
router.delete('/:id/dialogues/:dialogueId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dialogueId = parseInt(req.params.dialogueId, 10);
    if (isNaN(dialogueId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await pnjService.deleteDialogue(dialogueId);
    res.status(204).send();
  } catch (error) { next(error); }
});

// ============================================================
// Gameplay: quêtes
// ============================================================

// POST /api/pnj/:id/interact
router.post('/:id/interact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({ personnageId: z.number().int().positive() });
    const { personnageId } = schema.parse(req.body);
    const result = await questService.interactWithPnj(personnageId, pnjId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'PNJ not found' || error.message === 'Character not found') { res.status(404).json({ error: error.message }); return; }
      res.status(400).json({ error: error.message }); return;
    }
    next(error);
  }
});

// POST /api/pnj/:id/accept-quest
router.post('/:id/accept-quest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      personnageId: z.number().int().positive(),
      queteId: z.number().int().positive(),
    });
    const { personnageId, queteId } = schema.parse(req.body);
    const qp = await questService.acceptQuest(personnageId, queteId);
    res.status(201).json({ quetePersonnage: qp });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'Character not found' || error.message === 'Quest not found') { res.status(404).json({ error: error.message }); return; }
      res.status(400).json({ error: error.message }); return;
    }
    next(error);
  }
});

// POST /api/pnj/:id/advance-quest
router.post('/:id/advance-quest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pnjId = parseInt(req.params.id, 10);
    if (isNaN(pnjId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const schema = z.object({
      personnageId: z.number().int().positive(),
      quetePersonnageId: z.number().int().positive(),
    });
    const { personnageId, quetePersonnageId } = schema.parse(req.body);
    const result = await questService.advancePnjStep(personnageId, quetePersonnageId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Validation error', details: error.errors }); return; }
    if (error instanceof Error) {
      if (error.message === 'Quest progress not found') { res.status(404).json({ error: error.message }); return; }
      res.status(400).json({ error: error.message }); return;
    }
    next(error);
  }
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
