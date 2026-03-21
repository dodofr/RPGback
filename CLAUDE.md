# CLAUDE.md - Guide du projet RPG Tactique Backend

## Stack technique
Node.js + TypeScript | Express.js | Prisma | PostgreSQL | Zod

## Commandes essentielles

```bash
npm run dev              # Lancer le serveur (ts-node-dev)
npm run stop             # Arrêter le serveur (kill port 3000)
npm run build && npm start

npx prisma db push       # Push schema sans migration (CLI non-interactif)
npx prisma db seed       # Peupler avec données de base
npx prisma studio        # Interface graphique BDD
npx prisma generate      # Régénérer le client Prisma
```

## Structure du projet

```
src/
├── index.ts / app.ts / config/database.ts
├── api/
│   ├── routes.ts              # Agrégation routes
│   ├── players/ characters/ groups/ combat/ maps/ donjons/
│   ├── quetes/ inventory/ craft/
│   └── static/                # races, sorts, équipements, effets, zones, ressources, panoplies, recettes
├── services/
│   ├── player/character/group/region/map/monstre/progression/spell/donjon/quest/inventory/craft/drop
│   ├── character-navigation.service.ts
│   └── combat/ (combat.service, engine, initiative, damage, movement, grid, aoe, ai, invocation, effects, combatLog)
├── utils/ (random.ts, formulas.ts)
└── types/index.ts
prisma/ (schema.prisma, seed.ts)
```

## Architecture

**Pattern Controller/Service/Route** : `Request → Routes → Controller (Zod) → Service (Prisma) → PostgreSQL`

Exception : `static.routes.ts`, `quetes.routes.ts`, `pnj.routes.ts` — handlers inline (Prisma + Zod directement dans les routes).

## API Endpoints

### Players (`/api/players`)
POST `/` | GET `/` | GET `/:id` | GET `/:id/characters` | GET `/:id/groups` | PATCH `/:id` | DELETE `/:id`

### Characters (`/api/characters`)
POST `/` | GET `/` | GET `/:id` | PATCH `/:id` | PUT `/:id/equipment` | GET `/:id/spells` | POST `/:id/sync-spells` | POST `/:id/allocate-stats` | POST `/:id/reset-stats` | GET `/:id/progression` | POST `/:id/craft/:recetteId` | GET `/:id/quetes` | DELETE `/:id`

Navigation solo : POST `/:id/enter-map` | PATCH `/:id/move` | POST `/:id/move-direction` | POST `/:id/use-connection`

### Inventory (`/api/characters/:id/inventory`)
GET `/` | DELETE `/items/:itemId` | DELETE `/resources/:ressourceId` | POST `/equip/:itemId` | POST `/unequip` | POST `/send`

### Recipes (`/api/recipes`)
GET `/` | GET `/:id`

### Groups (`/api/groups`)
POST `/` (body: `nom, joueurId, leaderId`) | GET `/` | GET `/:id` | POST `/:id/characters` | DELETE `/:id/characters/:charId` | PATCH `/:id/move` | POST `/:id/enter-map` | POST `/:id/use-connection` | POST `/:id/move-direction` | DELETE `/:id`

### Combat (`/api/combats`)
POST `/` | GET `/` | GET `/:id` | POST `/:id/action` | POST `/:id/move` | POST `/:id/end-turn` | POST `/:id/flee` | DELETE `/:id`

### Maps (`/api/maps`)
PUT `/world-positions` | GET `/portals` (**avant** `/:id`) | GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/connections` | DELETE `/:id/connections/:connId` | POST `/:id/spawn-enemies` | POST `/:id/engage` | POST `/:id/respawn` | GET `/:id/grid` | PUT `/:id/grid/cases` | PUT `/:id/grid/spawns` | GET `/:id/pnj`

### Regions (`/api/regions`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/monstres` | DELETE `/:id/monstres/:monstreId`

### Monstres (`/api/monstres`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/sorts` | DELETE `/:id/sorts/:sortId` | POST `/:id/drops` | PATCH `/:id/drops/:dropId` | DELETE `/:id/drops/:dropId`

### Donjons (`/api/donjons`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id` | POST `/:id/enter` | GET `/run/:groupeId` | POST `/run/:groupeId/abandon` | GET `/run/solo/:charId` | POST `/run/solo/:charId/abandon`

### PNJ (`/api/pnj`)
GET `/map-status?mapId=X&personnageIds=1,2,3` (**avant** `/:id`) | GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`
POST `/:id/lignes` | PATCH `/:id/lignes/:ligneId` | DELETE `/:id/lignes/:ligneId`
POST `/:id/dialogues` | PATCH `/:id/dialogues/:dialogueId` | DELETE `/:id/dialogues/:dialogueId`
POST `/:id/buy` | POST `/:id/sell` | POST `/:id/interact` | POST `/:id/accept-quest` | POST `/:id/advance-quest`

### Quêtes admin (`/api/quetes`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`
POST `/:id/etapes` | PATCH `/:id/etapes/:etapeId` | DELETE `/:id/etapes/:etapeId`
POST `/:id/recompenses` | DELETE `/:id/recompenses/:recompenseId`
POST `/:id/prerequis` | DELETE `/:id/prerequis/:prerequisId`

### Métiers (`/api/metiers`)
GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`
POST `/:id/noeuds` | PATCH `/noeuds/:noeudId` | DELETE `/noeuds/:noeudId`
POST `/noeuds/:noeudId/ressources` | PATCH `/noeuds/ressources/:id` | DELETE `/noeuds/ressources/:id`

Maps : GET `/api/maps/:id/ressources` | POST `/api/maps/:id/ressources` | DELETE `/api/maps/:id/ressources/:ressourceId`
Characters : GET `/api/characters/:id/metiers` | POST `/api/characters/:id/harvest/:mapRessourceId`
PNJ gameplay : POST `/api/pnj/:id/learn-metier` `{ personnageId, metierId }`
PNJ admin : POST `/api/pnj/:id/metiers` `{ metierId }` | DELETE `/api/pnj/:id/metiers/:metierId`

### Familiers
Admin familles : GET/POST/PATCH/:id/DELETE `/api/familier-familles`
Admin races : GET/POST/PATCH/:id/DELETE `/api/familier-races` | POST `/:id/croisements` | DELETE `/:id/croisements/:croisementId`
Admin croisements : GET `/api/familier-croisements` (`?raceAId=X&raceBId=Y`) | POST `/` | PATCH `/:id` | DELETE `/:id`
Player : GET `/api/characters/:id/familiers` | POST `/:id/familiers/:fId/equip` | POST `/:id/familiers/unequip`
Enclos : POST `/api/familiers/:id/deposit` `{ enclosType, mapId, dureeMinutes, personnageId }` | POST `/:id/collect` `{ personnageId }`
Accouplement : POST `/api/familiers/breed` `{ familierAId, familierBId, mapId, dureeMinutes, personnageId }` | POST `/breed/collect` `{ assignmentId, personnageId }`
Renommer : PATCH `/api/familiers/:id` `{ personnageId, nom }`
Map : GET `/api/maps/:id/enclos`

### Static Data
`/api/races` | `/api/spells` (+ `/:id/effects`) | `/api/equipment` (+ `/:id/lignes`) | `/api/effects` | `/api/zones` | `/api/resources` | `/api/sets` | `/api/admin/recipes` | `/api/passives`
— tous : GET `/` | GET `/:id` | POST `/` | PATCH `/:id` | DELETE `/:id`

### Autres
`POST /api/import/maps` | `POST /api/import/monstres`
`POST /api/upload/map-image` → `frontend/public/assets/maps/`
`POST /api/upload/entity-image?type=characters|pnj|monsters|portals|races` → `{ url, filename }`

## Base de données — Tables clés

**Personnage** : `mapId/positionX/positionY` toujours renseigné (création → map 5). `imageUrl` calculé depuis `race.imageUrlHomme/Femme` (non stocké).

**Groupe** : `leaderId` obligatoire. Position portée par les Personnages (plus de posX/Y sur Groupe). Max 6 membres, même map que le leader.

**Combat** : `groupeId` OU `personnageId` (solo). `entiteActuelleId` = tour actif. `CombatEntite.armeData` = snapshot JSON avec `lignes[]`.

**Armes** : `LigneDegatsArme` ≥1 ligne obligatoire. Plus de champs plats. Snapshot `armeData.lignes[]` au début du combat.

**Sort flags** : `estSoin`, `estInvocation`, `estVolDeVie`, `estSelfBuff`, `estGlyphe`, `estPiege`, `ligneDirecte`, `tauxEchec`

**SortEffet** : `surCible` seul champ de ciblage (`true` = zone, `false` = lanceur). Glyphes/pièges nécessitent `surCible: true`.

**DonjonRun** : `groupeId @unique` OU `personnageId @unique`. Bloque la suppression du groupe.

**Metier** : `nom @unique`, `type MetierType @default(RECOLTE)` — distingue RECOLTE (nœuds) vs CRAFT (recettes). **PersonnageMetier** : `[personnageId, metierId] @unique`, `niveau`, `xp`. XP requis = `niveau * 100`.
**PnjMetier** : `[pnjId, metierId] @unique` — quels métiers un PNJ enseigne.
**NoeudRecolte** : `metierId`, `niveauMinAcces`, `xpRecolte Int @default(10)` (XP configurable par nœud). **NoeudRessource** : loot table par `niveauRequis` + `tauxDrop Float @default(1.0)` (on garde la ligne avec le niveauRequis le plus élevé ≤ niveau perso, par ressourceId, puis roll tauxDrop).
**MapRessource** : `[mapId, caseX, caseY] @unique`, `noeudId`, `respawnMinutes`, `lastHarvestAt DateTime?`.
**Recette** : `metierId Int?`, `niveauMetierRequis Int @default(1)`, `xpCraft Int @default(10)` — craft requiert le métier si `metierId` défini.

**QuetePersonnage** : contrainte unique `[queteId, personnageId]` (non-rejouable).

**Familier** : instance appartenant à un `Personnage`. Stats calculées à la création (base race + variance ±1). `estEquipe Boolean` + `Personnage.familierEquipeId @unique`. Ne peut pas être équipé s'il est en enclos.
**FamilierRace** : stats de base + croissance par niveau. `familleId` → `FamilierFamille`.
**FamilierCroisement** : `[raceAId, raceBId, raceEnfantId] @unique`, `probabilite`. Plusieurs enfants possibles par paire (roll pondéré sur totalProba). Lookup dans les deux sens (OR raceA/raceB) → 50/50 si aucun croisement défini.
**FamilierEnclosAssignment** : `enclosType EnclosType`, `mapId` (doit être VILLE), `dureeMinutes`. RENCONTRE : `partenaireAssignmentId @unique` (self-ref entre les deux assignments).
**MonstreDrop / MarchandLigne** : champ `familierRaceId Int?` → permet drop/achat de familiers.

### Enums
```
StatType: FORCE, INTELLIGENCE, DEXTERITE, AGILITE, VIE, CHANCE, PA, PM, PO, CRITIQUE, DOMMAGES, SOINS
SlotType: ARME, COIFFE, AMULETTE, BOUCLIER, HAUT, BAS, ANNEAU1, ANNEAU2, FAMILIER
EffetType: BUFF, DEBUFF, DISPEL, POUSSEE, ATTIRANCE, POISON, BOUCLIER, RESISTANCE
ZoneType: CASE, CROIX, LIGNE, CONE, CERCLE, LIGNE_PERPENDICULAIRE, DIAGONALE, CARRE, ANNEAU, CONE_INVERSE, T_FORME
MapType: WILDERNESS, VILLE, DONJON, BOSS, SAFE  |  IAType: EQUILIBRE, AGGRESSIF, SOUTIEN, DISTANCE
QueteEtapeType: PARLER_PNJ, TUER_MONSTRE, APPORTER_RESSOURCE, APPORTER_EQUIPEMENT
CombatStatus: EN_COURS, TERMINE, ABANDONNE  |  Sexe: HOMME, FEMME
MetierType: RECOLTE, CRAFT  |  EnclosType: ENTRAINEMENT, BONHEUR, RENCONTRE
```

## Systèmes principaux

**Combat** : `engine.ts` + sous-fichiers. Initiative alternée (AGI + random). XP distribué à tous joueurs (vivants + morts, hors invocations). Voir `memory/combat-details.md`.

**Navigation** : Personnage toujours sur une map. Solo via `/characters/:id/enter-map|move|move-direction|use-connection`. Groupe via `/groups/:id/...`.

**Maps** : WILDERNESS = ennemis visibles (MANUEL), DONJON/BOSS = AUTO. `worldX/Y` → liens directionnels calculés automatiquement via `PUT /maps/world-positions`.

**Quêtes** : `quest.service.ts`. Types PARLER_PNJ/TUER_MONSTRE/APPORTER_RESSOURCE/APPORTER_EQUIPEMENT. TUER_MONSTRE déclenché auto via `engine.ts checkCombatEnd()`.

**Inventaire/Drops** : `rollStats()` au drop/craft. Distribution individuelle (or, ressources normales) vs globale (équipements, ressources premium `estPremium`).

**Métiers de récolte** (`type: RECOLTE`) : `metier.service.ts`. Apprentissage via PNJ (`PnjMetier`). Récolte : vérifie métier + niveau + respawn → roll loot (meilleure NoeudRessource par ressourceId pour le niveau du perso → roll tauxDrop → roll quantité) → `InventaireRessource.upsert` → XP (`noeud.xpRecolte`) + level-up auto. Frontend : nœuds 🌳/🌾 sur MapPage, bottom bar affiche infos + bouton Récolter, section Métiers dans CharactersPage.

**Métiers de craft** (`type: CRAFT`) : `craft.service.ts`. Recette avec `metierId` : vérifie PersonnageMetier + niveau dans `canCraft()`. `craft()` retourne `{ item, metierProgression }` et XP (`recette.xpCraft`) + level-up auto. Recette sans `metierId` = libre (rétrocompatible). Frontend : badge métier coloré sur les recettes, message "+XP" post-craft. Admin RecettesPage/EquipementDetailPage : select métier + niveau requis + XP craft.

**Familiers** : `familier.service.ts`. Obtention via drop combat (`MonstreDrop.familierRaceId`) ou achat PNJ (`MarchandLigne.familierRaceId`). Stats créées depuis `FamilierRace.base*` ± variance ±1. XP requis = `niveau * 100`. Enclos ENTRAINEMENT (+1 XP/min), BONHEUR (+1 bonheur/min, max 100), RENCONTRE (accouplement). Accouplement requiert bonheur=100 + XP≥seuil sur les deux familiers + même famille + map VILLE. Enfants 1-3, race déterminée par `FamilierCroisement` (roll pondéré) ou 50/50. Stats enfant = héritage 50/50 + mutation ±10-20%. Familier équipé : ses 12 stats s'ajoutent dans `getTotalStats()`. Routing : `/breed/collect` DOIT être avant `/:id/collect` dans familier.routes.ts.
Frontend : `api/familiers.ts` (client API). Admin `/admin/familiers` (`FamiliersAdminPage`) — 2 sections : Familles+Races (accordéons, stats base+croissance) + Croisements (filtrable par paire). CharactersPage : section Familiers après Métiers (image race, stats, barre XP, barre bonheur, équiper/déséquiper inline, renommer inline). MapPage : l'enclos n'est PAS dans le panneau droit — il est accessible via le modal PNJ d'un "Gardien de l'enclos" (`pnj.estGardienEnclos === true`). L'onglet "🐾 Enclos" apparaît dans le modal PNJ uniquement si `estGardienEnclos`. Données chargées lazily à l'ouverture du modal. L'admin contrôle quelles maps VILLE ont un enclos en y plaçant ce PNJ. PNJDetailPage : checkbox "Gardien d'enclos" + type "Familier" dans lignes marchand (`familierRaceId`). MonstreDetailPage : type "Familier" dans drops (`familierRaceId`).

**Seed** : PNJ id=1 Chef (marchand + quêtes + enseigne Bûcheron), id=2 Garde (enseigne Agriculteur), id=3 Forgeron (enseigne Forgeron + Tailleur), id=4 Gardien de l'enclos (pos 13,9 village, `estGardienEnclos: true`). Quête id=1 "La menace des loups". Map id=3 supprimée (IDs ne se décalent pas).
Métiers RECOLTE : Bûcheron (id auto), Agriculteur (id auto). Métiers CRAFT : Forgeron, Tailleur (déclarés AVANT les recettes).
NoeudRecolte id=1 Chêne, id=2 Frêne, id=3 Champ de blé. NoeudRessource ids 1-8. MapRessources sur map 1 (Orée) : (5,3) Chêne, (12,5) Chêne, (8,14) Frêne. Ressources ajoutées : Blé, Lin, Bois de qualité.
Métiers craft seed : Forgeron (Casque niv1 15XP, Bouclier niv1 15XP, Anneau niv3 20XP, Marteau niv5 30XP), Tailleur (Plastron niv1 20XP, Amulette niv3 25XP).
Familiers seed : FamilierFamille "Loup". FamilierRace id=1 Loup Gris (gén.1), id=2 Loup Sombre (gén.2). Croisements : Gris×Gris→Gris 70% + Sombre 30%. MonstreDrop id=10 : Loup (id=2) → Loup Gris 15%. MarchandLigne id=10 : Chef village vend Loup Gris 500 or.

**Animations Spritesheet** : `src/utils/spriteConfig.ts` + `src/components/SpriteAnimator.tsx`.
- Clé = `imageUrl` statique de la race → mappe vers le sheet + layout. Fallback `<img>` auto si pas de config.
- États : `idle | walk-right/left/up/down | attack | hit | death`
- MapPage : `spriteState` suit la direction du BFS case par case. CombatPage : `entityAnimStates` Map + `triggerEntityAnim()`.
- Ajouter un sprite : générer `*-sheet.png` (Python, flood-fill bg + bottom-align pieds à y=376/384), ajouter entrée dans `SPRITE_CONFIG`.
- Layout standard : 7 rows × 4 cols, 256×384px/frame. Les rows source ne sont PAS à hauteur égale — analyser la densité pixel pour trouver les vraies frontières avant de découper.

## Conventions de code

- Fichiers: `kebab-case`/`camelCase.ts` | Endpoints: anglais | Modèles BDD: PascalCase français
- Erreurs : `{ error: "Message", details?: [] }` — 200/201/204/400/404/500

## Suppression (DELETE) — ordre de nettoyage

- **Race** : PersonnageSort + SortEffet + SortCooldown + MonstreSort des sorts → sorts → race
- **Sort** : SortEffet, PersonnageSort, SortCooldown, MonstreSort
- **Effet** : SortEffet, EffetActif
- **Zone** : nullifier `zoneId` sur Sort et Equipement
- **Region** : RegionMonstre
- **Map** : MapConnection, GroupeEnnemi, MapCase, MapSpawn, nullifier refs directionnelles
- **Monstre** : RegionMonstre, MonstreSort, QueteEtape (→ null)
- **PNJ** : MarchandLigne, nullifier QueteEtape.pnjId + Quete.pnjDepartId
- **Quête** : QuetePersonnage + QueteRequis (prerequisId=id) → delete (cascade → étapes/récompenses/requêtes)
- **Donjon** : DonjonRun (DonjonSalle cascade)
- **Combat** : nullifier invocateurId → CombatEntite (cascade EffetActif/SortCooldown/CombatCase/CombatLog)
- **Metier** : PnjMetier + PersonnageMetier + NoeudRecolte (cascade NoeudRessource + MapRessource)
- **NoeudRecolte** : NoeudRessource (cascade) + MapRessource (cascade)
- **FamilierFamille** : FamilierRace (→ cascade Familier + FamilierCroisement)
- **FamilierRace** : FamilierCroisement (croisementsA + croisementsB + croisementsEnfant), Familier, MonstreDrop.familierRaceId (→ null), MarchandLigne.familierRaceId (→ null)
- **Familier** : FamilierEnclosAssignment (cascade via onDelete:Cascade), nullifier Personnage.familierEquipeId

## Pour étendre le projet

**Endpoint** : `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `api/routes.ts`

**Table** : `schema.prisma` → `npx prisma db push` → `seed.ts`

**Sort** (seed) : `raceId, niveauRequis, coutPA, portee, zoneId, degatsMin/Max, cooldown` + flags selon besoin (`estSoin`, `estInvocation: true + invocationTemplateId`, `ligneDirecte`, `estSelfBuff`, `tauxEchec`)

**Type d'étape quête** : enum `QueteEtapeType` → `quest.service.ts` (filtre `etapesEnAttente` + switch `advancePnjStep`) → Zod `quetes.routes.ts` → `TYPE_LABELS` frontend

**IA** : `ai.ts executeAITurn()` → nouveau `executeXxxTurn()` + enum `IAType`

## Points d'attention

- `GET /api/maps/portals` DOIT être avant `GET /api/maps/:id`
- `GET /api/pnj/map-status` DOIT être avant `GET /api/pnj/:id`
- Prisma Json fields : cast `as unknown as T`
- Upsert seed : inclure les champs à normaliser dans `update:` (pas seulement `create:`)
- `prisma db push` au lieu de `migrate dev` en CLI non-interactif
- Armes : 0 lignes `LigneDegatsArme` → erreur (plus de fallback mono-ligne)
- Glyphes/pièges : `surCible: true` obligatoire sur SortEffets
- `double combat end` : guard `if combat.status !== EN_COURS` dans `checkCombatEnd`
- **Armes = portée fixe** : `porteeModifiable` forcé à `false` pour les attaques arme dans `CombatPage` (weaponMode sans selectedSort). Le bonus PO de l'équipement ne s'applique PAS aux attaques arme, seulement aux sorts avec `porteeModifiable: true`.
- **Prisma generate** : après `npx prisma db push`, toujours vérifier que `generate` s'est bien exécuté (risque EPERM si le serveur tourne). Arrêter le serveur avant si nécessaire, puis relancer.
- **MapSpawn count** : le backend vérifie `monstres.length <= enemySpawns.length`. Toutes les maps combat doivent avoir exactement 8 spawns joueur + 8 spawns ennemi.
- **ZoneType dans static.routes.ts ET import.routes.ts** : les deux ont leur propre `ZoneTypeEnum` Zod. Mettre à jour les deux lors de l'ajout d'un nouveau type de zone.
- Frontend port 5173 (Vite) | Backend port 3000 | Pas d'auth (MVP)
- `DATABASE_URL="postgresql://rpg_user:rpg_password@localhost:5432/rpg_tactique?schema=public"`
