-- CreateEnum
CREATE TYPE "StatType" AS ENUM ('FORCE', 'INTELLIGENCE', 'DEXTERITE', 'AGILITE', 'ENDURANCE', 'CHANCE');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('CASE', 'CROIX', 'LIGNE', 'CONE', 'CERCLE');

-- CreateEnum
CREATE TYPE "SortType" AS ENUM ('ARME', 'SORT');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('ARME', 'COIFFE', 'AMULETTE', 'BOUCLIER', 'HAUT', 'BAS', 'ANNEAU1', 'ANNEAU2', 'FAMILIER');

-- CreateEnum
CREATE TYPE "EffetType" AS ENUM ('BUFF', 'DEBUFF');

-- CreateEnum
CREATE TYPE "CombatStatus" AS ENUM ('EN_COURS', 'TERMINE', 'ABANDONNE');

-- CreateTable
CREATE TABLE "Race" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "bonusForce" INTEGER NOT NULL DEFAULT 0,
    "bonusIntelligence" INTEGER NOT NULL DEFAULT 0,
    "bonusDexterite" INTEGER NOT NULL DEFAULT 0,
    "bonusAgilite" INTEGER NOT NULL DEFAULT 0,
    "bonusEndurance" INTEGER NOT NULL DEFAULT 0,
    "bonusChance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "statPrincipale" "StatType" NOT NULL,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "taille" INTEGER NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sort" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "SortType" NOT NULL,
    "statUtilisee" "StatType" NOT NULL,
    "coutPA" INTEGER NOT NULL,
    "porteeMin" INTEGER NOT NULL,
    "porteeMax" INTEGER NOT NULL,
    "ligneDeVue" BOOLEAN NOT NULL DEFAULT true,
    "degatsMin" INTEGER NOT NULL,
    "degatsMax" INTEGER NOT NULL,
    "degatsCrit" INTEGER NOT NULL,
    "chanceCritBase" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "zoneId" INTEGER,
    "classeId" INTEGER,

    CONSTRAINT "Sort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipement" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "slot" "SlotType" NOT NULL,
    "bonusForce" INTEGER NOT NULL DEFAULT 0,
    "bonusIntelligence" INTEGER NOT NULL DEFAULT 0,
    "bonusDexterite" INTEGER NOT NULL DEFAULT 0,
    "bonusAgilite" INTEGER NOT NULL DEFAULT 0,
    "bonusEndurance" INTEGER NOT NULL DEFAULT 0,
    "bonusChance" INTEGER NOT NULL DEFAULT 0,
    "bonusPA" INTEGER NOT NULL DEFAULT 0,
    "bonusPM" INTEGER NOT NULL DEFAULT 0,
    "bonusPO" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Equipement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Effet" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "EffetType" NOT NULL,
    "statCiblee" "StatType" NOT NULL,
    "valeur" INTEGER NOT NULL,
    "duree" INTEGER NOT NULL,

    CONSTRAINT "Effet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Joueur" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Joueur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnage" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "force" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "dexterite" INTEGER NOT NULL,
    "agilite" INTEGER NOT NULL,
    "endurance" INTEGER NOT NULL,
    "chance" INTEGER NOT NULL,
    "joueurId" INTEGER NOT NULL,
    "raceId" INTEGER NOT NULL,
    "classeId" INTEGER NOT NULL,
    "equipements" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Personnage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Groupe" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "regionId" INTEGER NOT NULL DEFAULT 1,
    "joueurId" INTEGER NOT NULL,

    CONSTRAINT "Groupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupePersonnage" (
    "groupeId" INTEGER NOT NULL,
    "personnageId" INTEGER NOT NULL,

    CONSTRAINT "GroupePersonnage_pkey" PRIMARY KEY ("groupeId","personnageId")
);

-- CreateTable
CREATE TABLE "Combat" (
    "id" SERIAL NOT NULL,
    "status" "CombatStatus" NOT NULL DEFAULT 'EN_COURS',
    "tourActuel" INTEGER NOT NULL DEFAULT 1,
    "grilleLargeur" INTEGER NOT NULL,
    "grilleHauteur" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatEntite" (
    "id" SERIAL NOT NULL,
    "combatId" INTEGER NOT NULL,
    "personnageId" INTEGER,
    "nom" TEXT NOT NULL,
    "equipe" INTEGER NOT NULL,
    "positionX" INTEGER NOT NULL,
    "positionY" INTEGER NOT NULL,
    "initiative" INTEGER NOT NULL,
    "ordreJeu" INTEGER NOT NULL,
    "pvMax" INTEGER NOT NULL,
    "pvActuels" INTEGER NOT NULL,
    "paMax" INTEGER NOT NULL,
    "paActuels" INTEGER NOT NULL,
    "pmMax" INTEGER NOT NULL,
    "pmActuels" INTEGER NOT NULL,
    "force" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "dexterite" INTEGER NOT NULL,
    "agilite" INTEGER NOT NULL,
    "endurance" INTEGER NOT NULL,
    "chance" INTEGER NOT NULL,

    CONSTRAINT "CombatEntite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EffetActif" (
    "id" SERIAL NOT NULL,
    "combatId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "effetId" INTEGER NOT NULL,
    "toursRestants" INTEGER NOT NULL,

    CONSTRAINT "EffetActif_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Race_nom_key" ON "Race"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_nom_key" ON "Classe"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Joueur_nom_key" ON "Joueur"("nom");

-- AddForeignKey
ALTER TABLE "Sort" ADD CONSTRAINT "Sort_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sort" ADD CONSTRAINT "Sort_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnage" ADD CONSTRAINT "Personnage_joueurId_fkey" FOREIGN KEY ("joueurId") REFERENCES "Joueur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnage" ADD CONSTRAINT "Personnage_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnage" ADD CONSTRAINT "Personnage_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Groupe" ADD CONSTRAINT "Groupe_joueurId_fkey" FOREIGN KEY ("joueurId") REFERENCES "Joueur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupePersonnage" ADD CONSTRAINT "GroupePersonnage_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupePersonnage" ADD CONSTRAINT "GroupePersonnage_personnageId_fkey" FOREIGN KEY ("personnageId") REFERENCES "Personnage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombatEntite" ADD CONSTRAINT "CombatEntite_combatId_fkey" FOREIGN KEY ("combatId") REFERENCES "Combat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EffetActif" ADD CONSTRAINT "EffetActif_combatId_fkey" FOREIGN KEY ("combatId") REFERENCES "Combat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
