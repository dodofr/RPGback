# CLAUDE.md - Guide du projet RPG Tactique Backend

## Vue d'ensemble

Backend Node.js/TypeScript pour un jeu RPG tactique au tour par tour. API REST avec système de combat sur grille, exploration de monde, progression (XP/niveaux), équipement et IA des monstres.

## Stack technique

- **Runtime**: Node.js + TypeScript
- **API**: Express.js
- **ORM**: Prisma
- **BDD**: PostgreSQL
- **Validation**: Zod

## Commandes essentielles

```bash
# Développement
npm run dev              # Lancer le serveur (ts-node-dev)
npm run stop             # Arrêter le serveur (kill port 3000)
npm run build            # Compiler TypeScript
npm start                # Lancer la version compilée

# Base de données
npx prisma migrate dev   # Créer/appliquer migrations
npx prisma db push       # Push schema sans migration (dev)
npx prisma db seed       # Peupler avec données de base
npx prisma studio        # Interface graphique BDD
npx prisma generate      # Régénérer le client Prisma

# PostgreSQL (Windows)
setup_db.bat             # Créer user/database (première fois)
# Démarrer PostgreSQL : Services Windows → postgresql-x64-18 → Démarrer
```

## Structure du projet

```
backend/
├── src/
│   ├── index.ts                 # Point d'entrée, démarrage serveur
│   ├── app.ts                   # Configuration Express, middlewares
│   ├── config/
│   │   └── database.ts          # Client Prisma singleton
│   ├── api/
│   │   ├── routes.ts            # Agrégation de toutes les routes
│   │   ├── players/             # CRUD joueurs
│   │   ├── characters/          # CRUD personnages + équipement + progression
│   │   ├── groups/              # Gestion des groupes + navigation
│   │   ├── combat/              # Endpoints combat
│   │   ├── maps/                # Régions, maps, monstres, spawns
│   │   ├── grilles/             # CRUD grilles de combat prédéfinies
│   │   ├── donjons/             # Système de donjons linéaires
│   │   └── static/              # Données référentielles (races, sorts, équipements)
│   ├── services/
│   │   ├── player.service.ts
│   │   ├── character.service.ts # + stats totales, équipement
│   │   ├── group.service.ts     # + navigation entre maps, engagement auto
│   │   ├── region.service.ts    # Gestion des régions
│   │   ├── map.service.ts       # Maps, groupes ennemis, spawns, engagement
│   │   ├── monstre.service.ts   # Templates de monstres
│   │   ├── progression.service.ts  # XP, level-up, allocation stats
│   │   ├── spell.service.ts     # Apprentissage sorts, cooldowns
│   │   ├── grille.service.ts    # CRUD grilles + getRandomGridForMap()
│   │   ├── donjon.service.ts    # Système de donjons linéaires
│   │   └── combat/
│   │       ├── combat.service.ts   # Service principal combat
│   │       ├── engine.ts           # Logique coeur du combat
│   │       ├── initiative.ts       # Calcul ordre de jeu
│   │       ├── damage.ts           # Calcul dégâts/critiques
│   │       ├── movement.ts         # Déplacement sur grille
│   │       ├── grid.ts             # Chargement grille template, obstacles
│   │       ├── aoe.ts              # Zones d'effet (5 types)
│   │       ├── ai.ts               # IA des monstres
│   │       └── invocation.ts       # Système d'invocations
│   ├── utils/
│   │   ├── random.ts              # Fonctions aléatoires
│   │   └── formulas.ts            # Formules de jeu (PV, stats, XP...)
│   └── types/
│       └── index.ts               # Types TypeScript partagés
├── prisma/
│   ├── schema.prisma              # Schéma BDD complet
│   └── seed.ts                    # Données initiales
├── docs/
│   ├── API_DOCUMENTATION.md       # Doc API complète
│   ├── QUICK_REFERENCE.md         # Référence rapide
│   ├── frontend-types.ts          # Types pour le frontend
│   └── api-client-example.ts      # Exemple client API
└── setup_db.bat                   # Script setup PostgreSQL
```

## Architecture

### Pattern utilisé
- **Controller**: Validation des entrées (Zod), gestion HTTP
- **Service**: Logique métier, accès BDD via Prisma
- **Routes**: Définition des endpoints Express

### Flux d'une requête
```
Request → Routes → Controller → Service → Prisma → PostgreSQL
                      ↓
                 Validation Zod
```

## API Endpoints

### Players (`/api/players`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/` | Créer un joueur |
| GET | `/` | Lister tous les joueurs |
| GET | `/:id` | Obtenir un joueur |
| GET | `/:id/characters` | Personnages du joueur |
| GET | `/:id/groups` | Groupes du joueur |
| DELETE | `/:id` | Supprimer un joueur |

### Characters (`/api/characters`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/` | Créer un personnage |
| GET | `/` | Lister tous les personnages |
| GET | `/:id` | Obtenir un personnage avec stats totales |
| PATCH | `/:id` | Modifier nom/stats |
| PUT | `/:id/equipment` | Équiper un item |
| GET | `/:id/spells` | Sorts appris |
| POST | `/:id/allocate-stats` | Allouer points de stats |
| GET | `/:id/progression` | Info XP/niveau |
| DELETE | `/:id` | Supprimer un personnage |

### Groups (`/api/groups`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/` | Créer un groupe |
| GET | `/` | Lister tous les groupes |
| GET | `/:id` | Obtenir un groupe |
| POST | `/:id/characters` | Ajouter un personnage (max 6) |
| DELETE | `/:id/characters/:charId` | Retirer un personnage |
| PATCH | `/:id/move` | Déplacer le groupe |
| POST | `/:id/enter-map` | Entrer sur une map |
| POST | `/:id/use-connection` | Utiliser une connexion |
| POST | `/:id/leave-map` | Quitter la map |
| DELETE | `/:id` | Supprimer un groupe |

### Combat (`/api/combats`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/` | Créer un combat |
| GET | `/` | Lister tous les combats |
| GET | `/:id` | État du combat |
| POST | `/:id/action` | Exécuter sort/attaque ou attaque d'arme |
| POST | `/:id/move` | Déplacer une entité |
| POST | `/:id/end-turn` | Finir le tour |
| POST | `/:id/flee` | Fuir le combat |

### Maps (`/api/maps`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Lister toutes les maps |
| GET | `/:id` | Détails map + groupes ennemis + connexions |
| POST | `/` | Créer une map |
| POST | `/:id/spawns` | Configurer spawn |
| POST | `/:id/connections` | Ajouter connexion |
| POST | `/:id/spawn-enemies` | Spawn groupes ennemis (MANUEL) |
| POST | `/:id/engage` | Engager un groupe ennemi |
| POST | `/:id/respawn` | Respawn groupes vaincus |

### Grilles de combat (`/api/grilles`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/` | Créer une grille (nom, mapId, dimensions, cases, spawns) |
| GET | `/` | Lister toutes les grilles |
| GET | `/:id` | Détails grille avec cases et spawns |
| PUT | `/:id` | Mise à jour complète (remplace tout) |
| DELETE | `/:id` | Supprimer une grille |
| PUT | `/:id/cases` | Remplacer les obstacles |
| PUT | `/:id/spawns` | Remplacer les positions de spawn |

### Regions (`/api/regions`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Lister régions avec maps |
| GET | `/:id` | Détails région |
| POST | `/` | Créer une région |

### Monstres (`/api/monstres`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Lister templates |
| GET | `/:id` | Détails template |
| POST | `/` | Créer template |

### Donjons (`/api/donjons`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Lister tous les donjons |
| GET | `/:id` | Détails d'un donjon |
| POST | `/:id/enter` | Entrer dans un donjon |
| GET | `/run/:groupeId` | État du run actif |
| POST | `/run/:groupeId/abandon` | Abandonner le donjon |

### Static Data (`/api/races`, `/api/spells`, `/api/equipment`, `/api/effects`, `/api/zones`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/races` | Lister races avec sorts |
| GET | `/races/:id` | Détails race |
| GET | `/spells` | Lister tous les sorts |
| GET | `/spells/:id` | Détails sort |
| GET | `/equipment` | Lister équipements |
| GET | `/equipment/:id` | Détails équipement |
| GET | `/effects` | Lister effets (buffs/debuffs) |
| GET | `/zones` | Lister zones d'effet |

## Base de données

### Tables principales
- `Joueur` - Comptes joueurs
- `Personnage` - Personnages avec stats, niveau, XP, équipement (JSON)
- `PersonnageSort` - Sorts appris par personnage
- `Groupe` - Équipes de personnages (max 6), position sur map
- `GroupePersonnage` - Relation many-to-many groupe/personnage
- `Combat` - Instances de combat
- `CombatEntite` - Entités dans un combat (snapshot des stats + armeData JSON pour l'arme équipée)
- `CombatCase` - Obstacles sur la grille
- `EffetActif` - Buffs/debuffs actifs
- `SortCooldown` - Cooldowns des sorts en combat

### Tables Monde & Maps
- `Region` - Zones du monde (Forêt, Plaine, Montagne...)
- `Map` - Cartes dans une région (WILDERNESS, DONJON, VILLE, SAFE)
- `MapConnection` - Liens/portails entre maps
- `MonstreTemplate` - Définitions de monstres réutilisables
- `ZoneSpawn` - Configuration des spawns par zone
- `GroupeEnnemi` - Groupes d'ennemis sur une map (position unique, 1-3 groupes par map)
- `GroupeEnnemiMembre` - Composition des groupes (types de monstres mixtes, 1-8 monstres)
- `MapEnnemi` - (Legacy) Ennemis individuels sur une map

### Tables grilles de combat
- `GrilleCombat` - Templates de grilles de combat (nom, mapId, dimensions)
- `GrilleCase` - Obstacles prédéfinis sur une grille template
- `GrilleSpawn` - Positions de spawn prédéfinies (8 joueurs + 8 ennemis par grille)

### Tables référentielles
- `Race` - Races avec bonus de stats
- `Sort` - Sorts/attaques avec niveau requis (degatsCritMin/degatsCritMax pour range de critique)
- `Zone` - Types de zones d'effet
- `Equipement` - Items équipables avec bonus stats. Les armes ont aussi des données d'attaque (degats, portee, PA, zone, etc.)
- `Effet` - Buffs/debuffs

### Enums
```prisma
enum StatType { FORCE, INTELLIGENCE, DEXTERITE, AGILITE, VIE, CHANCE }
enum SortType { ARME, SORT }
enum SlotType { ARME, COIFFE, AMULETTE, BOUCLIER, HAUT, BAS, ANNEAU1, ANNEAU2, FAMILIER }
enum EffetType { BUFF, DEBUFF }
enum ZoneType { CASE, CROIX, LIGNE, CONE, CERCLE }
enum CombatStatus { EN_COURS, TERMINE, ABANDONNE }
enum RegionType { FORET, PLAINE, DESERT, MONTAGNE, MARAIS, CAVERNE, CITE }
enum MapType { WILDERNESS, VILLE, DONJON, BOSS, SAFE }
enum CombatMode { MANUEL, AUTO }
```

## Système de progression

### Expérience et niveau
```typescript
// XP requis pour le niveau suivant
xpRequis = niveau² × 50

// Exemple: niveau 1 → 2 = 50 XP, niveau 5 → 6 = 1250 XP

// Points de stats gagnés par niveau
pointsParNiveau = 10
```

### Distribution d'XP
- XP distribuée uniquement si le groupe gagne le combat
- XP partagée entre les personnages survivants
- Level-up automatique si XP suffisant
- Nouveaux sorts appris automatiquement au level-up

### Apprentissage des sorts
- À la création du personnage, les sorts de niveau 1 de sa race sont appris automatiquement
- Au level-up, les sorts dont le `niveauApprentissage` correspond au nouveau niveau sont appris
- Un personnage peut voir ses sorts via `GET /characters/:id/spells`

### Allocation de stats
- 10 points disponibles par niveau
- Endpoint: `POST /characters/:id/allocate-stats`
- Body: `{ force: 2, agilite: 3, ... }`

## Système d'équipement

### Slots disponibles
- ARME, COIFFE, AMULETTE, BOUCLIER
- HAUT, BAS
- ANNEAU1, ANNEAU2
- FAMILIER

### Stats totales
```typescript
statsTotales = statsBase + bonusRace + bonusÉquipement
```

### Équiper un item
```typescript
PUT /characters/:id/equipment
{ slot: "ARME", equipmentId: 1 }
```

### Vérifications
- Niveau minimum de l'équipement
- Slot correspondant

## Système de combat

### Grille de combat
- Grilles prédéfinies stockées en BDD (`GrilleCombat`)
- Une grille aléatoire est choisie parmi les templates de la map
- Taille standard: 15×10 (configurable par template)
- 8 positions de spawn joueurs (equipe=0) + 8 ennemis (equipe=1)
- Joueurs placés à gauche (x=0-1), ennemis à droite (x=13-14)
- Obstacles prédéfinis peuvent bloquer:
  - Mouvement uniquement
  - Mouvement ET ligne de vue

### Déroulement
1. Création du combat (via engage ou rencontre AUTO)
2. Sélection aléatoire d'une grille template pour la map
3. Placement joueurs/monstres aux positions de spawn prédéfinies
4. Copie des obstacles de la grille template dans le combat
5. Snapshot de l'arme équipée (armeData) pour chaque joueur
6. Calcul initiative: `agilité + random(1-20)`
7. **Alternance d'initiative par bloc équilibré** (voir ci-dessous)
8. Chaque tour: déplacements (PM) + actions (PA) via sorts OU attaque d'arme
9. IA joue automatiquement pour les monstres
10. Fin de round: restauration PA/PM, décrémentation effets, cooldowns sorts et cooldown arme
11. Fin combat: une équipe éliminée ou fuite
12. Distribution XP si victoire

### Actions de combat
- **Sort** : `POST /combats/:id/action { entiteId, sortId, targetX, targetY }` — utilise un sort appris
- **Arme** : `POST /combats/:id/action { entiteId, useArme: true, targetX, targetY }` — attaque avec l'arme équipée (nécessite une arme avec données d'attaque)
- Sans arme équipée, `useArme: true` retourne une erreur

### Système d'initiative alternée

Le système d'initiative assure un équilibre entre les équipes :

1. Chaque entité calcule son initiative : `INIT = agilité + random(1-20)`
2. Les équipes sont séparées et triées par initiative (décroissante)
3. L'ordre alterne : `Joueur[0] → Ennemi[0] → Joueur[1] → Ennemi[1] → ...`
4. Les entités restantes de l'équipe plus nombreuse jouent à la fin

**Exemple** (3 joueurs vs 5 monstres) :
```
Joueurs triés par init : J1(25), J2(20), J3(15)
Monstres triés par init : M1(22), M2(18), M3(16), M4(12), M5(8)
Ordre final : J1 → M1 → J2 → M2 → J3 → M3 → M4 → M5
```

**Avantages** :
- Équilibre garanti même avec des équipes de tailles différentes
- L'agilité détermine qui joue en premier dans son équipe
- Les invocations jouent juste après leur invocateur

### Formules clés
```typescript
// Points de vie
pvMax = 50 + (vie × 5)

// PA/PM de base
paBase = 6
pmBase = 3

// Dégâts
multiplicateur = (stat / 100) + 1
chanceCrit = chanceCritBase + (chance / 100)
dégâts normaux = floor(random(degatsMin, degatsMax) × multiplicateur)
dégâts critiques = floor(random(degatsCritMin, degatsCritMax) × multiplicateur)

// Distance (Manhattan, pas de diagonale)
distance = |x2 - x1| + |y2 - y1|

// Scaling monstres (+10% par niveau)
scaleFactor = 1 + (niveau - niveauBase) × 0.1
statFinale = floor(statBase × scaleFactor)
```

### Zones d'effet
| Type | Description |
|------|-------------|
| CASE | Case unique ciblée |
| CROIX | Centre + extensions N/S/E/O selon taille |
| CERCLE | Toutes cases dans rayon (Manhattan) |
| LIGNE | Ligne droite depuis lanceur vers cible |
| CONE | Cône depuis lanceur vers direction |

### Ligne de vue (LOS)
- Vérifiée avant chaque sort
- Bloquée par obstacles avec `bloqueLOS: true`
- Bloquée par entités sur le chemin

### Cooldowns
- Certains sorts ont un cooldown (tours)
- Décrémenté à chaque nouveau round
- Vérifié avant utilisation du sort

## IA des monstres

### Comportement automatique
L'IA joue automatiquement le tour des monstres:
1. Cherche l'ennemi le plus proche
2. Vérifie si un sort peut atteindre la cible
3. Si oui: utilise le sort
4. Sinon: se déplace vers la cible
5. Fin du tour

### Sélection de sort
- Priorise les sorts utilisables (PA, cooldown, portée, LOS)
- Choisit le premier sort valide

## Système d'invocations

### Création d'invocation
- Un sort peut invoquer une entité
- L'invocation joue juste après son invocateur
- L'invocation appartient à la même équipe

### Mort de l'invocateur
- Toutes ses invocations meurent automatiquement
- Réordonnancement de l'initiative

## Système de monde & maps

### Types de maps
| Type | CombatMode | Description |
|------|------------|-------------|
| WILDERNESS | MANUEL | Ennemis visibles, combat volontaire |
| DONJON | AUTO | Rencontres aléatoires à chaque déplacement |
| VILLE | MANUEL | Zone sûre, pas de combat |
| SAFE | MANUEL | Zone sûre (clairière, camp...) |
| BOSS | AUTO | Combat de boss |

### Système de groupes d'ennemis

Les ennemis sont organisés en **groupes** sur les maps :

- **1-3 groupes** par map (mode MANUEL)
- **1-8 monstres** par groupe
- **Composition mixte** : un groupe peut contenir plusieurs types de monstres (ex: 3 Loups + 2 Gobelins)
- **Position unique** : chaque groupe a une seule position (x, y) sur la map

#### Structure des données
```typescript
GroupeEnnemi {
  id, mapId, positionX, positionY,
  vaincu, vainquuAt, respawnTime,
  membres: GroupeEnnemiMembre[]
}

GroupeEnnemiMembre {
  id, groupeEnnemiId, monstreId,
  quantite,  // Nombre de ce type de monstre
  niveau,    // Niveau des monstres de ce type
  monstre: MonstreTemplate
}
```

### Modes de combat

#### Mode MANUEL (WILDERNESS)
- **Groupes ennemis visibles** sur la map (`GroupeEnnemi`)
- **Spawn automatique** : 1-3 groupes créés à l'entrée sur la map si aucun groupe actif
- **Engagement automatique** : se déplacer sur la case d'un groupe déclenche le combat
- **Engagement manuel** : `POST /maps/:id/engage { groupeId, groupeEnnemiId }`

#### Mode AUTO (DONJON)
- **Rencontres aléatoires** basées sur `tauxRencontre` (0.0-1.0)
- **Groupes mixtes** : chaque rencontre génère 1-8 monstres de 1-4 types différents
- Combat déclenché automatiquement lors du déplacement

### Flux de navigation
```
1. Entrer sur une map (spawn auto des groupes en mode MANUEL)
   POST /groups/:id/enter-map { mapId, startX?, startY? }
   → Retourne: group + map avec groupesEnnemis[]

2. Se déplacer (engagement auto si groupe ennemi à la position)
   PATCH /groups/:id/move { x, y }
   → Retourne { group, combat?, connection? }
   → Mode MANUEL: combat si groupe ennemi à (x, y)
   → Mode AUTO: combat aléatoire possible

3. Utiliser une connexion
   POST /groups/:id/use-connection { connectionId }
   → Téléporte vers map destination

4. Engagement manuel (optionnel, mode MANUEL)
   POST /maps/:id/engage { groupeId, groupeEnnemiId }
   → Crée le combat avec tous les monstres du groupe

5. Spawner manuellement des groupes
   POST /maps/:id/spawn-enemies
   → Crée 1-3 groupes de monstres mixtes

6. Respawn des groupes vaincus
   POST /maps/:id/respawn
   → Réactive les groupes dont le respawnTime est écoulé
```

## Conventions de code

### Nommage
- Fichiers: `kebab-case` ou `camelCase.ts`
- Classes: `PascalCase`
- Fonctions/variables: `camelCase`
- Tables BDD: `PascalCase` (français)
- Colonnes BDD: `camelCase`

### API REST
- Endpoints en anglais: `/api/players`, `/api/characters`
- Modèles BDD en français: `Joueur`, `Personnage`
- IDs numériques auto-incrémentés

### Erreurs
```typescript
// Format standard
{ error: "Message d'erreur", details?: [] }

// Codes HTTP
200 - Succès
201 - Créé
204 - Succès sans contenu
400 - Requête invalide
404 - Non trouvé
500 - Erreur serveur
```

## Tests manuels rapides

```bash
# Health check
curl http://localhost:3000/health

# Créer un joueur et personnage
curl -X POST http://localhost:3000/api/players \
  -H "Content-Type: application/json" \
  -d '{"nom": "TestPlayer"}'

curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{"nom": "Guerrier", "joueurId": 1, "raceId": 1}'

# Équiper un item
curl -X PUT http://localhost:3000/api/characters/1/equipment \
  -H "Content-Type: application/json" \
  -d '{"slot": "ARME", "equipmentId": 1}'

# Voir progression
curl http://localhost:3000/api/characters/1/progression

# Allouer des stats
curl -X POST http://localhost:3000/api/characters/1/allocate-stats \
  -H "Content-Type: application/json" \
  -d '{"force": 5, "vie": 5}'

# Créer un groupe et ajouter personnages
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -d '{"nom": "MonGroupe", "joueurId": 1}'

curl -X POST http://localhost:3000/api/groups/1/characters \
  -H "Content-Type: application/json" \
  -d '{"characterId": 1}'

# Explorer le monde
curl http://localhost:3000/api/regions
curl http://localhost:3000/api/maps/1

# Entrer sur une map (spawn auto des groupes ennemis)
curl -X POST http://localhost:3000/api/groups/1/enter-map \
  -H "Content-Type: application/json" \
  -d '{"mapId": 1}'

# Voir les groupes ennemis sur la map
curl http://localhost:3000/api/maps/1
# Retourne: groupesEnnemis: [{ id, positionX, positionY, membres: [...] }]

# Se déplacer vers un groupe ennemi (combat automatique)
curl -X PATCH http://localhost:3000/api/groups/1/move \
  -H "Content-Type: application/json" \
  -d '{"x": 15, "y": 8}'

# Ou engagement manuel d'un groupe ennemi
curl -X POST http://localhost:3000/api/maps/1/engage \
  -H "Content-Type: application/json" \
  -d '{"groupeId": 1, "groupeEnnemiId": 1}'

# Spawn manuel de groupes ennemis
curl -X POST http://localhost:3000/api/maps/1/spawn-enemies

# Respawn des groupes vaincus
curl -X POST http://localhost:3000/api/maps/1/respawn

# Actions de combat
curl http://localhost:3000/api/combats/1

curl -X POST http://localhost:3000/api/combats/1/action \
  -H "Content-Type: application/json" \
  -d '{"entiteId": 1, "sortId": 1, "targetX": 5, "targetY": 5}'

# Attaque d'arme (utilise l'arme équipée du personnage)
curl -X POST http://localhost:3000/api/combats/1/action \
  -H "Content-Type: application/json" \
  -d '{"entiteId": 1, "useArme": true, "targetX": 5, "targetY": 5}'

curl -X POST http://localhost:3000/api/combats/1/end-turn \
  -H "Content-Type: application/json" \
  -d '{"entiteId": 1}'
```

## Données de seed

### Races (5)
- Nain (FOR +15, VIE +20, DEX +5, INT -5, AGI -5) - 4 sorts (niveaux 1, 4, 7, 10)
- Orc (FOR +20, VIE +10, DEX +5, AGI +5, INT -10) - 4 sorts (niveaux 1, 4, 7, 10)
- Halfelin (DEX +15, AGI +15, CHANCE +10, INT +5, FOR -5, VIE -5) - 4 sorts (niveaux 1, 4, 7, 10)
- Humain (+5 partout) - 4 sorts (niveaux 1, 4, 7, 10)
- Elfe (INT +15, DEX +10, AGI +10, VIE -5) - 4 sorts (niveaux 1, 4, 7, 10)

### Sorts (24)
- Humain: 4 sorts SORT (niveaux 1, 4, 7, 10) - polyvalent
- Elfe: 4 sorts SORT (niveaux 1, 4, 7, 10) - magie
- Nain: 4 sorts SORT (niveaux 1, 4, 7, 10) - physique
- Orc: 4 sorts SORT (niveaux 1, 4, 7, 10) - brutal
- Halfelin: 4 sorts SORT (niveaux 1, 4, 7, 10) - agile
- 4 sorts ARME génériques pour monstres (sans race)
- Tous les sorts ont degatsCritMin/degatsCritMax (range de critique)

### Équipements (12)
- Répartis sur tous les slots
- Bonus de stats variés
- Niveaux requis différents
- Les 4 armes (Épée, Bâton, Arc, Dagues) ont des données d'attaque (dégâts, portée, PA, zone, stat utilisée)

### Effets (5)
- Rage, Concentration, Agilité (buffs)
- Faiblesse, Lenteur (debuffs)

### Régions (3)
- Forêt de Vertbois (niveau 1-5)
- Plaines du Sud (niveau 1-3)
- Montagne Grise (niveau 5-10)

### Maps (6)
- Orée de la forêt (WILDERNESS/MANUEL)
- Sentier forestier (WILDERNESS/MANUEL)
- Grotte aux Gobelins (DONJON/AUTO, 35% rencontre)
- Clairière paisible (SAFE)
- Route commerciale (WILDERNESS/MANUEL)
- Village de Piedmont (VILLE)

### Monstres (6)
- Gobelin, Loup, Bandit (niveau 1-3)
- Araignée Géante, Squelette (niveau 3-5)
- Troll des Forêts (niveau 5-8)

### Groupes d'ennemis (6)
- Orée de la forêt : Meute de 3 Loups, Groupe mixte (2 Gobelins + 1 Loup)
- Sentier forestier : 4 Araignées Géantes, Groupe mixte (2 Loups + 2 Araignées)
- Route commerciale : 3 Bandits, Groupe mixte (2 Bandits + 2 Loups)

### Connexions (10)
- Réseau de portails entre les maps

### Grilles de combat (8)
- 1 par map pouvant héberger un combat (wilderness, donjon, boss)
- 15×10, joueurs à gauche (x=0-1), ennemis à droite (x=13-14)
- 4-6 obstacles au centre par grille
- 16 spawns par grille (8 joueurs + 8 ennemis)

## Points d'attention

### Performance
- Le combat garde l'état en mémoire (via Prisma)
- Polling recommandé: 500ms-1000ms côté frontend
- Pas de WebSocket (MVP avec REST polling)
- IA des monstres exécutée de manière asynchrone

### Sécurité
- Pas d'authentification (MVP)
- Validation Zod sur toutes les entrées
- Pas de données sensibles exposées

### Limitations actuelles
- Effets (buffs/debuffs) stockés mais non appliqués aux stats en combat
- Respawn des groupes ennemis : timer stocké (300s), `POST /maps/:id/respawn` manuel
- Pas de système de mort permanente
- Pas de boutique/économie

## Pour étendre le projet

### Ajouter un endpoint
1. Créer/modifier `*.routes.ts`
2. Créer/modifier `*.controller.ts`
3. Créer/modifier `*.service.ts`
4. Ajouter la route dans `api/routes.ts`

### Ajouter une table
1. Modifier `prisma/schema.prisma`
2. `npx prisma db push` (dev) ou `npx prisma migrate dev`
3. Mettre à jour `prisma/seed.ts` si données initiales
4. `npx prisma db seed`

### Ajouter une nouvelle race
1. Ajouter dans `prisma/seed.ts` (table Race)
2. Créer les sorts associés (table Sort avec raceId)
3. `npx prisma db seed`

### Ajouter un nouveau sort
1. Ajouter dans `prisma/seed.ts`
2. Spécifier: raceId, niveauRequis, coutPA, portee, zoneId, degatsMin/Max, cooldown
3. `npx prisma db seed`

### Modifier l'IA des monstres
- Fichier `src/services/combat/ai.ts`
- Méthodes: `executeAITurn()`, `findClosestEnemy()`, `findUsableSpell()`

### Modifier les formules
- `src/utils/formulas.ts` pour calculs généraux
- `src/services/combat/damage.ts` pour dégâts
- `src/services/combat/initiative.ts` pour initiative

## Tests validés

Les fonctionnalités suivantes ont été testées et validées:

| Fonctionnalité | Statut |
|----------------|--------|
| Health check | OK |
| CRUD Joueurs | OK |
| CRUD Personnages | OK |
| CRUD Groupes | OK |
| Stats totales (base + race + équipement) | OK |
| Stat VIE (anciennement ENDURANCE) | OK |
| Entrée/sortie de map | OK |
| Spawn ennemis (mode MANUEL) | OK |
| Engagement combat | OK |
| Grille avec obstacles | OK |
| Initiative alternée (Joueur/Ennemi) | OK |
| Déplacement sur grille | OK |
| Actions/Sorts avec dégâts et critiques | OK |
| IA des monstres (déplacement + attaque) | OK |
| Fin de combat (victoire/défaite) | OK |
| Distribution XP aux survivants | OK |
| Données statiques (races, sorts, équipements, effets, zones) | OK |
| Groupes d'ennemis (spawn, affichage) | OK |
| Groupes mixtes (plusieurs types de monstres) | OK |
| Spawn automatique à l'entrée de map | OK |
| Engagement automatique au déplacement | OK |
| Engagement manuel de groupe ennemi | OK |
| Rencontres aléatoires avec groupes mixtes (mode AUTO) | OK |
| Respawn des groupes vaincus | OK |
| Grilles de combat prédéfinies (CRUD) | OK |
| Sélection aléatoire de grille par map | OK |
| Placement spawn joueurs/ennemis depuis grille | OK |
| Copie obstacles de grille template vers combat | OK |
| Critique en range (degatsCritMin/degatsCritMax) | OK |
| Attaque d'arme physique (useArme) | OK |
| Snapshot arme dans CombatEntite (armeData) | OK |

## Variables d'environnement

```env
DATABASE_URL="postgresql://rpg_user:rpg_password@localhost:5432/rpg_tactique?schema=public"
PORT=3000
```

## Setup PostgreSQL (Windows)

1. Installer PostgreSQL 18 depuis https://www.postgresql.org/download/windows/
2. Lancer `setup_db.bat` pour créer l'utilisateur et la base de données
3. Démarrer le service PostgreSQL via Services Windows (Win+R → services.msc → postgresql-x64-18)

## Dépendances principales

```json
{
  "@prisma/client": "^5.10.0",  // ORM
  "express": "^4.18.2",          // Framework web
  "zod": "^3.22.4"               // Validation
}
```
