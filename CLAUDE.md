# CLAUDE.md - Guide du projet RPG Tactique Backend

## Vue d'ensemble

Backend Node.js/TypeScript pour un jeu RPG tactique au tour par tour. API REST avec système de combat sur grille, exploration de monde, progression (XP/niveaux), équipement, IA des monstres, et système de quêtes multi-étapes.

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
│   │   ├── characters/          # CRUD personnages + équipement + progression + quêtes actives + navigation solo
│   │   ├── groups/              # Gestion groupes + navigation
│   │   ├── combat/              # Endpoints combat
│   │   ├── maps/                # Régions, maps, monstres, spawns + relations
│   │   ├── donjons/             # Système de donjons linéaires
│   │   ├── quetes/              # CRUD quêtes admin (quetes.routes.ts)
│   │   ├── inventory/           # Inventaire (controller/routes) — equip, envoi, destruction
│   │   ├── craft/               # Craft (controller/routes) — recettes
│   │   └── static/              # CRUD données référentielles (races, sorts, équipements, effets, zones, ressources, panoplies, recettes admin)
│   ├── services/
│   │   ├── player.service.ts
│   │   ├── character.service.ts # + stats totales, équipement
│   │   ├── character-navigation.service.ts  # Navigation solo (enterMap, move, direction, connection, leaveMap)
│   │   ├── group.service.ts     # + navigation groupe entre maps, engagement auto (position via leader)
│   │   ├── region.service.ts    # + update, delete
│   │   ├── map.service.ts       # + update, delete, deleteConnection, updateWorldPositions
│   │   ├── monstre.service.ts   # + update, delete, findById incl. drops
│   │   ├── progression.service.ts  # XP, level-up, allocation stats
│   │   ├── spell.service.ts     # Apprentissage sorts, cooldowns
│   │   ├── donjon.service.ts    # + create, update, delete
│   │   ├── quest.service.ts     # Système de quêtes (interact, accept, advance, rewards)
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
```

## Architecture

### Pattern : Controller/Service/Route
```
Request → Routes → Controller (Zod) → Service (Prisma) → PostgreSQL
```

Exception : `static.routes.ts` et `quetes.routes.ts` utilisent des handlers inline (pas de controller/service séparés) avec Prisma + Zod directement dans les routes.

## API Endpoints

### Players (`/api/players`)
POST `/` | GET `/` | GET `/:id` | GET `/:id/characters` | GET `/:id/groups` | PATCH `/:id` | DELETE `/:id`

### Characters (`/api/characters`)
POST `/` | GET `/` | GET `/:id` (avec stats totales) | PATCH `/:id` | PUT `/:id/equipment` | GET `/:id/spells` | POST `/:id/sync-spells` | POST `/:id/allocate-stats` | POST `/:id/reset-stats` | GET `/:id/progression` | POST `/:id/craft/:recetteId` | GET `/:id/quetes` | DELETE `/:id`

Navigation solo : POST `/:id/enter-map` | PATCH `/:id/move` | POST `/:id/move-direction` | POST `/:id/use-connection` | POST `/:id/leave-map`

### Inventory (`/api/characters/:id/inventory`)
GET `/` | DELETE `/items/:itemId` | DELETE `/resources/:ressourceId` | POST `/equip/:itemId` | POST `/unequip` | POST `/send`

### Recipes (`/api/recipes`)
GET `/` | GET `/:id`

### Groups (`/api/groups`)
POST `/` (body: `nom, joueurId, leaderId`) | GET `/` | GET `/:id` | POST `/:id/characters` (max 6, perso sur même map) | DELETE `/:id/characters/:charId` | PATCH `/:id/move` | POST `/:id/enter-map` | POST `/:id/use-connection` | POST `/:id/move-direction` (NORD/SUD/EST/OUEST) | POST `/:id/leave-map` | DELETE `/:id`

### Combat (`/api/combats`)
POST `/` | GET `/` | GET `/:id` | POST `/:id/action` (sort ou arme) | POST `/:id/move` | POST `/:id/end-turn` | POST `/:id/flee` | DELETE `/:id`

### Maps (`/api/maps`)
PUT `/world-positions` | GET `/portals` | GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/connections` | DELETE `/:id/connections/:connId` | POST `/:id/spawn-enemies` | POST `/:id/engage` | POST `/:id/respawn` | GET `/:id/grid` | PUT `/:id/grid/cases` | PUT `/:id/grid/spawns` | GET `/:id/pnj`

### Regions (`/api/regions`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/monstres` | DELETE `/:id/monstres/:monstreId`

### Monstres (`/api/monstres`)
GET `/` | GET `/:id` (incl. drops) | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/sorts` | DELETE `/:id/sorts/:sortId` | POST `/:id/drops` | PATCH `/:id/drops/:dropId` | DELETE `/:id/drops/:dropId`

### Donjons (`/api/donjons`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/enter` | GET `/run/:groupeId` | POST `/run/:groupeId/abandon` | GET `/run/solo/:charId` | POST `/run/solo/:charId/abandon`

### PNJ (`/api/pnj`)
GET `/map-status?mapId=X&personnageIds=1,2,3` ← **DOIT être avant `/:id`**
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`
POST `/:id/lignes` | PATCH `/:id/lignes/:ligneId` | DELETE `/:id/lignes/:ligneId`
POST `/:id/dialogues` | PATCH `/:id/dialogues/:dialogueId` | DELETE `/:id/dialogues/:dialogueId`
POST `/:id/buy` | POST `/:id/sell`
POST `/:id/interact` | POST `/:id/accept-quest` | POST `/:id/advance-quest`

### Quêtes admin (`/api/quetes`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`
POST `/:id/etapes` | PATCH `/:id/etapes/:etapeId` | DELETE `/:id/etapes/:etapeId`
POST `/:id/recompenses` | DELETE `/:id/recompenses/:recompenseId`
POST `/:id/prerequis` | DELETE `/:id/prerequis/:prerequisId`

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

### Passives (`/api/passives`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Import (`/api/import`)
POST `/maps` | POST `/monstres`

## Base de données

### Tables principales
- `Joueur` - Comptes joueurs
- `Personnage` - Stats, niveau, XP, équipement (JSON). **`mapId`, `positionX`, `positionY`** — position propre sur la map (nullable)
- `PersonnageSort` - Sorts appris par personnage
- `Groupe` / `GroupePersonnage` - Équipes (max 6). **`leaderId`** (FK Personnage). La position est portée par les Personnages (plus de positionX/Y/mapId sur Groupe)
- `Combat` - Instances de combat (`entiteActuelleId` = tour actif). `groupeId` OU `personnageId` (combat solo sans groupe)
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
- `Map` - Cartes avec voisins directionnels (`nordMapId`, `sudMapId`, `estMapId`, `ouestMapId`) + position monde optionnelle (`worldX`, `worldY`)
- `MapConnection` - Portails nommés avec position (x, y)
- `MapCase` - Obstacles de la grille de combat liés à la map (Cascade via Map)
- `MapSpawn` - Points de spawn joueurs/ennemis par map (Cascade via Map)
- `MonstreTemplate` - Définitions monstres (+ `iaType`, `pvScalingInvocation`, `orMin`/`orMax`)
- `RegionMonstre` - Many-to-many monstres ↔ régions avec probabilité
- `MonstreSort` - Sorts par monstre avec priorité (1 = plus haute)
- `GroupeEnnemi` / `GroupeEnnemiMembre` - Groupes ennemis sur map (1-3 groupes, 1-8 monstres, composition mixte)

### Tables PNJ & Quêtes
- `PNJ` - Personnages non-joueurs sur map (`mapId`, `positionX/Y`, `estMarchand`)
- `PNJDialogue` - Lignes de dialogue par PNJ (`type: DialogueType`, `texte`, `ordre`, `queteId?`, `etapeOrdre?`) — Cascade via PNJ, SetNull via Quete. Sélection côté serveur dans `interactWithPnj()` : étape active > quête générique > ACCUEIL > SANS_INTERACTION
- `MarchandLigne` - Catalogue marchand (equipementId ou ressourceId, prixMarchand, prixRachat)
- `Quete` - Définition d'une quête (nom, niveauRequis, pnjDepartId)
- `QueteEtape` - Étapes ordonnées d'une quête (type PARLER_PNJ ou TUER_MONSTRE, pnjId, monstreTemplateId, quantite) — Cascade via Quete
- `QueteRecompense` - Récompenses d'une quête (xp, or, ressourceId+quantite, equipementId) — Cascade via Quete
- `QuetePersonnage` - Progression d'un personnage sur une quête (etapeActuelle, compteurEtape, statut EN_COURS/TERMINEE) — unique [queteId, personnageId]
- `QueteRequis` - Prérequis entre quêtes (queteId, prerequisId) — `@@id([queteId, prerequisId])`. Cascade si quête principale supprimée ; nettoyage manuel si prérequis supprimé (`deleteQuest()`)

### Tables référentielles
- `Race` - Bonus de stats
- `Sort` - Sorts avec `degatsCritMin`/`degatsCritMax`, `estSoin`/`estInvocation`/`estVolDeVie`/`estSelfBuff`, `tauxEchec`, `invocationTemplateId`, `ligneDirecte` (Boolean, ciblage axe strict)
- `SortEffet` - Liaison sort → effet (`chanceDeclenchement`, `surCible`)
- `Zone` - Types de zones d'effet
- `Equipement` - Items avec bonus stats. Armes : données d'attaque + `tauxEchec` + `estVolDeVie` + `bonusCrit` (crit global) + `LigneDegatsArme[]` (multi-lignes optionnel)
- `LigneDegatsArme` - Ligne de dégâts arme : `ordre`, `degatsMin/Max`, `statUtilisee`, `estVolDeVie`, `estSoin`
- `Effet` - Buffs/debuffs/poisons. Champs : `valeurMin` (plage min pour POISON), `type` incl. POISON
- `CompetencePassive` - Bonus permanents débloqués par niveau (bonusForce, bonusPa, etc.)

### Tables donjons
- `Donjon` - Définition d'un donjon (regionId, bossId, niveauMin/Max)
- `DonjonSalle` - Salles d'un donjon (ordre, mapId) — Cascade via Donjon
- `DonjonSalleComposition` - Monstres par salle selon difficulté — Cascade via DonjonSalle
- `DonjonRun` - Run actif (groupe ou solo) dans un donjon. `groupeId Int? @unique` OU `personnageId Int? @unique` (exactement un renseigné). `salleActuelle`, `difficulte`, `victoire`

### Enums
```prisma
enum StatType { FORCE, INTELLIGENCE, DEXTERITE, AGILITE, VIE, CHANCE, PA, PM, PO, CRITIQUE, DOMMAGES, SOINS }
enum SortType { ARME, SORT }
enum SlotType { ARME, COIFFE, AMULETTE, BOUCLIER, HAUT, BAS, ANNEAU1, ANNEAU2, FAMILIER }
enum EffetType { BUFF, DEBUFF, DISPEL, POUSSEE, ATTIRANCE, POISON, BOUCLIER, RESISTANCE }
enum ZoneType { CASE, CROIX, LIGNE, CONE, CERCLE, LIGNE_PERPENDICULAIRE, DIAGONALE, CARRE, ANNEAU, CONE_INVERSE }
enum CombatStatus { EN_COURS, TERMINE, ABANDONNE }
enum CombatLogType { ACTION, DEPLACEMENT, TOUR, MORT, EFFET, EFFET_EXPIRE, FIN }
enum RegionType { FORET, PLAINE, DESERT, MONTAGNE, MARAIS, CAVERNE, CITE }
enum MapType { WILDERNESS, VILLE, DONJON, BOSS, SAFE }
enum CombatMode { MANUEL, AUTO }
enum IAType { EQUILIBRE, AGGRESSIF, SOUTIEN, DISTANCE }
enum QueteEtapeType { PARLER_PNJ, TUER_MONSTRE, APPORTER_RESSOURCE, APPORTER_EQUIPEMENT }
enum QueteStatut { EN_COURS, TERMINEE }
enum DialogueType { ACCUEIL, SANS_INTERACTION }
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
8. Fin combat : nettoyage effets/cooldowns + suppression invocations survivantes + XP si victoire (tous les joueurs, vivants ET morts, invocations exclues) + drops + progression quêtes TUER_MONSTRE

### Actions
- **Sort** : `{ entiteId, sortId, targetX, targetY }` — sort appris (mono-ligne toujours)
- **Arme** : `{ entiteId, useArme: true, targetX, targetY }` — arme équipée (snapshot armeData avec lignes)
- **Ciblage libre** : touche TOUTES entités dans zone (alliés ET ennemis)
- **tauxEchec** : vérifié après PA déduits. Sort raté = PA perdus. Arme ratée = tour perdu (endTurn)
- **estSoin** : heal (même formule que dégâts, +PV plafonné à pvMax)
- **estInvocation** : invoque entité à position libre (0 dégâts)
- **ligneDirecte** : si `true`, la cible doit être sur le même axe X ou Y que le lanceur (diagonales refusées). Vérifié dans `engine.ts` avant le check de portée.
- **estVolDeVie** : après dégâts, le lanceur récupère 50% des dégâts totaux en PV (plafonné pvMax). Sur Sort = flag global, sur arme = par ligne
- **estSelfBuff** : `true` → l'IA caste ce sort sur elle-même (step 0B, avant heal/attaque, dans les 4 stratégies). Flag explicite en BDD.

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
chanceCrit = chanceCritBase + floor(chance/100)×0.01 + (bonusCritique/100)
  // Palier CHANCE : 0 crit sous 100 CHANCE, +1% par tranche de 100 (ex: 300 → +3%)
flatForceBonus = floor(force / 100)    // +1 dommage flat par tranche de 100 FORCE
flatDexBonus   = floor(dexterite / 100) // +1 soin flat par tranche de 100 DEX
dégâts = floor(random(degatsMin + flatForceBonus, degatsMax + flatForceBonus) × multiplicateur)
critiques = floor(random(degatsCritMin + flatForceBonus, degatsCritMax + flatForceBonus) × multiplicateur)
soins   = floor(random(degatsMin + flatDexBonus, degatsMax + flatDexBonus) × multiplicateur)
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

### Engagement de mêlée
- **Règle** : si un ennemi adjacent a `AGI >= 2 × INT` du déplaceur → **blocage total** (impossible de se déplacer)
- Check dans `moveEntity()` via helper `isMeleeEngagementBlocked()` après `canMove()`, avant le update Prisma
- **Contournements** : téléportation (passe par update direct, pas `moveEntity()`), poussée/attirance (effects.ts, pas `moveEntity()`)

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

- `SortEffet` lie Sort → Effet avec `chanceDeclenchement` et `surCible` (`true` = zone, `false` = lanceur uniquement)
- Application automatique après sort. Stats modifiées : `statBase + somme(effets.valeur)`
- Durée décrémentée per-entity au début du tour, supprimé à `toursRestants <= 0`
- Nettoyage : mort entité → ses effets supprimés (+invocations). Fin combat → tous effets/cooldowns supprimés
- 5 effets : Rage (BUFF FOR +20, 3t), Concentration (BUFF INT +15, 2t), Agilité accrue (BUFF AGI +25, 2t), Affaiblissement (DEBUFF FOR -15, 2t), Ralentissement (DEBUFF AGI -20, 2t)

## Système d'inventaire

- Poids : `poidsActuel` = somme(items.poids) + somme(ressources.poids × quantité). Or sans poids
- `poidsMaxInventaire` sur Personnage (défaut 2000)
- `rollStats()` : ranges sur Equipement (`bonusXxxMax`), roll aléatoire à la création de l'instance
- Items instanciés (`InventaireItem`) avec stats fixées au drop/craft, liés à un `Equipement` template
- Equip/unequip : met à jour `estEquipe` + sync legacy JSON `personnage.equipements`
- `getSetBonuses()` : calcule les bonus actifs des panoplies équipées (2+ pièces du même set)

## Système de drops

- Distribution **individuelle** (per player per monster) : or (`orMin`/`orMax`), ressources normales
- Distribution **globale** (1 roll, 1 joueur aléatoire) : équipements, ressources premium (`estPremium: true`)
- `MonstreDrop` : `tauxDrop` (0-1), `quantiteMin`/`quantiteMax`, `ressourceId` ou `equipementId`
- Appelé dans `engine.ts checkCombatEnd()` à la fin du combat (victoire joueurs)
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

## Système de quêtes

### Architecture
- **Service** : `src/services/quest.service.ts` — logique centrale
- **Types d'étapes** :
  - `PARLER_PNJ` — déclenché manuellement via PNJ (dialogue)
  - `TUER_MONSTRE` — déclenché automatiquement post-combat (`onCombatEnd`)
  - `APPORTER_RESSOURCE` — déclenché manuellement via PNJ ; vérifie + consomme `quantite` unités de `ressourceId` dans l'inventaire
  - `APPORTER_EQUIPEMENT` — déclenché manuellement via PNJ ; vérifie + supprime `quantite` instances non-équipées de `equipementId`
- **Progression** : `QuetePersonnage.etapeActuelle` + `compteurEtape` (kills accumulés pour TUER_MONSTRE)
- **Prérequis** : `QueteRequis` — une quête peut exiger que d'autres soient `TERMINEE`. Filtre côté serveur dans `interactWithPnj()` (quête verrouillée = invisible pour le joueur). Admin via section "Prérequis" dans `QueteDetailPage`.
- **Avancement auto** `TUER_MONSTRE` : hook dans `engine.ts checkCombatEnd()` → `questService.onCombatEnd(combatId)`
  - Tous les personnages joueurs du combat bénéficient des kills (kills partagés)
  - Si étape complète et dernière → `statut = TERMINEE` + récompenses distribuées automatiquement
- **Quête non-rejouable** : contrainte unique `[queteId, personnageId]`

### Flow interact PNJ
```
POST /pnj/:id/interact { personnageId }
  → quetesDisponibles (niveau ok, pas déjà acceptée)
  → etapesEnAttente (QuetePersonnage EN_COURS dont étape actuelle = PARLER_PNJ | APPORTER_RESSOURCE | APPORTER_EQUIPEMENT avec ce PNJ)
  → estMarchand (boolean)

POST /pnj/:id/accept-quest { personnageId, queteId }
  → Crée QuetePersonnage { etapeActuelle: 1, compteurEtape: 0 }

POST /pnj/:id/advance-quest { personnageId, quetePersonnageId }
  → Switch sur type d'étape :
     PARLER_PNJ → avance directement
     APPORTER_RESSOURCE → vérifie stock, consomme quantite unités (delete ou decrement)
     APPORTER_EQUIPEMENT → vérifie N items non-équipés du template, les supprime
  → etapeActuelle++, ou statut = TERMINEE si dernière étape
  → Si terminée : distributeQuestRewards() → XP + or + ressources + équipement (rollStats)
```

### Récompenses
- `xp` → `Personnage.experience` + `checkAndApplyLevelUp()`
- `or` → `Personnage.or`
- `ressource` → upsert `InventaireRessource`
- `equipement` → `rollStats()` + `addItem()` (silent fail si inventaire plein)

### Seed
- PNJ id=1 : Chef du village (map id=5, pos 7/9, estMarchand=**true** — marchand ET donneur de quête)
- PNJ id=2 : Garde du village (map id=5, pos 3/9, estMarchand=false)
- Quête id=1 : "La menace des loups" — 4 étapes (Parler garde → Tuer 4 loups → Parler garde → Parler chef), récompense 200 XP + 50 or

## Système de monde & maps

### Types de maps
WILDERNESS (MANUEL, ennemis visibles) | DONJON (AUTO, rencontres aléatoires) | VILLE/SAFE (pas de combat) | BOSS (AUTO)

### Navigation
**Solo (Personnage)** — endpoint prefix `/api/characters/:id`
- `POST /enter-map { mapId, startX?, startY? }` → entre sur une map, spawn ennemis si WILDERNESS vide
- `PATCH /move { x, y }` → déplacement + engagement combat (AUTO: dist≤4, MANUEL: même case)
- `POST /move-direction { direction }` → lit `map.nordMapId`/`sudMapId`/etc.
- `POST /use-connection { connectionId, destinationConnectionId?, difficulte? }` → portail normal ou entrée donjon solo (`difficulte` requis pour donjon)
- `POST /leave-map` → mapId=null, pos=(0,0)

**Groupe** — endpoint prefix `/api/groups/:id`
- `POST /enter-map { mapId }` → tous les membres téléportés + spawn ennemis (MANUEL)
- `PATCH /move { x, y }` → tous les membres déplacés + engagement auto
- `POST /move-direction { direction }` → navigation directionnelle groupe
- `POST /use-connection { connectionId }` → portail + donjons
- `POST /leave-map` → mapId=null pour tous les membres

### Grille de combat (par map)
- `MapCase` : obstacles (`bloqueDeplacement`, `bloqueLigneDeVue`, `estExclue`) — Cascade via Map
- `MapSpawn` : points de spawn (equipe 0=joueurs, 1=ennemis, ordre 1-8) — Cascade via Map
- Spawns standard : joueurs x=1, ennemis x=18, y=[1,3,5,7,9,11,13] (7 positions, maps 20×14)
- Endpoints : `GET /maps/:id/grid`, `PUT /maps/:id/grid/cases`, `PUT /maps/:id/grid/spawns`

### Carte du monde (positions)
- `Map.worldX` / `Map.worldY` : position optionnelle sur la grille monde (Int?)
- `PUT /api/maps/world-positions` : batch update positions + recalcul automatique des liens directionnels
  - Transaction : update positions → clear tous liens → rebuild par adjacence (NORD=y-1, SUD=y+1, EST=x+1, OUEST=x-1)
  - Maps absentes de la liste : worldX/worldY remis à null
- Les liens directionnels sont bidirectionnels et calculés automatiquement

### Portails réseau
- `MapConnection.toMapId` nullable → portail sans destination = portail donjon
- `GET /api/maps/portals` DOIT être déclaré avant `GET /api/maps/:id` dans map.routes.ts

### Groupes ennemis
- MANUEL : 1-3 `GroupeEnnemi` par map, 1-8 `GroupeEnnemiMembre` mixtes, spawn auto via `RegionMonstre`
- AUTO : engagement automatique à proximité (4 cases Manhattan), monstres via `RegionMonstre` (pondéré)
- Engagement : automatique (déplacement solo ou groupe) ou manuel (`POST /maps/:id/engage { groupeEnnemiId, groupeId? | personnageId? }`)
- `engageEnemyGroup(mapId, ennemiId, groupeId?, personnageId?)` — crée un combat groupe OU solo

## PNJ marchands

- `PNJ` : positionX/Y sur map, `estMarchand` (checkbox indépendante — un PNJ peut être marchand ET donneur de quête simultanément)
- `MarchandLigne` : catalogue avec `prixMarchand` (achat) et `prixRachat` (vente)
- Tous les PNJ sont interactables (bouton "Parler à" dans MapPage) → dialogue modal avec sélecteur de personnage + quêtes + bouton boutique si `estMarchand`
- Admin : `PNJPage` (liste) → `/admin/pnj/:id` → `PNJDetailPage` (détail avec inventaire marchand + quêtes données)
- `POST /pnj/:id/buy` / `POST /pnj/:id/sell` : transactions marchandes

## Règles groupe (depuis migration Position par Personnage)
- **`Groupe.leaderId`** : obligatoire (appliqué dans le service). Transfert auto si leader quitte → nouveau leader = premier membre restant. Si plus de membres → groupe supprimé.
- **`addCharacter()`** : le perso doit être sur la même map que le leader ET ne pas être déjà dans un autre groupe.
- **`delete()`** : bloqué si `DonjonRun` actif (groupe ou solo). Les personnages conservent leur position.
- **Navigation groupe** : toutes les méthodes (`move`, `enterMap`, `leaveMap`) font un `personnage.updateMany` sur tous les membres.
- **Combat solo** : `combatService.create({ personnageId, monstres, mapId })` — sans groupe. Le `Combat.personnageId` est renseigné, `CombatState.personnageId` retourné.
- **Seed** : reset automatique des groupes et positions en début de seed (`deleteMany` DonjonRun/Groupe, `updateMany` Personnage).

## Navigation Frontend (UX Groupe/Solo)
- **DashboardPage** : affiche directement `<CharactersPage>` sans onglet Groupes.
- **CharactersPage** : mode aventure (`isAdventureMode = !!groupId || (!!charIdParam && !playerIdProp)`) — masque la grille de sélection et les boutons non pertinents. Navigation solo doit passer `playerId` dans l'URL pour que le modal "Envoyer" soit filtré par joueur.
- **MapPage solo** : au chargement, détecte si le perso est déjà dans un groupe → redirige `?groupId=X` automatiquement.
- **MapPage groupe** : sidebar avec bouton "✕ Retirer" par membre, section "Sur cette map" avec "+ Inviter" (auto-retire de l'ancien groupe si besoin), bouton "Dissoudre le groupe" pour forcer le retour en solo.
- **MapPage solo "Sur cette map"** : bouton "+ Groupe" individuel par allié (crée un groupe à nom aléatoire + invite l'allié choisi).
- **Noms de groupe** : `randomGroupName()` → `Les {Adj} {Nom}` — jamais basé sur le nom du personnage.

## Conventions de code

### Nommage
- Fichiers: `kebab-case` ou `camelCase.ts` | Classes: `PascalCase` | Fonctions/variables: `camelCase`
- Tables BDD: `PascalCase` (français) | Colonnes: `camelCase`
- Endpoints en anglais (`/api/players`) | Modèles BDD en français (`Joueur`)

### Patterns
- **Controller/Service/Route** : players, characters, groups, combat, maps, donjons
- **Inline handlers** : `static.routes.ts`, `quetes.routes.ts`, `pnj.routes.ts` — Prisma + Zod directement dans les routes, pas de controller/service séparés
- **Relations** : endpoints imbriqués (`/spells/:id/effects`, `/regions/:id/monstres`, `/quetes/:id/etapes`)

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
- **Map** : supprimer MapConnection, GroupeEnnemi, MapCase, MapSpawn, nullifier directional refs
- **Monstre** : supprimer RegionMonstre, MonstreSort, QueteEtape (mettre monstreTemplateId à null)
- **PNJ** : supprimer MarchandLigne, nullifier QueteEtape.pnjId, nullifier Quete.pnjDepartId
- **Quête** : supprimer QuetePersonnage + QueteRequis (où prerequisId = id), puis delete quête (cascade → QueteEtape, QueteRecompense, QueteRequis où queteId = id)
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
- Dispel : via `SortEffet → EffetType.DISPEL` (plus de flag `estDispel` sur Sort)
- Invocation : `estInvocation: true`, `invocationTemplateId: N`, degats à 0
- Ligne droite : `ligneDirecte: true` (ciblage axe H/V uniquement)
- Self-buff IA : `estSelfBuff: true` (IA l'utilise sur soi en priorité)
- Risqué : `tauxEchec: 0.xx`

### Ajouter un type d'étape de quête
1. Ajouter valeur dans enum `QueteEtapeType` (schema.prisma) + `npx prisma db push`
2. Ajouter la logique dans `quest.service.ts` :
   - Si déclenchement via PNJ : ajouter le type dans le filtre `etapesEnAttente` de `interactWithPnj()`, et un `case` dans le switch de `advancePnjStep()`
   - Si déclenchement automatique : nouveau hook (ex: `onCombatEnd` pour TUER_MONSTRE)
3. Mettre à jour la validation Zod dans `quetes.routes.ts`
4. Mettre à jour `TYPE_LABELS` dans `QueteDetailPage.tsx` et `QuetesPage.tsx` (frontend)

### Modifier l'IA
- `src/services/combat/ai.ts` : `executeAITurn()` → dispatch par iaType
- Nouveau type : enum `IAType` + `executeXxxTurn()` + switch dans `executeAITurn()`

### Modifier les formules
- `src/utils/formulas.ts` (générales) | `combat/damage.ts` (dégâts) | `combat/initiative.ts` (initiative)

## Données de seed (résumé)

- **3 races** : Humain, Elfe, Nain — sorts, buffs, dispels, invocations
- **Sorts** : sorts race + sorts monstres + buffs/debuffs + invocations
- **10 équipements** : tous slots, armes avec lignes de dégâts
- **5 effets** : 3 buffs (Rage, Concentration, Agilité) + 2 debuffs (Affaiblissement, Ralentissement)
- **11 ressources** : 2 premium (Pierre précieuse, Cuir de troll)
- **2 panoplies** : avec bonus par palier
- **6 recettes** de craft
- **3 régions** : Forêt Vertbois (niv 1-5), Plaines du Sud (niv 1-3)
- **6 maps** : id=1 Orée forêt, id=2 Sentier forestier, id=4 Route commerciale, id=5 Village de Piedmont, id=6-9 salles donjon Grotte (⚠️ map id=3 supprimée — les IDs ne se décalent pas)
- **11 monstres** : 6 normaux (Gobelin id=1, Loup id=2, Bandit, ...) + 5 invocations
- **6 groupes ennemis** : 2 par map WILDERNESS
- **1 donjon** : Grotte aux Gobelins (4 salles)
- **2 PNJ** : id=1 Chef du village (map 5, pos 7/9, estMarchand=true), id=2 Garde du village (map 5, pos 3/9, estMarchand=false)
- **7 dialogues PNJ** : ids 1-4 génériques (chef ACCUEIL+SANS_INTERACTION, garde ACCUEIL+SANS_INTERACTION) + ids 5-7 liés à "La menace des loups" (garde étape 1, garde étape 3, chef étape 4)
- **2 quêtes** :
  - id=1 "La menace des loups" (4 étapes : PARLER_PNJ→TUER_MONSTRE→PARLER_PNJ→PARLER_PNJ, 200 XP + 50 or)
  - id=3 "Ravitaillement du village" (4 étapes : PARLER_PNJ→APPORTER_RESSOURCE(3×Cuir, Garde)→APPORTER_EQUIPEMENT(1×Bouclier en bois, Chef)→PARLER_PNJ, 100 XP + 30 or) — **prérequis : quête id=1 TERMINEE** — **⚠️ id=2 laissé libre (quête créée manuellement)**
- **3 compétences passives** : Perspicacité (PO+1, niv 25), Endurance (PM+1, niv 50), Maestria (PA+1, niv 100)

Détails complets : voir `prisma/seed.ts`

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
- Upsert pattern dans seed.ts pour idempotence — inclure les champs à normaliser dans `update` (pas seulement `create`)
- CORS activé (`cors()` middleware dans app.ts)
- Frontend sur port 5173 (Vite), backend sur port 3000
- `GET /api/maps/portals` DOIT être avant `GET /api/maps/:id` dans map.routes.ts
- Frontend TypeScript : compiler avec `node_modules/.bin/tsc --noEmit --project tsconfig.app.json` (depuis le backend, avec le chemin absolu vers le frontend)
- `ConfirmDialog` frontend requiert la prop `open: boolean` (pas de rendu conditionnel externe)
