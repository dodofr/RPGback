# CLAUDE.md - Guide du projet RPG Tactique Backend

## Vue d'ensemble

Backend Node.js/TypeScript pour un jeu RPG tactique au tour par tour. API REST avec système de combat sur grille, exploration de monde, progression (XP/niveaux), équipement et IA des monstres.

## Stack technique

- **Runtime**: Node.js + TypeScript
- **API**: Express.js + CORS
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
```

## Structure du projet

```
backend/
├── src/
│   ├── index.ts                 # Point d'entrée
│   ├── app.ts                   # Configuration Express + CORS
│   ├── config/database.ts       # Client Prisma singleton
│   ├── api/
│   │   ├── routes.ts            # Agrégation routes
│   │   ├── players/             # CRUD joueurs (controller/service/routes)
│   │   ├── characters/          # CRUD personnages + équipement + progression
│   │   ├── groups/              # Gestion groupes + navigation
│   │   ├── combat/              # Endpoints combat
│   │   ├── maps/                # Régions, maps, monstres, spawns + relations
│   │   ├── grilles/             # CRUD grilles de combat prédéfinies
│   │   ├── donjons/             # Système de donjons linéaires
│   │   ├── inventory/           # Inventaire (controller/routes) — equip, envoi, destruction
│   │   ├── craft/               # Craft (controller/routes) — recettes
│   │   └── static/              # CRUD données référentielles (races, sorts, équipements, effets, zones, ressources, panoplies, recettes admin)
│   ├── services/
│   │   ├── player.service.ts
│   │   ├── character.service.ts # + stats totales, équipement
│   │   ├── group.service.ts     # + navigation entre maps, engagement auto
│   │   ├── region.service.ts    # + update, delete
│   │   ├── map.service.ts       # + update, delete, deleteConnection
│   │   ├── monstre.service.ts   # + update, delete, findById incl. drops
│   │   ├── progression.service.ts  # XP, level-up, allocation stats
│   │   ├── spell.service.ts     # Apprentissage sorts, cooldowns
│   │   ├── grille.service.ts    # CRUD grilles + getRandomGridForMap()
│   │   ├── donjon.service.ts    # + create, update, delete
│   │   ├── inventory.service.ts # Inventaire, equip, rollStats, envoi entre personnages
│   │   ├── craft.service.ts     # Système de craft (recettes, vérif, consommation)
│   │   ├── drop.service.ts      # Distribution de butin post-combat
│   │   └── combat/
│   │       ├── combat.service.ts   # Service principal combat
│   │       ├── engine.ts           # Logique coeur du combat
│   │       ├── initiative.ts       # Calcul ordre de jeu
│   │       ├── damage.ts           # Calcul dégâts/critiques
│   │       ├── movement.ts         # Déplacement sur grille (BFS pathfinding) + LOS
│   │       ├── grid.ts             # Chargement grille template, obstacles
│   │       ├── aoe.ts              # Zones d'effet (5 types)
│   │       ├── ai.ts               # IA des monstres
│   │       ├── invocation.ts       # Système d'invocations
│   │       ├── effects.ts          # Buffs/debuffs (application, stats modifiées)
│   │       └── combatLog.ts        # Journal de combat (addLog, getLogsForCombat)
│   ├── utils/
│   │   ├── random.ts
│   │   └── formulas.ts            # Formules de jeu (PV, stats, XP...)
│   └── types/index.ts             # Types TypeScript partagés
├── prisma/
│   ├── schema.prisma              # Schéma BDD complet
│   └── seed.ts                    # Données initiales
└── docs/
    ├── API_DOCUMENTATION.md       # Doc API complète + exemples réponses
    └── QUICK_REFERENCE.md         # Référence rapide + curl exemples
```

## Architecture

### Pattern : Controller/Service/Route
```
Request → Routes → Controller (Zod) → Service (Prisma) → PostgreSQL
```

Exception : `static.routes.ts` utilise des handlers inline (pas de controller/service séparés) avec Prisma + Zod directement dans les routes.

## API Endpoints

### Players (`/api/players`)
POST `/` | GET `/` | GET `/:id` | GET `/:id/characters` | GET `/:id/groups` | PATCH `/:id` | DELETE `/:id`

### Characters (`/api/characters`)
POST `/` | GET `/` | GET `/:id` (avec stats totales) | PATCH `/:id` | PUT `/:id/equipment` | GET `/:id/spells` | POST `/:id/allocate-stats` | GET `/:id/progression` | POST `/:id/craft/:recetteId` | DELETE `/:id`

### Inventory (`/api/characters/:id/inventory`)
GET `/` | DELETE `/items/:itemId` | DELETE `/resources/:ressourceId` | POST `/equip/:itemId` | POST `/unequip` | POST `/send`

### Recipes (`/api/recipes`)
GET `/` | GET `/:id`

### Groups (`/api/groups`)
POST `/` | GET `/` | GET `/:id` | POST `/:id/characters` (max 6) | DELETE `/:id/characters/:charId` | PATCH `/:id/move` | POST `/:id/enter-map` | POST `/:id/use-connection` | POST `/:id/move-direction` (NORD/SUD/EST/OUEST) | POST `/:id/leave-map` | DELETE `/:id`

### Combat (`/api/combats`)
POST `/` | GET `/` | GET `/:id` | POST `/:id/action` (sort ou arme) | POST `/:id/move` | POST `/:id/end-turn` | POST `/:id/flee` | DELETE `/:id`

### Maps (`/api/maps`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/connections` | DELETE `/:id/connections/:connId` | POST `/:id/spawn-enemies` | POST `/:id/engage` | POST `/:id/respawn`

### Grilles (`/api/grilles`)
POST `/` | GET `/` | GET `/:id` | PUT `/:id` | DELETE `/:id` | PUT `/:id/cases` | PUT `/:id/spawns`

### Regions (`/api/regions`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/monstres` | DELETE `/:id/monstres/:monstreId`

### Monstres (`/api/monstres`)
GET `/` | GET `/:id` (incl. drops) | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/sorts` | DELETE `/:id/sorts/:sortId` | POST `/:id/drops` | PATCH `/:id/drops/:dropId` | DELETE `/:id/drops/:dropId`

### Donjons (`/api/donjons`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/enter` | GET `/run/:groupeId` | POST `/run/:groupeId/abandon`

### Static Data — Races (`/api/races`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Static Data — Sorts (`/api/spells`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/effects` | DELETE `/:id/effects/:effetId`

### Static Data — Equipements (`/api/equipment`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/lignes` | PATCH `/:id/lignes/:ligneId` | DELETE `/:id/lignes/:ligneId`

### Static Data — Effets (`/api/effects`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Static Data — Zones (`/api/zones`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Static Data — Ressources (`/api/resources`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Static Data — Panoplies (`/api/sets`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Admin — Recettes (`/api/admin/recipes`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

## Base de données

### Tables principales
- `Joueur` - Comptes joueurs
- `Personnage` - Stats, niveau, XP, équipement (JSON)
- `PersonnageSort` - Sorts appris par personnage
- `Groupe` / `GroupePersonnage` - Équipes (max 6), position sur map
- `Combat` - Instances de combat (`entiteActuelleId` = tour actif)
- `CombatEntite` - Snapshot stats + `armeData` JSON (incl. `lignes[]`, `bonusCrit`) + `monstreTemplateId`/`niveau` + `iaType` + `invocateurId`
- `CombatCase` - Obstacles sur la grille
- `CombatLog` - Journal de combat côté serveur (Cascade via Combat)
- `EffetActif` - Buffs/debuffs/poisons actifs (Cascade via Combat), `lanceurId` pour tracking mort du lanceur
- `SortCooldown` - Cooldowns sorts en combat (Cascade via Combat)
- `LigneDegatsArme` - Lignes de dégâts multi-lignes pour armes (Cascade via Equipement)
- `InventaireItem` - Items instanciés avec stats rollées (personnageId, equipementId, estEquipe, bonus stats fixés)
- `InventaireRessource` - Stack de ressources par personnage (personnageId + ressourceId, quantite)
- `Ressource` - Définition ressources (nom, poids, `estPremium` pour drops globaux)
- `MonstreDrop` - Table de drops par monstre (tauxDrop, quantiteMin/Max, ressourceId ou equipementId)
- `Panoplie` - Panoplies (sets d'équipements)
- `PanoplieBonus` - Bonus par palier (nombrePieces → bonus stats)
- `Recette` - Recettes de craft (equipementId résultat, niveauMinimum, coutOr)
- `RecetteIngredient` - Ingrédients d'une recette (ressourceId, quantite)

### Tables Monde & Maps
- `Region` - Zones du monde (Forêt, Plaine, Montagne...)
- `Map` - Cartes avec voisins directionnels (`nordMapId`, `sudMapId`, `estMapId`, `ouestMapId`)
- `MapConnection` - Portails nommés avec position (x, y)
- `MonstreTemplate` - Définitions monstres (+ `iaType`, `pvScalingInvocation`, `orMin`/`orMax`)
- `RegionMonstre` - Many-to-many monstres ↔ régions avec probabilité
- `MonstreSort` - Sorts par monstre avec priorité (1 = plus haute)
- `GroupeEnnemi` / `GroupeEnnemiMembre` - Groupes ennemis sur map (1-3 groupes, 1-8 monstres, composition mixte)

### Tables grilles de combat
- `GrilleCombat` - Templates (nom, mapId, dimensions)
- `GrilleCase` - Obstacles prédéfinis (Cascade)
- `GrilleSpawn` - 8 joueurs + 8 ennemis par grille (Cascade)

### Tables référentielles
- `Race` - Bonus de stats
- `Sort` - Sorts avec `degatsCritMin`/`degatsCritMax`, `estSoin`/`estDispel`/`estInvocation`/`estVolDeVie`, `tauxEchec`, `invocationTemplateId`
- `SortEffet` - Liaison sort → effet (`chanceDeclenchement`, `surCible`/`surLanceur`)
- `Zone` - Types de zones d'effet
- `Equipement` - Items avec bonus stats. Armes : données d'attaque + `tauxEchec` + `estVolDeVie` + `bonusCrit` (crit global) + `LigneDegatsArme[]` (multi-lignes optionnel)
- `LigneDegatsArme` - Ligne de dégâts arme : `ordre`, `degatsMin/Max`, `statUtilisee`, `estVolDeVie`, `estSoin`
- `Effet` - Buffs/debuffs/poisons. Champs : `valeurMin` (plage min pour POISON), `type` incl. POISON

### Enums
```prisma
enum StatType { FORCE, INTELLIGENCE, DEXTERITE, AGILITE, VIE, CHANCE, PA, PM, PO }
enum SortType { ARME, SORT }
enum SlotType { ARME, COIFFE, AMULETTE, BOUCLIER, HAUT, BAS, ANNEAU1, ANNEAU2, FAMILIER }
enum EffetType { BUFF, DEBUFF, DISPEL, POUSSEE, ATTIRANCE, POISON }
enum ZoneType { CASE, CROIX, LIGNE, CONE, CERCLE, LIGNE_PERPENDICULAIRE, DIAGONALE, CARRE, ANNEAU, CONE_INVERSE }
enum CombatStatus { EN_COURS, TERMINE, ABANDONNE }
enum CombatLogType { ACTION, DEPLACEMENT, TOUR, MORT, EFFET, EFFET_EXPIRE, FIN }
enum RegionType { FORET, PLAINE, DESERT, MONTAGNE, MARAIS, CAVERNE, CITE }
enum MapType { WILDERNESS, VILLE, DONJON, BOSS, SAFE }
enum CombatMode { MANUEL, AUTO }
enum IAType { EQUILIBRE, AGGRESSIF, SOUTIEN, DISTANCE }
```

### Types TypeScript
```typescript
type Direction = 'NORD' | 'SUD' | 'EST' | 'OUEST'
```

## Système de combat

### Déroulement
1. Création (via engage ou rencontre AUTO) → grille template aléatoire → placement spawns → copie obstacles → snapshot armeData → initiative
2. Initiative alternée : `INIT = agilité + random(1-20)`, alternance J1→M1→J2→M2→..., reste de l'équipe plus nombreuse à la fin
3. `entiteActuelleId` tracke le tour actif, vérifié sur `executeAction()`, `moveEntity()`, `endTurn()`
4. Chaque tour : déplacements (PM) + actions (PA) via sorts OU arme
5. Vérification de sort : `PersonnageSort` (joueurs) / `MonstreSort` (monstres)
6. IA auto-play : monstres (equipe=1) ET invocations joueur (`invocateurId !== null`)
7. Début de tour : décrémentation effets + cooldowns per-entity
8. Fin combat : nettoyage effets/cooldowns + suppression invocations survivantes + XP si victoire (tous les joueurs, vivants ET morts, invocations exclues)

### Actions
- **Sort** : `{ entiteId, sortId, targetX, targetY }` — sort appris (mono-ligne toujours)
- **Arme** : `{ entiteId, useArme: true, targetX, targetY }` — arme équipée (snapshot armeData avec lignes)
- **Ciblage libre** : touche TOUTES entités dans zone (alliés ET ennemis)
- **tauxEchec** : vérifié après PA déduits. Sort raté = PA perdus. Arme ratée = tour perdu (endTurn)
- **estSoin** : heal (même formule que dégâts, +PV plafonné à pvMax)
- **estDispel** : supprime tous effets actifs de la cible
- **estInvocation** : invoque entité à position libre (0 dégâts)
- **estVolDeVie** : après dégâts, le lanceur récupère 50% des dégâts totaux en PV (plafonné pvMax). Sur Sort = flag global, sur arme = par ligne

### Armes multi-lignes
- Chaque arme peut avoir 0 ou N `LigneDegatsArme` (table BDD, snapshotée dans `armeData.lignes[]`)
- **0 lignes** → fallback mono-ligne classique (champs plats `degatsMin/Max`, `degatsCritMin/Max`, `statUtilisee`)
- **1+ lignes** → multi-lignes : crit global + bonusCrit flat, boucle sur chaque ligne
- **Crit global** : 1 seul roll par attaque. Si crit → `bonusCrit` ajouté à min ET max de chaque ligne
- **Stat par ligne** : chaque ligne a sa propre `statUtilisee` (arme hybride FORCE + INTELLIGENCE possible)
- **Vol de vie par ligne** : `estVolDeVie` sur la ligne → heal 50% des dégâts de cette ligne uniquement
- **Soin par ligne** : `estSoin` sur la ligne → soigne la cible au lieu d'infliger des dégâts
- Flow : `1. tauxEchec → 2. roll crit global → 3. pour chaque ligne: stat multiplier + roll dégâts (+ bonusCrit si crit) → 4. somme`

### Formules clés
```typescript
pvMax = 50 + (vie × 5)
paBase = 6, pmBase = 3
multiplicateur = (stat / 100) + 1
chanceCrit = chanceCritBase + (chance / 100)
dégâts = floor(random(degatsMin, degatsMax) × multiplicateur)
critiques = floor(random(degatsCritMin, degatsCritMax) × multiplicateur)
distance = |x2 - x1| + |y2 - y1|  // Manhattan
scaleFactor = 1 + (niveau - niveauBase) × 0.1  // Monstres +10%/niveau
xpRequis = niveau² × 50
XP monstre = xpRecompense × (niveau / niveauBase)
XP par joueur = totalXP / nombre total joueurs (vivants + morts, hors invocations)
```

### Zones d'effet
CASE (unique) | CROIX (N/S/E/O selon taille) | CERCLE (rayon Manhattan) | LIGNE (lanceur→cible) | CONE (lanceur→direction)

### Déplacement (pathfinding)
- **BFS pathfinding** : `bfsPathCost()` dans `movement.ts` calcule le coût réel du chemin le plus court
- Contourne obstacles (`bloqueDeplacement`) et entités vivantes
- `canMove()` utilise le BFS (pas la distance Manhattan directe)
- Le frontend utilise aussi un BFS flood fill pour le preview des cases accessibles

### Ligne de vue (LOS)
- Bresenham supercover, LDV stricte sur diagonales
- Bloquée par obstacles (`bloqueLigneDeVue`) et entités vivantes
- Lanceur et cible exclus des vérifications
- `movement.ts` : `getLineOfSightCells()` + `hasLineOfSight()`

### Journal de combat (CombatLog)
- Logs générés **côté backend** à chaque action, stockés en BDD (`CombatLog` table, Cascade via Combat)
- `combatLog.ts` : `addLog(combatId, tour, message, type)` / `getLogsForCombat(combatId)`
- Retournés dans `getCombatState()` via `combat.logs[]`
- **Types** : ACTION (sort/arme/échec/soin/invocation/dispel), DEPLACEMENT, TOUR, MORT, EFFET, EFFET_EXPIRE, FIN
- **Consolidation IA** : mouvements IA groupés en un seul log par tour (PM total), pas 1 log par pas
- **Joueur** : mouvement logué dans `combat.service.ts move()` (pas dans `moveEntity()`)
- Format : `{nom} lance {sort} ({PA} PA) → {cible} subit {dmg} dégâts ({pv}/{pvMax} PV)`
- Multi-cibles AoE : un seul message avec toutes les cibles concaténées

## IA des monstres

### Types d'IA
| IAType | Comportement |
|--------|-------------|
| EQUILIBRE | heal allié <70% → dispel debuff → attaque → move (défaut) |
| AGGRESSIF | attaque uniquement, rush, jamais heal/dispel |
| SOUTIEN | heal allié <90%, avance vers alliés blessés, attaque en dernier |
| DISTANCE | recule si adjacent (`moveAwayFromTarget`), préfère sorts longue portée |

### Dispatch
`executeAITurn()` → `executeEquilibreTurn()` / `executeAggressifTurn()` / `executeSoutienTurn()` / `executeDistanceTurn()`

Sorts via `MonstreSort` triés par `priorite`. Auto-play pour monstres ET invocations (`invocateurId !== null`).

### Pathfinding
- `bfsFirstStep()` : BFS pour trouver le meilleur premier pas vers une cible en contournant obstacles/entités
- `moveTowardsTarget()` : utilise BFS, retourne le premier pas optimal
- `moveAwayFromTarget()` : teste les 4 directions, choisit celle qui maximise la distance

### Helpers
`findMostInjuredAlly()`, `findAllyWithDebuffs()`, `findClosestEnemy()`

## Système d'invocations

- Sort `estInvocation: true` + `invocationTemplateId` → invoque entité (0 dégâts, position libre requise)
- 5 templates (ids 7-11, xpRecompense=0), chaque race a 1 sort d'invocation niveau 5
- Scaling : stats = template + 50% lanceur, PV = pvBase + (pvMax lanceur × pvScalingInvocation)
- PA/PM fixes du template, propre `iaType` et sorts via `MonstreSort`
- Joue juste après invocateur (initiative alternée)
- Mort invocateur → invocations meurent. Fin combat → invocations supprimées

## Système de buffs/debuffs

- `SortEffet` lie Sort → Effet avec `chanceDeclenchement` et `surCible`/`surLanceur`
- Application automatique après sort. Stats modifiées : `statBase + somme(effets.valeur)`
- Durée décrémentée per-entity au début du tour, supprimé à `toursRestants <= 0`
- Nettoyage : mort entité → ses effets supprimés (+invocations). Fin combat → tous effets/cooldowns supprimés
- 5 effets : Rage (BUFF FOR +20, 3t), Concentration (BUFF INT +15, 2t), Agilité accrue (BUFF AGI +25, 2t), Affaiblissement (DEBUFF FOR -15, 2t), Ralentissement (DEBUFF AGI -20, 2t)

## Système d'inventaire

- Poids : `poidsActuel` = somme(items.poids) + somme(ressources.poids × quantité). Or sans poids
- `poidsMaxInventaire` sur Personnage (défaut 100)
- `rollStats()` : ranges sur Equipement (`bonusXxxMax`), roll aléatoire à la création de l'instance
- Items instanciés (`InventaireItem`) avec stats fixées au drop/craft, liés à un `Equipement` template
- Equip/unequip : met à jour `estEquipe` + sync legacy JSON `personnage.equipements`
- `getSetBonuses()` : calcule les bonus actifs des panoplies équipées (2+ pièces du même set)

## Système de drops

- Distribution **individuelle** (per player per monster) : or (`orMin`/`orMax`), ressources normales
- Distribution **globale** (1 roll, 1 joueur aléatoire) : équipements, ressources premium (`estPremium: true`)
- `MonstreDrop` : `tauxDrop` (0-1), `quantiteMin`/`quantiteMax`, `ressourceId` ou `equipementId`
- Appelé dans `combat.service.ts` à la fin du combat (victoire joueurs)
- Equipment droppé → `rollStats()` + `addItem()`, inventaire plein → item perdu silencieusement

## Système de craft

- `Recette` : nom, `equipementId` (résultat), `niveauMinimum`, `coutOr`, ingrédients
- `RecetteIngredient` : `ressourceId` + `quantite`
- Flow : vérifie niveau + or + ressources + poids → consomme or/ressources → `rollStats()` → crée `InventaireItem`
- Endpoint : `POST /api/characters/:id/craft/:recetteId`

## Système de panoplies (sets)

- `Panoplie` + `PanoplieBonus` : bonus par palier (2+ pièces)
- `Equipement.panoplieId` lie un équipement à une panoplie
- `getSetBonuses()` dans `inventory.service.ts` : compte les pièces équipées, applique le plus haut palier atteint

## Système d'envoi entre personnages

- `POST /api/characters/:id/inventory/send` — envoi unidirectionnel
- Body : `{ destinataireId, or?, ressources?: [{ressourceId, quantite}], items?: [itemId] }`
- Validation : possession, items non équipés, poids destinataire, transaction atomique Prisma
- Or sans poids, refus complet si destinataire n'a pas la place

## Système de monde & maps

### Types de maps
WILDERNESS (MANUEL, ennemis visibles) | DONJON (AUTO, rencontres aléatoires) | VILLE/SAFE (pas de combat) | BOSS (AUTO)

### Navigation
- **Direction** : `POST /groups/:id/move-direction { direction }` → lit `map.nordMapId`/`sudMapId`/etc.
- **Connexion** : `POST /groups/:id/use-connection { connectionId }` → portail nommé
- **Déplacement** : `PATCH /groups/:id/move { x, y }` → engagement auto si groupe ennemi
- **Entrée map** : `POST /groups/:id/enter-map { mapId }` → spawn auto groupes ennemis (MANUEL)

### Groupes ennemis
- MANUEL : 1-3 `GroupeEnnemi` par map, 1-8 `GroupeEnnemiMembre` mixtes, spawn auto via `RegionMonstre`
- AUTO : rencontres aléatoires (`tauxRencontre`), monstres via `RegionMonstre` (pondéré)
- Engagement : automatique (déplacement sur case) ou manuel (`POST /maps/:id/engage`)

## Conventions de code

### Nommage
- Fichiers: `kebab-case` ou `camelCase.ts` | Classes: `PascalCase` | Fonctions/variables: `camelCase`
- Tables BDD: `PascalCase` (français) | Colonnes: `camelCase`
- Endpoints en anglais (`/api/players`) | Modèles BDD en français (`Joueur`)

### Patterns
- **Controller/Service/Route** : players, characters, groups, combat, maps, donjons, grilles
- **Inline handlers** : `static.routes.ts` (races, sorts, equipment, effects, zones) — Prisma + Zod directement dans les routes, pas de controller/service séparés
- **Relations** : endpoints imbriqués (`/spells/:id/effects`, `/regions/:id/monstres`, `/monstres/:id/sorts`)

### Erreurs
```typescript
{ error: "Message", details?: [] }
// 200 Succès | 201 Créé | 204 Sans contenu | 400 Invalide | 404 Non trouvé | 500 Erreur
```

### Suppression (DELETE)
Avant de supprimer une ressource, nettoyer les relations :
- **Race** : supprimer PersonnageSort, SortEffet, SortCooldown, MonstreSort des sorts de la race, puis les sorts, puis la race
- **Sort** : supprimer SortEffet, PersonnageSort, SortCooldown, MonstreSort
- **Effet** : supprimer SortEffet, EffetActif
- **Zone** : nullifier zoneId sur Sort et Equipement
- **Region** : supprimer RegionMonstre
- **Map** : supprimer MapConnection, GroupeEnnemi, GrilleCombat, nullifier directional refs
- **Monstre** : supprimer RegionMonstre, MonstreSort
- **Donjon** : supprimer DonjonRun (DonjonSalle cascade)
- **Combat** : nullifier invocateurId, supprimer CombatEntite (EffetActif/SortCooldown/CombatCase/CombatLog cascade)

## Pour étendre le projet

### Ajouter un endpoint
1. `*.routes.ts` → 2. `*.controller.ts` → 3. `*.service.ts` → 4. Ajouter dans `api/routes.ts`

### Ajouter une table
1. `prisma/schema.prisma` → 2. `npx prisma db push` → 3. `prisma/seed.ts` → 4. `npx prisma db seed`

### Ajouter un sort (dans seed.ts)
- Standard : `raceId, niveauRequis, coutPA, portee, zoneId, degatsMin/Max, cooldown`
- Soin : `estSoin: true` (degatsMin/Max = montant soin)
- Dispel : `estDispel: true` (degatsMin/Max à 0)
- Invocation : `estInvocation: true`, `invocationTemplateId: N`, degats à 0
- Risqué : `tauxEchec: 0.xx`

### Modifier l'IA
- `src/services/combat/ai.ts` : `executeAITurn()` → dispatch par iaType
- Nouveau type : enum `IAType` + `executeXxxTurn()` + switch dans `executeAITurn()`

### Modifier les formules
- `src/utils/formulas.ts` (générales) | `combat/damage.ts` (dégâts) | `combat/initiative.ts` (initiative)

## Données de seed (résumé)

- **5 races** : Nain, Orc, Halfelin, Humain, Elfe — chacune 4 sorts (niv 1/4/7/10) + buff/dispel + invocation (niv 5)
- **55 sorts** : 20 race + 5 buff/debuff + 5 dispel + 3 soins + 5 invocations + 10 monstres + 7 invocations
- **14 équipements** : tous slots, 4 armes (dont 2 multi-lignes), certains avec stat ranges
- **5 effets** : 3 buffs (Rage, Concentration, Agilité) + 2 debuffs (Affaiblissement, Ralentissement)
- **12 ressources** : 2 premium (Pierre précieuse, Cuir de troll)
- **2 panoplies** : avec bonus par palier
- **6 recettes** de craft
- **3 régions** : Forêt (niv 1-5), Plaines (niv 1-3), Montagne (niv 5-10)
- **6 maps** : 3 WILDERNESS + 1 DONJON + 1 SAFE + 1 VILLE
- **11 monstres** : 6 normaux (Gobelin, Loup, Bandit, Araignée, Squelette, Troll) + 5 invocations
- **6 groupes ennemis** : 2 par map WILDERNESS, composition mixte
- **8 grilles** : 15×10, 16 spawns, 4-6 obstacles centraux

Détails complets : voir `prisma/seed.ts` et `docs/API_DOCUMENTATION.md`

## Variables d'environnement

```env
DATABASE_URL="postgresql://rpg_user:rpg_password@localhost:5432/rpg_tactique?schema=public"
PORT=3000
```

## Points d'attention

- Prisma Json fields : cast `as unknown as T` (pas direct `as T`)
- `prisma db push` au lieu de `migrate dev` en CLI non-interactif
- Polling frontend recommandé : 500ms-1000ms (pas de WebSocket, MVP REST)
- Pas d'authentification (MVP)
- Upsert pattern dans seed.ts pour idempotence
- CORS activé (`cors()` middleware dans app.ts)
- Frontend sur port 5173 (Vite), backend sur port 3000
