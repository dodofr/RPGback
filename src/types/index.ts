import { StatType, ZoneType, SortType, SlotType, EffetType, CombatStatus, IAType } from '@prisma/client';

// Re-export Prisma enums
export { StatType, ZoneType, SortType, SlotType, EffetType, CombatStatus, IAType };

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
}

export interface CombatCaseState {
  x: number;
  y: number;
  bloqueDeplacement: boolean;
  bloqueLigneDeVue: boolean;
}

export interface CombatState {
  id: number;
  status: CombatStatus;
  tourActuel: number;
  entiteActuelle: number;
  grille: {
    largeur: number;
    hauteur: number;
  };
  entites: CombatEntityState[];
  effetsActifs: ActiveEffectStateWithDetails[];
  cases: CombatCaseState[];
  cooldowns: CombatCooldownState[];
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
}

// Weapon attack data (snapshot in CombatEntite)
export interface ArmeData {
  nom: string;
  degatsMin: number;
  degatsMax: number;
  degatsCritMin: number;
  degatsCritMax: number;
  chanceCritBase: number;
  coutPA: number;
  porteeMin: number;
  porteeMax: number;
  ligneDeVue: boolean;
  zoneId: number | null;
  statUtilisee: string;
  cooldown: number;
  tauxEchec: number;
}

// Character equipment type
export interface CharacterEquipment {
  [slot: string]: number | null;
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
  pvMax: number;
}
