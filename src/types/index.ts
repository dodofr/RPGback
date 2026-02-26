import { StatType, ZoneType, SortType, SlotType, EffetType, CombatStatus, IAType, CombatLogType } from '@prisma/client';

// Re-export Prisma enums
export { StatType, ZoneType, SortType, SlotType, EffetType, CombatStatus, IAType, CombatLogType };

// Direction enum (used for map navigation, not stored in DB)
export type Direction = 'NORD' | 'SUD' | 'EST' | 'OUEST';

// Combat types
export interface Position {
  x: number;
  y: number;
}

export interface CombatAction {
  type: 'ATTACK' | 'SPELL' | 'PASS';
  sortId?: number;
  targetX?: number;
  targetY?: number;
}

export interface MoveAction {
  entiteId: number;
  targetX: number;
  targetY: number;
}

export interface DamageResult {
  baseDamage: number;
  finalDamage: number;
  isCritical: boolean;
  statMultiplier: number;
}

export interface ActionResult {
  success: boolean;
  message: string;
  actionType?: 'ARME' | 'SORT';
  damages?: {
    entiteId: number;
    damage: number;
    isCritical: boolean;
    pvRestants: number;
  }[];
  entiteMorte?: number[];
  heals?: {
    entiteId: number;
    healAmount: number;
    isCritical: boolean;
    pvRestants: number;
  }[];
  missed?: boolean;
  removedEffects?: {
    entiteId: number;
    removedCount: number;
  }[];
  appliedEffects?: {
    entiteId: number;
    effetId: number;
    effetNom: string;
    duree: number;
  }[];
  invocation?: {
    entiteId: number;
    nom: string;
    position: Position;
  };
  lifesteal?: {
    healAmount: number;
    pvRestants: number;
  };
  pmUsed?: number;
}

export interface CombatCaseState {
  x: number;
  y: number;
  bloqueDeplacement: boolean;
  bloqueLigneDeVue: boolean;
}

export interface CombatLogEntry {
  id: number;
  tour: number;
  message: string;
  type: string;
}

export interface ZonePoseeState {
  id: number;
  x: number;
  y: number;
  poseurId: number;
  poseurEquipe: number;
  estPiege: boolean;
  toursRestants: number;
  degatsMinFinal: number;
  degatsMaxFinal: number;
  statUtilisee: string;
  effetId?: number | null;
  zoneTaille: number;
  zoneType: string;
}

export interface CombatState {
  id: number;
  status: CombatStatus;
  tourActuel: number;
  entiteActuelle: number;
  groupeId: number | null;
  grille: {
    largeur: number;
    hauteur: number;
  };
  entites: CombatEntityState[];
  effetsActifs: ActiveEffectStateWithDetails[];
  cases: CombatCaseState[];
  cooldowns: CombatCooldownState[];
  logs: CombatLogEntry[];
  zonesActives: ZonePoseeState[];
}

export interface CombatCooldownState {
  entiteId: number;
  sortId: number;
  toursRestants: number;
}

export interface CombatEntityState {
  id: number;
  personnageId: number | null;
  nom: string;
  equipe: number;
  position: Position;
  pvMax: number;
  pvActuels: number;
  paMax: number;
  paActuels: number;
  pmMax: number;
  pmActuels: number;
  stats: {
    force: number;
    intelligence: number;
    dexterite: number;
    agilite: number;
    vie: number;
    chance: number;
  };
  initiative: number;
  ordreJeu: number;
  invocateurId?: number | null;
  armeData?: ArmeData | null;
  armeCooldownRestant?: number;
  monstreTemplateId?: number | null;
  niveau?: number | null;
  iaType?: string | null;
  poBonus?: number;
  bonusCritique?: number;
  resistanceForce?: number;
  resistanceIntelligence?: number;
  resistanceDexterite?: number;
  resistanceAgilite?: number;
  sorts?: CombatSpellState[];
}

export interface ActiveEffectState {
  id: number;
  entiteId: number;
  effetId: number;
  toursRestants: number;
}

export interface ActiveEffectStateWithDetails extends ActiveEffectState {
  nom: string;
  type: EffetType;
  statCiblee: StatType;
  valeur: number;
  valeurMin?: number | null;
}

// Spell data returned with combat entities
export interface CombatSpellState {
  id: number;
  nom: string;
  description: string | null;
  type: string;
  statUtilisee: string;
  coutPA: number;
  porteeMin: number;
  porteeMax: number;
  ligneDeVue: boolean;
  degatsMin: number;
  degatsMax: number;
  degatsCritMin: number;
  degatsCritMax: number;
  chanceCritBase: number;
  cooldown: number;
  cooldownRestant: number;
  estSoin: boolean;
  estInvocation: boolean;
  estVolDeVie: boolean;
  estGlyphe: boolean;
  estPiege: boolean;
  estTeleportation?: boolean;
  poseDuree?: number | null;
  porteeModifiable: boolean;
  ligneDirecte: boolean;
  tauxEchec: number;
  coefficient: number;
  zone: { type: string; taille: number; nom: string } | null;
  effets: {
    effetId: number;
    nom: string;
    type: string;
    statCiblee: string;
    valeur: number;
    valeurMin?: number | null;
    duree: number;
    chanceDeclenchement: number;
    surCible: boolean;
  }[];
}

// A single damage line for multi-line weapons
export interface LigneDegats {
  ordre: number;
  degatsMin: number;
  degatsMax: number;
  statUtilisee: string;
  estVolDeVie: boolean;
  estSoin: boolean;
}

// Weapon attack data (snapshot in CombatEntite)
export interface ArmeData {
  nom: string;
  chanceCritBase: number;
  bonusCrit: number;
  coutPA: number;
  porteeMin: number;
  porteeMax: number;
  ligneDeVue: boolean;
  zoneId: number | null;
  cooldown: number;
  tauxEchec: number;
  lignes: LigneDegats[];
}

// Character equipment type
export interface CharacterEquipment {
  [slot: string]: number | null;
}

// Inventory types
export interface InventoryItemInstance {
  id: number;
  equipementId: number;
  nom: string;
  slot: string;
  poids: number;
  bonusForce: number;
  bonusIntelligence: number;
  bonusDexterite: number;
  bonusAgilite: number;
  bonusVie: number;
  bonusChance: number;
  bonusPA: number;
  bonusPM: number;
  bonusPO: number;
  bonusCritique: number;
  resistanceForce: number;
  resistanceIntelligence: number;
  resistanceDexterite: number;
  resistanceAgilite: number;
  estEquipe: boolean;
  panoplieId?: number | null;
}

export interface ResourceStack {
  ressourceId: number;
  nom: string;
  description?: string | null;
  poids: number;
  quantite: number;
}

export interface InventoryState {
  items: InventoryItemInstance[];
  ressources: ResourceStack[];
  poidsActuel: number;
  poidsMax: number;
  or: number;
}

export interface PlayerDropResult {
  personnageId: number;
  nom: string;
  or: number;
  ressources: { ressourceId: number; nom: string; quantite: number }[];
  items: InventoryItemInstance[];
}

export interface DropResult {
  perPlayer: PlayerDropResult[];
  totalOr: number;
  totalRessources: { ressourceId: number; nom: string; quantite: number }[];
  totalItems: InventoryItemInstance[];
}

export interface SetBonusInfo {
  panoplieId: number;
  nom: string;
  piecesEquipees: number;
  bonusForce: number;
  bonusIntelligence: number;
  bonusDexterite: number;
  bonusAgilite: number;
  bonusVie: number;
  bonusChance: number;
  bonusPA: number;
  bonusPM: number;
  bonusPO: number;
  bonusCritique: number;
}

// API request/response types
export interface CreatePlayerRequest {
  nom: string;
}

export interface CreateCharacterRequest {
  nom: string;
  joueurId: number;
  raceId: number;
  force?: number;
  intelligence?: number;
  dexterite?: number;
  agilite?: number;
  vie?: number;
  chance?: number;
}

export interface CreateGroupRequest {
  nom: string;
  joueurId: number;
}

export interface CreateCombatRequest {
  groupeId: number;
  monstres: MonsterDefinition[];
  mapId: number;
}

export interface MonsterDefinition {
  nom: string;
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  vie: number;
  chance: number;
  pvMax: number;
  paMax: number;
  pmMax: number;
  monstreTemplateId?: number;
  niveau?: number;
  iaType?: string;
}

// Stats calculation
export interface TotalStats {
  force: number;
  intelligence: number;
  dexterite: number;
  agilite: number;
  vie: number;
  chance: number;
  pa: number;
  pm: number;
  po: number;
  bonusCritique: number;
  pvMax: number;
  resistanceForce: number;
  resistanceIntelligence: number;
  resistanceDexterite: number;
  resistanceAgilite: number;
}
