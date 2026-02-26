import { StatType, ZoneType } from '@prisma/client';
import prisma from '../../config/database';
import { randomInt } from '../../utils/random';
import { calculateStatMultiplier, getStatValue } from '../../utils/formulas';
import { applyEffect } from './effects';
import { addLog } from './combatLog';
import { getAffectedCells, getEntitiesInArea } from './aoe';

interface CasterStats {
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  vie: number;
  chance: number;
}

function formatEffetLog(effet: { type: string; statCiblee: string | null; valeur: number; valeurMin: number | null; duree: number }): string {
  if (effet.type === 'POISON') {
    return ` (${effet.valeurMin ?? effet.valeur}-${effet.valeur} dgts/tour, ${effet.duree} tours)`;
  }
  if ((effet.type === 'BUFF' || effet.type === 'DEBUFF') && effet.statCiblee) {
    return ` (${effet.valeur > 0 ? '+' : ''}${effet.valeur} ${effet.statCiblee}, ${effet.duree} tours)`;
  }
  return '';
}

/**
 * Crée une zone posée au sol (glyphe ou piège) à partir d'un sort.
 * Les dégâts sont pré-calculés avec les stats du poseur au moment du cast.
 * zoneTaille et zoneType définissent l'AoE au déclenchement.
 */
export async function createZone(
  combatId: number,
  poseurId: number,
  poseurEquipe: number,
  x: number,
  y: number,
  estPiege: boolean,
  toursRestants: number,
  degatsMin: number,
  degatsMax: number,
  statUtilisee: StatType,
  casterStats: CasterStats,
  zoneTaille: number = 0,
  zoneType: string = 'CASE',
  effetId?: number,
  coefficient: number = 1.0
): Promise<void> {
  const statValue = getStatValue(casterStats, statUtilisee);
  const multiplier = calculateStatMultiplier(statValue);

  const degatsMinFinal = Math.floor(degatsMin * multiplier * coefficient);
  const degatsMaxFinal = Math.floor(degatsMax * multiplier * coefficient);

  // Si un glyphe existe déjà sur cette case, on le remplace
  await prisma.zonePoseeCombat.deleteMany({
    where: { combatId, x, y, estPiege: false },
  });

  await prisma.zonePoseeCombat.create({
    data: {
      combatId,
      x,
      y,
      poseurId,
      poseurEquipe,
      estPiege,
      toursRestants,
      zoneTaille,
      zoneType,
      degatsMinFinal,
      degatsMaxFinal,
      statUtilisee,
      effetId: effetId ?? null,
    },
  });
}

/**
 * Applique les dégâts et effets d'une zone sur toutes les entités dans son AoE.
 * Retourne les IDs des entités tuées.
 */
async function applyZoneDamage(
  combatId: number,
  zone: { id: number; x: number; y: number; zoneType: string; zoneTaille: number; degatsMinFinal: number; degatsMaxFinal: number; effetId: number | null; poseurId: number },
  allEntities: { id: number; nom: string; pvActuels: number; pvMax: number; positionX: number; positionY: number }[],
  triggerEntityId: number,
  tour: number,
  isGlyphe: boolean
): Promise<number[]> {
  const grid = await prisma.combat.findUnique({
    where: { id: combatId },
    select: { grilleLargeur: true, grilleHauteur: true },
  });
  if (!grid) return [];

  const zoneConfig = {
    type: (zone.zoneType as ZoneType),
    taille: zone.zoneTaille,
  };
  const affectedCells = getAffectedCells({ x: zone.x, y: zone.y }, zoneConfig, { width: grid.grilleLargeur, height: grid.grilleHauteur });
  const targets = getEntitiesInArea(affectedCells, allEntities);

  const killed: number[] = [];
  const zoneName = isGlyphe ? 'glyphe' : 'piège';

  for (const target of targets) {
    // Refetch target (could have been updated by a previous target in same loop)
    const freshTarget = await prisma.combatEntite.findUnique({ where: { id: target.id } });
    if (!freshTarget || freshTarget.pvActuels <= 0) continue;

    const triggerVerb = freshTarget.id === triggerEntityId ? `déclenche un ${zoneName}` : `est dans la zone d'un ${zoneName}`;

    if (zone.degatsMinFinal > 0 || zone.degatsMaxFinal > 0) {
      const damage = randomInt(
        Math.min(zone.degatsMinFinal, zone.degatsMaxFinal),
        Math.max(zone.degatsMinFinal, zone.degatsMaxFinal)
      );
      const newPV = Math.max(0, freshTarget.pvActuels - damage);
      await prisma.combatEntite.update({
        where: { id: target.id },
        data: { pvActuels: newPV },
      });
      // Update in-memory for getEntitiesInArea filter
      const idx = allEntities.findIndex((e) => e.id === target.id);
      if (idx >= 0) allEntities[idx].pvActuels = newPV;

      await addLog(
        combatId,
        tour,
        `${freshTarget.nom} ${triggerVerb} et subit ${damage} dégâts (${newPV}/${freshTarget.pvMax} PV)`,
        'EFFET'
      );

      if (newPV <= 0) {
        await addLog(combatId, tour, `${freshTarget.nom} est mort du ${zoneName} !`, 'MORT');
        killed.push(target.id);
        continue; // Skip effect application for dead entities
      }

      // Apply secondary effect
      if (zone.effetId) {
        const poseurEntite = await prisma.combatEntite.findUnique({ where: { id: zone.poseurId } });
        await applyEffect(combatId, target.id, zone.effetId, poseurEntite?.id);
        const effet = await prisma.effet.findUnique({ where: { id: zone.effetId } });
        if (effet) {
          const desc = formatEffetLog(effet);
          await addLog(combatId, tour, `${freshTarget.nom} est affecté par : ${effet.nom}${desc}`, 'EFFET');
        }
      }
    } else if (zone.effetId) {
      // No damage but there is an effect — log the trigger then the effect
      await addLog(combatId, tour, `${freshTarget.nom} ${triggerVerb} !`, 'EFFET');
      const poseurEntite = await prisma.combatEntite.findUnique({ where: { id: zone.poseurId } });
      await applyEffect(combatId, target.id, zone.effetId, poseurEntite?.id);
      const effet = await prisma.effet.findUnique({ where: { id: zone.effetId } });
      if (effet) {
        const desc = formatEffetLog(effet);
        await addLog(combatId, tour, `${freshTarget.nom} est affecté par : ${effet.nom}${desc}`, 'EFFET');
      }
    }
  }

  return killed;
}

/**
 * Vérifie et déclenche les glyphes dont la zone couvre la position de l'entité au début de son tour.
 * Le glyphe reste après déclenchement.
 * Utilise l'AoE complète du glyphe pour toucher toutes les entités dans la zone.
 */
export async function triggerGlyphesForEntity(
  combatId: number,
  entiteId: number,
  posX: number,
  posY: number
): Promise<void> {
  const allGlyphes = await prisma.zonePoseeCombat.findMany({
    where: { combatId, estPiege: false },
  });

  if (allGlyphes.length === 0) return;

  const combat = await prisma.combat.findUnique({ where: { id: combatId } });
  if (!combat) return;

  const gridDims = { width: combat.grilleLargeur, height: combat.grilleHauteur };

  // Keep only glyphes whose zone covers the entity's position
  const glyphes = allGlyphes.filter(g => {
    const zoneConfig = { type: (g.zoneType as ZoneType), taille: g.zoneTaille };
    const cells = getAffectedCells({ x: g.x, y: g.y }, zoneConfig, gridDims);
    return cells.some(c => c.x === posX && c.y === posY);
  });

  if (glyphes.length === 0) return;

  const tour = combat.tourActuel;
  const allEntities = await prisma.combatEntite.findMany({ where: { combatId } });

  for (const glyphe of glyphes) {
    await applyZoneDamage(combatId, glyphe, allEntities, entiteId, tour, true);
  }
}

/**
 * Vérifie et déclenche les pièges dont la zone couvre la position où vient d'arriver l'entité.
 * Le piège est détruit après déclenchement (one-shot).
 * Utilise l'AoE complète du piège pour toucher toutes les entités dans la zone.
 */
export async function triggerPiegesForEntity(
  combatId: number,
  entiteId: number,
  posX: number,
  posY: number
): Promise<void> {
  const allPieges = await prisma.zonePoseeCombat.findMany({
    where: { combatId, estPiege: true },
  });

  if (allPieges.length === 0) return;

  const combat = await prisma.combat.findUnique({ where: { id: combatId } });
  if (!combat) return;

  const gridDims = { width: combat.grilleLargeur, height: combat.grilleHauteur };

  // Keep only pieges whose zone covers the entity's new position
  const pieges = allPieges.filter(p => {
    const zoneConfig = { type: (p.zoneType as ZoneType), taille: p.zoneTaille };
    const cells = getAffectedCells({ x: p.x, y: p.y }, zoneConfig, gridDims);
    return cells.some(c => c.x === posX && c.y === posY);
  });

  if (pieges.length === 0) return;

  const tour = combat.tourActuel;
  const allEntities = await prisma.combatEntite.findMany({ where: { combatId } });

  for (const piege of pieges) {
    // Le piège est détruit immédiatement (one-shot)
    await prisma.zonePoseeCombat.delete({ where: { id: piege.id } });

    await applyZoneDamage(combatId, piege, allEntities, entiteId, tour, false);
  }
}

/**
 * Décrémente la durée de toutes les zones actives et supprime celles expirées.
 * Appelé en début de nouveau tour (isNewRound).
 */
export async function decrementZones(combatId: number): Promise<void> {
  await prisma.zonePoseeCombat.updateMany({
    where: { combatId },
    data: { toursRestants: { decrement: 1 } },
  });

  await prisma.zonePoseeCombat.deleteMany({
    where: { combatId, toursRestants: { lte: 0 } },
  });
}

/**
 * Supprime toutes les zones posées d'un combat (fin de combat ou fuite).
 */
export async function cleanupZones(combatId: number): Promise<void> {
  await prisma.zonePoseeCombat.deleteMany({ where: { combatId } });
}
