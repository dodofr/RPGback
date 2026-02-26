import prisma from '../config/database';
import { CombatStatus } from '@prisma/client';
import { experienceForNextLevel, canLevelUp, statsPointsPerLevel } from '../utils/formulas';
import { spellService } from './spell.service';

export interface StatAllocation {
  force?: number;
  intelligence?: number;
  dexterite?: number;
  agilite?: number;
  vie?: number;
  chance?: number;
}

export class ProgressionService {
  /**
   * Distribute XP to all surviving player characters after a combat victory
   */
  async distributeXP(combatId: number): Promise<{ personnageId: number; xpGagne: number; levelUp: boolean; nouveauNiveau?: number }[]> {
    const combat = await prisma.combat.findUnique({
      where: { id: combatId },
      include: {
        entites: true,
      },
    });

    if (!combat || combat.status !== CombatStatus.TERMINE) {
      return [];
    }

    // Check if team 0 (players) won
    const team0Alive = combat.entites.filter((e) => e.equipe === 0 && e.pvActuels > 0);
    const team1Alive = combat.entites.filter((e) => e.equipe === 1 && e.pvActuels > 0);

    // Players lost or it's a draw
    if (team0Alive.length === 0 || team1Alive.length > 0) {
      return [];
    }

    // Calculate total XP from defeated enemies
    const defeatedEnemies = combat.entites.filter((e) => e.equipe === 1);

    // Calculate XP with level scaling
    let totalXP = 0;
    for (const enemy of defeatedEnemies) {
      if (enemy.monstreTemplateId && enemy.niveau) {
        const template = await prisma.monstreTemplate.findUnique({
          where: { id: enemy.monstreTemplateId },
        });
        if (template) {
          // XP scales proportionally with level: xpRecompense × (niveau / niveauBase)
          totalXP += Math.floor(template.xpRecompense * (enemy.niveau / template.niveauBase));
        } else {
          totalXP += 10;
        }
      } else {
        // Fallback: lookup by name
        const template = await prisma.monstreTemplate.findFirst({
          where: { nom: enemy.nom },
        });
        totalXP += template?.xpRecompense ?? 10;
      }
    }

    // Distribute XP equally among all player characters (alive and dead)
    const team0All = combat.entites.filter((e) => e.equipe === 0 && e.personnageId !== null && e.invocateurId === null);
    if (team0All.length === 0) return [];

    const xpPerCharacter = Math.floor(totalXP / team0All.length);
    const results: { personnageId: number; xpGagne: number; levelUp: boolean; nouveauNiveau?: number }[] = [];

    for (const entity of team0All) {
      if (entity.personnageId) {
        const result = await this.addXP(entity.personnageId, xpPerCharacter);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Add XP to a character and check for level-up
   */
  async addXP(personnageId: number, xp: number): Promise<{ personnageId: number; xpGagne: number; levelUp: boolean; nouveauNiveau?: number }> {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    const newExperience = personnage.experience + xp;
    let levelUp = false;
    let nouveauNiveau: number | undefined;

    // Update experience
    await prisma.personnage.update({
      where: { id: personnageId },
      data: { experience: newExperience },
    });

    // Check and apply level-up
    const levelUpResult = await this.checkAndApplyLevelUp(personnageId);
    if (levelUpResult) {
      levelUp = true;
      nouveauNiveau = levelUpResult.niveau;
    }

    return {
      personnageId,
      xpGagne: xp,
      levelUp,
      nouveauNiveau,
    };
  }

  /**
   * Check if character can level up and apply it
   */
  async checkAndApplyLevelUp(personnageId: number): Promise<{ niveau: number; pointsGagnes: number; sortsAppris: { sortId: number; nom: string }[] } | null> {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    if (!canLevelUp(personnage.niveau, personnage.experience)) {
      return null;
    }

    const newLevel = personnage.niveau + 1;
    const pointsGagnes = statsPointsPerLevel();

    await prisma.personnage.update({
      where: { id: personnageId },
      data: {
        niveau: newLevel,
        pointsStatsDisponibles: personnage.pointsStatsDisponibles + pointsGagnes,
      },
    });

    // Learn new spells available at this level
    const sortsAppris = await spellService.learnSpellsForLevel(personnageId, newLevel);

    // Recursively check if can level up again
    const nextLevelUp = await this.checkAndApplyLevelUp(personnageId);
    if (nextLevelUp) {
      return {
        ...nextLevelUp,
        sortsAppris: [...sortsAppris, ...nextLevelUp.sortsAppris],
      };
    }

    return { niveau: newLevel, pointsGagnes, sortsAppris };
  }

  /**
   * Allocate stat points to a character
   */
  async allocateStats(personnageId: number, stats: StatAllocation): Promise<{ success: boolean; remainingPoints: number }> {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    // Calculate total points to spend
    const totalPoints =
      (stats.force ?? 0) +
      (stats.intelligence ?? 0) +
      (stats.dexterite ?? 0) +
      (stats.agilite ?? 0) +
      (stats.vie ?? 0) +
      (stats.chance ?? 0);

    if (totalPoints <= 0) {
      throw new Error('No points to allocate');
    }

    if (totalPoints > personnage.pointsStatsDisponibles) {
      throw new Error(`Not enough stat points (need ${totalPoints}, have ${personnage.pointsStatsDisponibles})`);
    }

    // Apply stat increases
    await prisma.personnage.update({
      where: { id: personnageId },
      data: {
        force: personnage.force + (stats.force ?? 0),
        intelligence: personnage.intelligence + (stats.intelligence ?? 0),
        dexterite: personnage.dexterite + (stats.dexterite ?? 0),
        agilite: personnage.agilite + (stats.agilite ?? 0),
        vie: personnage.vie + (stats.vie ?? 0),
        chance: personnage.chance + (stats.chance ?? 0),
        pointsStatsDisponibles: personnage.pointsStatsDisponibles - totalPoints,
      },
    });

    return {
      success: true,
      remainingPoints: personnage.pointsStatsDisponibles - totalPoints,
    };
  }

  /**
   * Reset all allocated stat points back to base (10 per stat)
   */
  async resetStats(personnageId: number): Promise<{ success: boolean; pointsRecuperes: number }> {
    const personnage = await prisma.personnage.findUnique({ where: { id: personnageId } });
    if (!personnage) throw new Error('Character not found');

    const BASE = 10;
    const pointsRecuperes =
      (personnage.force - BASE) +
      (personnage.intelligence - BASE) +
      (personnage.dexterite - BASE) +
      (personnage.agilite - BASE) +
      (personnage.vie - BASE) +
      (personnage.chance - BASE);

    await prisma.personnage.update({
      where: { id: personnageId },
      data: {
        force: BASE,
        intelligence: BASE,
        dexterite: BASE,
        agilite: BASE,
        vie: BASE,
        chance: BASE,
        pointsStatsDisponibles: personnage.pointsStatsDisponibles + pointsRecuperes,
      },
    });

    return { success: true, pointsRecuperes };
  }

  /**
   * Get progression info for a character
   */
  async getProgressionInfo(personnageId: number) {
    const personnage = await prisma.personnage.findUnique({
      where: { id: personnageId },
    });

    if (!personnage) {
      throw new Error('Character not found');
    }

    const xpPourProchainNiveau = experienceForNextLevel(personnage.niveau);
    const xpManquant = Math.max(0, xpPourProchainNiveau - personnage.experience);

    return {
      niveau: personnage.niveau,
      experience: personnage.experience,
      xpPourProchainNiveau,
      xpManquant,
      pointsStatsDisponibles: personnage.pointsStatsDisponibles,
      peutMonterDeNiveau: personnage.experience >= xpPourProchainNiveau,
    };
  }
}

export const progressionService = new ProgressionService();
