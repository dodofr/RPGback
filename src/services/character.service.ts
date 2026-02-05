import prisma from '../config/database';
import { CreateCharacterRequest, CharacterEquipment, TotalStats } from '../types';
import { calculatePV, calculateBasePA, calculateBasePM, calculateBasePO } from '../utils/formulas';
import { progressionService, StatAllocation } from './progression.service';
import { spellService } from './spell.service';

export class CharacterService {
  async create(data: CreateCharacterRequest) {
    // Get race for bonus stats
    const race = await prisma.race.findUnique({
      where: { id: data.raceId },
    });

    if (!race) {
      throw new Error('Race not found');
    }

    // Default base stats (can be customized)
    const baseStats = {
      force: data.force ?? 10,
      intelligence: data.intelligence ?? 10,
      dexterite: data.dexterite ?? 10,
      agilite: data.agilite ?? 10,
      vie: data.vie ?? 10,
      chance: data.chance ?? 10,
    };

    const personnage = await prisma.personnage.create({
      data: {
        nom: data.nom,
        joueurId: data.joueurId,
        raceId: data.raceId,
        force: baseStats.force,
        intelligence: baseStats.intelligence,
        dexterite: baseStats.dexterite,
        agilite: baseStats.agilite,
        vie: baseStats.vie,
        chance: baseStats.chance,
      },
      include: {
        race: true,
      },
    });

    // Learn level 1 spells for this race
    await spellService.learnSpellsForLevel(personnage.id, 1);

    return personnage;
  }

  async findById(id: number) {
    return prisma.personnage.findUnique({
      where: { id },
      include: {
        race: true,
        joueur: true,
        sortsAppris: {
          include: {
            sort: true,
          },
        },
      },
    });
  }

  async findAll() {
    return prisma.personnage.findMany({
      include: {
        race: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async update(id: number, data: Partial<CreateCharacterRequest>) {
    return prisma.personnage.update({
      where: { id },
      data: {
        nom: data.nom,
        force: data.force,
        intelligence: data.intelligence,
        dexterite: data.dexterite,
        agilite: data.agilite,
        vie: data.vie,
        chance: data.chance,
      },
      include: {
        race: true,
      },
    });
  }

  async equipItem(characterId: number, slot: string, equipmentId: number | null) {
    const character = await prisma.personnage.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    if (equipmentId !== null) {
      const equipment = await prisma.equipement.findUnique({
        where: { id: equipmentId },
      });

      if (!equipment) {
        throw new Error('Equipment not found');
      }

      if (equipment.slot !== slot) {
        throw new Error(`Equipment slot mismatch: expected ${slot}, got ${equipment.slot}`);
      }

      if (character.niveau < equipment.niveauMinimum) {
        throw new Error(`Character level too low (need level ${equipment.niveauMinimum}, have level ${character.niveau})`);
      }
    }

    const currentEquipment = character.equipements as CharacterEquipment;
    currentEquipment[slot] = equipmentId;

    return prisma.personnage.update({
      where: { id: characterId },
      data: {
        equipements: currentEquipment,
      },
      include: {
        race: true,
      },
    });
  }

  async getTotalStats(characterId: number): Promise<TotalStats> {
    const character = await prisma.personnage.findUnique({
      where: { id: characterId },
      include: {
        race: true,
      },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    // Start with base stats + race bonuses
    const stats = {
      force: character.force + character.race.bonusForce,
      intelligence: character.intelligence + character.race.bonusIntelligence,
      dexterite: character.dexterite + character.race.bonusDexterite,
      agilite: character.agilite + character.race.bonusAgilite,
      vie: character.vie + character.race.bonusVie,
      chance: character.chance + character.race.bonusChance,
      pa: calculateBasePA(),
      pm: calculateBasePM(),
      po: calculateBasePO(),
    };

    // Add equipment bonuses
    const equipment = character.equipements as CharacterEquipment;
    const equipmentIds = Object.values(equipment).filter((id): id is number => id !== null);

    if (equipmentIds.length > 0) {
      const equipments = await prisma.equipement.findMany({
        where: { id: { in: equipmentIds } },
      });

      for (const equip of equipments) {
        stats.force += equip.bonusForce;
        stats.intelligence += equip.bonusIntelligence;
        stats.dexterite += equip.bonusDexterite;
        stats.agilite += equip.bonusAgilite;
        stats.vie += equip.bonusVie;
        stats.chance += equip.bonusChance;
        stats.pa += equip.bonusPA;
        stats.pm += equip.bonusPM;
        stats.po += equip.bonusPO;
      }
    }

    return {
      ...stats,
      pvMax: calculatePV(stats.vie),
    };
  }

  async delete(id: number) {
    // First remove from any groups
    await prisma.groupePersonnage.deleteMany({
      where: { personnageId: id },
    });

    return prisma.personnage.delete({
      where: { id },
    });
  }

  async getSpells(characterId: number) {
    return spellService.getLearnedSpells(characterId);
  }

  async allocateStatPoints(characterId: number, stats: StatAllocation) {
    return progressionService.allocateStats(characterId, stats);
  }

  async getProgressionInfo(characterId: number) {
    return progressionService.getProgressionInfo(characterId);
  }
}

export const characterService = new CharacterService();
