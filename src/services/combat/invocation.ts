import prisma from '../../config/database';
import { CombatStatus } from '@prisma/client';
import { calculatePV } from '../../utils/formulas';

export interface InvocationTemplate {
  nom: string;
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  vie: number;
  chance: number;
  pvMax?: number;
  paMax?: number;
  pmMax?: number;
}

/**
 * Create an invocation in combat
 */
export async function createInvocation(
  combatId: number,
  invocateurId: number,
  template: InvocationTemplate,
  x: number,
  y: number
): Promise<number> {
  const combat = await prisma.combat.findUnique({
    where: { id: combatId },
    include: {
      entites: true,
    },
  });

  if (!combat || combat.status !== CombatStatus.EN_COURS) {
    throw new Error('Combat not found or not in progress');
  }

  const invoker = combat.entites.find((e) => e.id === invocateurId);
  if (!invoker || invoker.pvActuels <= 0) {
    throw new Error('Invoker not found or dead');
  }

  // Check if position is valid (in bounds, not an obstacle, not occupied)
  if (x < 0 || x >= combat.grilleLargeur || y < 0 || y >= combat.grilleHauteur) {
    throw new Error('Position out of bounds');
  }

  const obstacle = await prisma.combatCase.findFirst({
    where: { combatId, x, y, bloqueDeplacement: true },
  });
  if (obstacle) {
    throw new Error('Position is blocked by an obstacle');
  }

  const occupant = combat.entites.find(
    (e) => e.positionX === x && e.positionY === y && e.pvActuels > 0
  );
  if (occupant) {
    throw new Error('Position is occupied');
  }

  // Calculate stats
  const pvMax = template.pvMax ?? calculatePV(template.vie);
  const paMax = template.paMax ?? 6;
  const pmMax = template.pmMax ?? 3;

  // Calculate initiative (invocations play right after invoker)
  const invokerOrdre = invoker.ordreJeu;

  // Create the invocation
  const invocation = await prisma.combatEntite.create({
    data: {
      combatId,
      personnageId: null,
      nom: template.nom,
      equipe: invoker.equipe,
      positionX: x,
      positionY: y,
      initiative: invoker.initiative - 1, // Slightly lower initiative
      ordreJeu: invokerOrdre + 0.5, // Will be reordered to play after invoker
      pvMax,
      pvActuels: pvMax,
      paMax,
      paActuels: paMax,
      pmMax,
      pmActuels: pmMax,
      force: template.force,
      intelligence: template.intelligence,
      dexterite: template.dexterite,
      agilite: template.agilite,
      vie: template.vie,
      chance: template.chance,
      invocateurId,
    },
  });

  // Reorder all entities to ensure invocations play after their invoker
  await reorderInitiative(combatId);

  return invocation.id;
}

/**
 * Kill all invocations of a specific invoker
 */
export async function killInvocationsOf(combatId: number, invocateurId: number): Promise<number[]> {
  const invocations = await prisma.combatEntite.findMany({
    where: {
      combatId,
      invocateurId,
      pvActuels: { gt: 0 },
    },
  });

  const killedIds: number[] = [];

  for (const invocation of invocations) {
    await prisma.combatEntite.update({
      where: { id: invocation.id },
      data: { pvActuels: 0 },
    });
    killedIds.push(invocation.id);
  }

  return killedIds;
}

/**
 * Reorder initiative so invocations play right after their invoker
 */
async function reorderInitiative(combatId: number): Promise<void> {
  const entities = await prisma.combatEntite.findMany({
    where: { combatId },
    orderBy: [{ initiative: 'desc' }, { id: 'asc' }],
  });

  // Group entities: regular entities first, then their invocations
  const orderedEntities: typeof entities = [];
  const processedIds = new Set<number>();

  for (const entity of entities) {
    if (processedIds.has(entity.id)) continue;

    // Add the entity
    orderedEntities.push(entity);
    processedIds.add(entity.id);

    // Add its invocations right after
    const invocations = entities.filter(
      (e) => e.invocateurId === entity.id && !processedIds.has(e.id)
    );
    for (const inv of invocations) {
      orderedEntities.push(inv);
      processedIds.add(inv.id);
    }
  }

  // Update ordreJeu for all entities
  for (let i = 0; i < orderedEntities.length; i++) {
    await prisma.combatEntite.update({
      where: { id: orderedEntities[i].id },
      data: { ordreJeu: i + 1 },
    });
  }
}

/**
 * Get all invocations of an invoker
 */
export async function getInvocations(combatId: number, invocateurId: number) {
  return prisma.combatEntite.findMany({
    where: {
      combatId,
      invocateurId,
    },
  });
}
