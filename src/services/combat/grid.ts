import prisma from '../../config/database';

export interface CombatCaseState {
  x: number;
  y: number;
  bloqueDeplacement: boolean;
  bloqueLigneDeVue: boolean;
}

export interface MapCaseRaw {
  x: number;
  y: number;
  bloqueDeplacement: boolean;
  bloqueLigneDeVue: boolean;
  estExclue: boolean;
}

/**
 * Load map cases (obstacles + excluded zones) into a combat instance.
 * Cases with estExclue=true are treated as fully blocking (movement + LOS).
 */
export async function loadGridTemplate(
  combatId: number,
  mapCases: MapCaseRaw[]
): Promise<CombatCaseState[]> {
  // Normalize: excluded cases become fully blocking
  const obstacles = mapCases
    .filter(c => c.bloqueDeplacement || c.bloqueLigneDeVue || c.estExclue)
    .map(c => ({
      x: c.x,
      y: c.y,
      bloqueDeplacement: c.estExclue ? true : c.bloqueDeplacement,
      bloqueLigneDeVue: c.estExclue ? true : c.bloqueLigneDeVue,
    }));

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
