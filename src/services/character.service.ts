import prisma from '../config/database';
import { CreateCharacterRequest, CharacterEquipment, TotalStats } from '../types';
import { calculatePV, calculateBasePA, calculateBasePM, calculateBasePO } from '../utils/formulas';
import { progressionService, StatAllocation } from './progression.service';
import { spellService } from './spell.service';
import { inventoryService } from './inventory.service';

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

    // Get Village de Piedmont (map 5) for starting position
    const startMap = await prisma.map.findUnique({ where: { id: 5 } });
    const startX = startMap ? Math.floor(startMap.largeur * 0.1) : 2;
    const startY = startMap ? Math.floor(startMap.hauteur / 2) : 7;

    const personnage = await prisma.personnage.create({
      data: {
        nom: data.nom,
        joueurId: data.joueurId,
        raceId: data.raceId,
        sexe: (data.sexe as 'HOMME' | 'FEMME') ?? 'HOMME',
        force: baseStats.force,
        intelligence: baseStats.intelligence,
        dexterite: baseStats.dexterite,
        agilite: baseStats.agilite,
        vie: baseStats.vie,
        chance: baseStats.chance,
        mapId: startMap ? 5 : null,
        positionX: startX,
        positionY: startY,
      },
      include: {
        race: true,
      },
    });

    // Learn level 1 spells for this race
    await spellService.learnSpellsForLevel(personnage.id, 1);

    const imageUrl = personnage.sexe === 'FEMME'
      ? (personnage.race?.imageUrlFemme ?? personnage.race?.imageUrlHomme ?? null)
      : (personnage.race?.imageUrlHomme ?? null);
    return { ...personnage, imageUrl };
  }

  async findById(id: number) {
    const personnage = await prisma.personnage.findUnique({
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
    if (!personnage) return null;
    const imageUrl = personnage.sexe === 'FEMME'
      ? (personnage.race?.imageUrlFemme ?? personnage.race?.imageUrlHomme ?? null)
      : (personnage.race?.imageUrlHomme ?? null);
    return { ...personnage, imageUrl };
  }

  async findAll() {
    const personnages = await prisma.personnage.findMany({
      include: {
        race: true,
      },
      orderBy: { id: 'desc' },
    });
    return personnages.map(p => {
      const imageUrl = p.sexe === 'FEMME'
        ? (p.race?.imageUrlFemme ?? p.race?.imageUrlHomme ?? null)
        : (p.race?.imageUrlHomme ?? null);
      return { ...p, imageUrl };
    });
  }

  async update(id: number, data: Partial<CreateCharacterRequest & { sexe?: 'HOMME' | 'FEMME' }>) {
    const personnage = await prisma.personnage.update({
      where: { id },
      data: {
        nom: data.nom,
        sexe: data.sexe as 'HOMME' | 'FEMME' | undefined,
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
    const imageUrl = personnage.sexe === 'FEMME'
      ? (personnage.race?.imageUrlFemme ?? personnage.race?.imageUrlHomme ?? null)
      : (personnage.race?.imageUrlHomme ?? null);
    return { ...personnage, imageUrl };
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
      bonusCritique: 0,
      resistanceForce: 0,
      resistanceIntelligence: 0,
      resistanceDexterite: 0,
      resistanceAgilite: 0,
      bonusDommages: 0,
      bonusSoins: 0,
    };

    // Add equipment bonuses from inventory instances (rolled stats)
    const equippedItems = await prisma.inventaireItem.findMany({
      where: { personnageId: characterId, estEquipe: true },
    });

    if (equippedItems.length > 0) {
      for (const item of equippedItems) {
        stats.force += item.bonusForce;
        stats.intelligence += item.bonusIntelligence;
        stats.dexterite += item.bonusDexterite;
        stats.agilite += item.bonusAgilite;
        stats.vie += item.bonusVie;
        stats.chance += item.bonusChance;
        stats.pa += item.bonusPA;
        stats.pm += item.bonusPM;
        stats.po += item.bonusPO;
        stats.bonusCritique += item.bonusCritique;
        stats.resistanceForce += item.resistanceForce;
        stats.resistanceIntelligence += item.resistanceIntelligence;
        stats.resistanceDexterite += item.resistanceDexterite;
        stats.resistanceAgilite += item.resistanceAgilite;
        stats.bonusDommages += item.bonusDommages;
        stats.bonusSoins += item.bonusSoins;
      }

      // Add panoplie (set) bonuses
      const setBonuses = await inventoryService.getSetBonuses(characterId);
      for (const setBonus of setBonuses) {
        stats.force += setBonus.bonusForce;
        stats.intelligence += setBonus.bonusIntelligence;
        stats.dexterite += setBonus.bonusDexterite;
        stats.agilite += setBonus.bonusAgilite;
        stats.vie += setBonus.bonusVie;
        stats.chance += setBonus.bonusChance;
        stats.pa += setBonus.bonusPA;
        stats.pm += setBonus.bonusPM;
        stats.po += setBonus.bonusPO;
        stats.bonusCritique += setBonus.bonusCritique;
      }
    } else {
      // Fallback: use legacy JSON equipment field if no inventory items exist
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
          stats.bonusCritique += equip.bonusCritique;
        }
      }
    }

    // Passives débloquées par niveau
    const passives = await prisma.competencePassive.findMany({
      where: { niveauDeblocage: { lte: character.niveau } },
    });
    for (const p of passives) {
      stats.force += p.bonusForce;
      stats.intelligence += p.bonusIntelligence;
      stats.dexterite += p.bonusDexterite;
      stats.agilite += p.bonusAgilite;
      stats.vie += p.bonusVie;
      stats.chance += p.bonusChance;
      stats.pa += p.bonusPa;
      stats.pm += p.bonusPm;
      stats.po += p.bonusPo;
      stats.bonusCritique += p.bonusCritique;
      stats.bonusDommages += p.bonusDommages;
      stats.bonusSoins += p.bonusSoins;
    }

    // Familier équipé
    if (character.familierEquipeId) {
      const familier = await prisma.familier.findUnique({ where: { id: character.familierEquipeId } });
      if (familier) {
        stats.force += familier.statForce;
        stats.intelligence += familier.statIntelligence;
        stats.dexterite += familier.statDexterite;
        stats.agilite += familier.statAgilite;
        stats.vie += familier.statVie;
        stats.chance += familier.statChance;
        stats.pa += familier.statPA;
        stats.pm += familier.statPM;
        stats.po += familier.statPO;
        stats.bonusCritique += familier.statCritique;
        stats.bonusDommages += familier.statDommages;
        stats.bonusSoins += familier.statSoins;
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

  async resetStatPoints(characterId: number) {
    return progressionService.resetStats(characterId);
  }

  async getProgressionInfo(characterId: number) {
    return progressionService.getProgressionInfo(characterId);
  }
}

export const characterService = new CharacterService();
