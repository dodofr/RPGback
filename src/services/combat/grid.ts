import prisma from '../../config/database';

export interface CombatCaseState {
  x: number;
  y: number;
  bloqueDeplacement: boolean;
  bloqueLigneDeVue: boolean;
}

/**
 * Load a grid template's obstacles into a combat instance
 */
export async function loadGridTemplate(
  combatId: number,
  grille: {
    cases: { x: number; y: number; bloqueDeplacement: boolean; bloqueLigneDeVue: boolean }[];
  }
): Promise<CombatCaseState[]> {
  const obstacles = grille.cases.filter(c => c.bloqueDeplacement || c.bloqueLigneDeVue);

  if (obstacles.length > 0) {
    await prisma.combatCase.createMany({
      data: obstacles.map((o) => ({
        combatId,
        x: o.x,
        y: o.y,
        bloqueDeplacement: o.bloqueDeplacement,
        bloqueLigneDeVue: o.bloqueLigneDeVue,
      })),
    });
  }

  return obstacles.map((o) => ({
    x: o.x,
    y: o.y,
    bloqueDeplacement: o.bloqueDeplacement,
    bloqueLigneDeVue: o.bloqueLigneDeVue,
  }));
}

/**
 * Get all cases for a combat
 */
export async function getCombatCases(combatId: number): Promise<CombatCaseState[]> {
  const cases = await prisma.combatCase.findMany({
    where: { combatId },
  });

  return cases.map((c) => ({
    x: c.x,
    y: c.y,
    bloqueDeplacement: c.bloqueDeplacement,
    bloqueLigneDeVue: c.bloqueLigneDeVue,
  }));
}

/**
 * Check if a position is blocked for movement
 */
export function isBlockedForMovement(x: number, y: number, cases: CombatCaseState[]): boolean {
  return cases.some((c) => c.x === x && c.y === y && c.bloqueDeplacement);
}

/**
 * Check if a position is blocked for line of sight
 */
export function isBlockedForLOS(x: number, y: number, cases: CombatCaseState[]): boolean {
  return cases.some((c) => c.x === x && c.y === y && c.bloqueLigneDeVue);
}
