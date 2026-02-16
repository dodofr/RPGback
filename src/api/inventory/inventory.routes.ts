import { Router } from 'express';
import { inventoryController } from './inventory.controller';

const router = Router();

// GET /api/characters/:id/inventory
router.get('/:id/inventory', (req, res, next) => inventoryController.getInventory(req, res, next));

// DELETE /api/characters/:id/inventory/items/:itemId
router.delete('/:id/inventory/items/:itemId', (req, res, next) => inventoryController.destroyItem(req, res, next));

// DELETE /api/characters/:id/inventory/resources/:ressourceId
router.delete('/:id/inventory/resources/:ressourceId', (req, res, next) => inventoryController.destroyResource(req, res, next));

// POST /api/characters/:id/inventory/equip/:itemId
router.post('/:id/inventory/equip/:itemId', (req, res, next) => inventoryController.equipItem(req, res, next));

// POST /api/characters/:id/inventory/unequip
router.post('/:id/inventory/unequip', (req, res, next) => inventoryController.unequipItem(req, res, next));

// POST /api/characters/:id/inventory/send
router.post('/:id/inventory/send', (req, res, next) => inventoryController.sendItems(req, res, next));

export default router;
