import { CombatLogType } from '@prisma/client';
import prisma from '../../config/database';

export async function addLog(
  combatId: number,
  tour: number,
  message: string,
  type: CombatLogType
): Promise<void> {
  await prisma.combatLog.create({
    data: { combatId, tour, message, type },
  });
}

export async function getLogsForCombat(combatId: number) {
  return prisma.combatLog.findMany({
    where: { combatId },
    orderBy: { id: 'asc' },
  });
}
