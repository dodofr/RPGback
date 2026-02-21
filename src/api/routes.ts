import { Router } from 'express';
import playerRoutes from './players/player.routes';
import characterRoutes from './characters/character.routes';
import groupRoutes from './groups/group.routes';
import combatRoutes from './combat/combat.routes';
import staticRoutes from './static/static.routes';
import mapRoutes from './maps/map.routes';
import donjonRoutes from './donjons/donjon.routes';

import inventoryRoutes from './inventory/inventory.routes';
import craftRoutes from './craft/craft.routes';

const router = Router();

// Mount routes
router.use('/players', playerRoutes);
router.use('/characters', characterRoutes);
router.use('/characters', inventoryRoutes); // /characters/:id/inventory/*
router.use('/groups', groupRoutes);
router.use('/combats', combatRoutes);

// World & Maps routes
router.use('/regions', mapRoutes.regions);
router.use('/maps', mapRoutes.maps);
router.use('/monstres', mapRoutes.monstres);

// Dungeon routes
router.use('/donjons', donjonRoutes);

// Craft routes
router.use('/recipes', craftRoutes);

// Static data routes
router.use('/races', staticRoutes.races);
router.use('/spells', staticRoutes.spells);
router.use('/equipment', staticRoutes.equipment);
router.use('/effects', staticRoutes.effects);
router.use('/zones', staticRoutes.zones);
router.use('/resources', staticRoutes.resources);
router.use('/sets', staticRoutes.sets);
router.use('/admin/recipes', staticRoutes.recipes);

export default router;
