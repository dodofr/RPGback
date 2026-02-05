import { Router } from 'express';
import playerRoutes from './players/player.routes';
import characterRoutes from './characters/character.routes';
import groupRoutes from './groups/group.routes';
import combatRoutes from './combat/combat.routes';
import staticRoutes from './static/static.routes';
import mapRoutes from './maps/map.routes';
import donjonRoutes from './donjons/donjon.routes';
import grilleRoutes from './grilles/grille.routes';

const router = Router();

// Mount routes
router.use('/players', playerRoutes);
router.use('/characters', characterRoutes);
router.use('/groups', groupRoutes);
router.use('/combats', combatRoutes);

// World & Maps routes
router.use('/regions', mapRoutes.regions);
router.use('/maps', mapRoutes.maps);
router.use('/monstres', mapRoutes.monstres);

// Combat grids
router.use('/grilles', grilleRoutes);

// Dungeon routes
router.use('/donjons', donjonRoutes);

// Static data routes
router.use('/races', staticRoutes.races);
router.use('/spells', staticRoutes.spells);
router.use('/equipment', staticRoutes.equipment);
router.use('/effects', staticRoutes.effects);
router.use('/zones', staticRoutes.zones);

export default router;
