import { Router } from 'express';
import * as c from './familier.controller';

// ==================== ADMIN: FAMILLES ====================
export const familleRouter = Router();

familleRouter.get('/', c.getAllFamilles);
familleRouter.get('/:id', c.getFamilleById);
familleRouter.post('/', c.createFamille);
familleRouter.patch('/:id', c.updateFamille);
familleRouter.delete('/:id', c.deleteFamille);

// ==================== ADMIN: CROISEMENTS ====================
export const croisementRouter = Router();

// GET  /api/familier-croisements          → liste tous
// GET  /api/familier-croisements?raceAId=X&raceBId=Y  → filtre par paire
croisementRouter.get('/', c.getAllCroisements);
// POST /api/familier-croisements          → créer (raceAId+raceBId+raceEnfantId dans le body)
croisementRouter.post('/', c.createCroisement);
// PATCH /api/familier-croisements/:id     → modifier la probabilité
croisementRouter.patch('/:id', c.updateCroisement);
// DELETE /api/familier-croisements/:id   → supprimer
croisementRouter.delete('/:id', c.deleteCroisementById);

// ==================== ADMIN: RACES ====================
export const raceRouter = Router();

raceRouter.get('/', c.getAllRaces);
raceRouter.get('/:id', c.getRaceById);
raceRouter.post('/', c.createRace);
raceRouter.patch('/:id', c.updateRace);
raceRouter.delete('/:id', c.deleteRace);
raceRouter.post('/:id/croisements', c.addCroisement);
raceRouter.delete('/:id/croisements/:croisementId', c.deleteCroisement);

// ==================== PLAYER: FAMILIERS ====================
export const familierRouter = Router();

// Routes fixes AVANT les routes paramétrées
// POST /api/familiers/breed/collect  (avant /breed et avant /:id/collect)
familierRouter.post('/breed/collect', c.collectBreeding);
// POST /api/familiers/breed
familierRouter.post('/breed', c.startBreeding);

// Routes paramétrées
// POST /api/familiers/:id/deposit
familierRouter.post('/:id/deposit', c.depositFamilier);
// POST /api/familiers/:id/collect
familierRouter.post('/:id/collect', c.collectFamilier);
// PATCH /api/familiers/:id  (rename)
familierRouter.patch('/:id', c.renameFamilier);

// ==================== CHARACTER SUB-ROUTES ====================
// Mounted at /api/characters (same pattern as inventory)
export const characterFamilierRouter = Router();

// GET /api/characters/:id/familiers
characterFamilierRouter.get('/:id/familiers', c.getFamiliersByCharacter);
// POST /api/characters/:id/familiers/unequip  (must be before /:fId/equip)
characterFamilierRouter.post('/:id/familiers/unequip', c.unequipFamilier);
// POST /api/characters/:id/familiers/:fId/equip
characterFamilierRouter.post('/:id/familiers/:fId/equip', c.equipFamilier);
