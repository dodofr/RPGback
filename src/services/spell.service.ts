import prisma from '../config/database';

export class SpellService {
  /**
   * Learn spells available at a given level for a character's race
   */
  async learnSpellsForLevel(personnageId: number, niveau: number): Promise<{ sortId: number; nom: string }[]> {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
      include: {
        race: true,
        sortsAppris: true,
      },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    // Get all spells for this race that can be learned at this level
    const availableSpells = await prisma.sort.findMany({
      where: {
        raceId: personnage.raceId,
        niveauApprentissage: { lte: niveau },
      },
    });

    // Filter out already learned spells
    const learnedSortIds = new Set(personnage.sortsAppris.map((s) => s.sortId));
    const newSpells = availableSpells.filter((s) => !learnedSortIds.has(s.id));

    // Learn new spells
    const learnedSpells: { sortId: number; nom: string }[] = [];
    for (const spell of newSpells) {
      await prisma.personnageSort.create({
        data: {
          personnageId,
          sortId: spell.id,
        },
      });
      learnedSpells.push({ sortId: spell.id, nom: spell.nom });
    }

    return learnedSpells;
  }

  /**
   * Get all learned spells for a character
   */
  async getLearnedSpells(personnageId: number) {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
      include: {
        sortsAppris: {
          include: {
            sort: {
              include: {
                zone: true,
                effets: {
                  include: {
                    effet: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    return personnage.sortsAppris.map((ps) => ps.sort);
  }

  /**
   * Check if a spell can be used (not on cooldown)
   */
  async canUseSpell(combatId: number, entiteId: number, sortId: number): Promise<{ canUse: boolean; reason?: string }> {
    const spell = await prisma.sort.findUnique({
      where: { id: sortId },
    });

    if (!spell) {
      return { canUse: false, reason: 'Spell not found' };
    }

    // If spell has no cooldown, it can always be used
    if (spell.cooldown === 0) {
      return { canUse: true };
    }

    // Check if on cooldown
    const cooldown = await prisma.sortCooldown.findUnique({
      where: {
        combatId_entiteId_sortId: {
          combatId,
          entiteId,
          sortId,
        },
      },
    });

    if (cooldown && cooldown.toursRestants > 0) {
      return { canUse: false, reason: `Spell on cooldown (${cooldown.toursRestants} turns remaining)` };
    }

    return { canUse: true };
  }

  /**
   * Apply cooldown after using a spell
   */
  async applyCooldown(combatId: number, entiteId: number, sortId: number): Promise<void> {
    const spell = await prisma.sort.findUnique({
      where: { id: sortId },
    });

    if (!spell || spell.cooldown === 0) {
      return;
    }

    await prisma.sortCooldown.upsert({
      where: {
        combatId_entiteId_sortId: {
          combatId,
          entiteId,
          sortId,
        },
      },
      update: {
        toursRestants: spell.cooldown,
      },
      create: {
        combatId,
        entiteId,
        sortId,
        toursRestants: spell.cooldown,
      },
    });
  }

  /**
   * Decrement all cooldowns at end of round
   */
  async decrementCooldowns(combatId: number): Promise<void> {
    // Decrement all cooldowns
    await prisma.sortCooldown.updateMany({
      where: { combatId },
      data: { toursRestants: { decrement: 1 } },
    });

    // Remove expired cooldowns
    await prisma.sortCooldown.deleteMany({
      where: {
        combatId,
        toursRestants: { lte: 0 },
      },
    });
  }

  /**
   * Decrement cooldowns for a single entity at the start of their turn
   */
  async decrementCooldownsForEntity(combatId: number, entiteId: number): Promise<void> {
    await prisma.sortCooldown.updateMany({
      where: { combatId, entiteId },
      data: { toursRestants: { decrement: 1 } },
    });

    await prisma.sortCooldown.deleteMany({
      where: { combatId, entiteId, toursRestants: { lte: 0 } },
    });
  }

  /**
   * Get all active cooldowns for an entity
   */
  async getCooldowns(combatId: number, entiteId: number) {
    return prisma.sortCooldown.findMany({
      where: {
        combatId,
        entiteId,
        toursRestants: { gt: 0 },
      },
      include: {
        sort: true,
      },
    });
  }
}

export const spellService = new SpellService();
