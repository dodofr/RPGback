import { Router, Request, Response } from 'express';
import prisma from '../../config/database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [
      regions,
      maps,
      ressources,
      effets,
      sorts,
      monstres,
      equipements,
      recettes,
      pnjs,
      quetes,
      races,
    ] = await Promise.all([
      prisma.region.findMany(),
      prisma.map.findMany({ include: { region: true, cases: true, spawns: true } }),
      prisma.ressource.findMany(),
      prisma.effet.findMany(),
      prisma.sort.findMany({
        include: {
          zone: true,
          race: true,
          effets: { include: { effet: true } },
        },
      }),
      prisma.monstreTemplate.findMany({
        include: {
          sorts: { include: { sort: true } },
          drops: { include: { ressource: true, equipement: true } },
          regions: { include: { region: true } },
        },
      }),
      prisma.equipement.findMany({ include: { lignesDegats: true } }),
      prisma.recette.findMany({
        include: {
          equipement: true,
          ingredients: { include: { ressource: true } },
        },
      }),
      prisma.pNJ.findMany({
        include: {
          map: true,
          lignes: { include: { equipement: true, ressource: true } },
        },
      }),
      prisma.quete.findMany({
        include: {
          pnjDepart: true,
          etapes: {
            include: { pnj: true, monstreTemplate: true, ressource: true, equipement: true },
            orderBy: { ordre: 'asc' },
          },
          recompenses: { include: { ressource: true, equipement: true } },
          prerequis: { include: { prerequis: true } },
        },
      }),
      prisma.race.findMany(),
    ]);

    // ── Zones : collectées depuis sorts, dédupliquées par type+taille ──
    const zonesMap = new Map<string, { type: string; taille: number }>();
    for (const sort of sorts) {
      if (sort.zone) {
        const key = `${sort.zone.type}_${sort.zone.taille}`;
        if (!zonesMap.has(key)) {
          zonesMap.set(key, { type: sort.zone.type, taille: sort.zone.taille });
        }
      }
    }
    const zonesExport = Array.from(zonesMap.values());

    // ── Races ──
    const racesExport = races.map(r => ({
      nom: r.nom,
      bonusForce: r.bonusForce,
      bonusIntelligence: r.bonusIntelligence,
      bonusDexterite: r.bonusDexterite,
      bonusAgilite: r.bonusAgilite,
      bonusVie: r.bonusVie,
      bonusChance: r.bonusChance,
    }));

    // ── Régions ──
    const regionsExport = regions.map(r => ({
      nom: r.nom,
      type: r.type,
      niveauMin: r.niveauMin,
      niveauMax: r.niveauMax,
      description: r.description,
    }));

    // ── Maps ──
    const mapsExport = maps.map(m => ({
      nom: m.nom,
      region: m.region.nom,
      type: m.type,
      combatMode: m.combatMode,
      largeur: m.largeur,
      hauteur: m.hauteur,
      cases: m.cases.map((c: any) => ({
        x: c.x,
        y: c.y,
        bloqueDeplacement: c.bloqueDeplacement,
        bloqueLigneDeVue: c.bloqueLigneDeVue,
        estExclue: c.estExclue,
      })),
      spawns: m.spawns.map((s: any) => ({
        x: s.x,
        y: s.y,
        equipe: s.equipe,
        ordre: s.ordre,
      })),
    }));

    // ── Ressources ──
    const ressourcesExport = ressources.map(r => ({
      nom: r.nom,
      poids: r.poids,
      estPremium: r.estPremium,
    }));

    // ── Effets ──
    const effetsExport = effets.map(e => {
      const base: Record<string, unknown> = {
        nom: e.nom,
        type: e.type,
        statCiblee: e.statCiblee,
        duree: e.duree,
        cumulable: e.cumulable,
      };
      if (e.valeurMin != null) {
        // POISON : valeurMin + valeurMax (convention : valeur = valeurMax dans l'import)
        base.valeurMin = e.valeurMin;
        base.valeurMax = e.valeur;
      } else {
        base.valeur = e.valeur;
      }
      return base;
    });

    // ── Sorts ──
    const sortsExport = sorts.map(s => ({
      nom: s.nom,
      race: s.race?.nom ?? null,
      niveauRequis: s.niveauApprentissage,
      coutPA: s.coutPA,
      porteeMin: s.porteeMin,
      porteeMax: s.porteeMax,
      ligneDeVue: s.ligneDeVue,
      ligneDirecte: s.ligneDirecte,
      zone: s.zone ? { type: s.zone.type, taille: s.zone.taille } : null,
      degatsMin: s.degatsMin,
      degatsMax: s.degatsMax,
      degatsCritMin: s.degatsCritMin,
      degatsCritMax: s.degatsCritMax,
      estSoin: s.estSoin,
      estInvocation: s.estInvocation,
      estVolDeVie: s.estVolDeVie,
      estSelfBuff: s.estSelfBuff,
      tauxEchec: s.tauxEchec,
      cooldown: s.cooldown,
      effets: s.effets.map((se: any) => ({
        effet: se.effet.nom,
        chanceDeclenchement: se.chanceDeclenchement,
        surCible: se.surCible,
      })),
    }));

    // ── Monstres ──
    const monstresExport = monstres.map(m => ({
      nom: m.nom,
      niveauBase: m.niveauBase,
      force: m.force,
      intelligence: m.intelligence,
      dexterite: m.dexterite,
      agilite: m.agilite,
      vie: m.vie,
      chance: m.chance,
      paBase: m.paBase,
      pmBase: m.pmBase,
      pvBase: m.pvBase,
      resistanceForce: m.resistanceForce,
      resistanceIntelligence: m.resistanceIntelligence,
      resistanceDexterite: m.resistanceDexterite,
      resistanceAgilite: m.resistanceAgilite,
      iaType: m.iaType,
      xpRecompense: m.xpRecompense,
      orMin: m.orMin,
      orMax: m.orMax,
      pvScalingInvocation: m.pvScalingInvocation,
      sorts: m.sorts.map((ms: any) => ({
        sort: ms.sort.nom,
        priorite: ms.priorite,
      })),
      drops: m.drops.map((d: any) => {
        const base: Record<string, unknown> = {
          tauxDrop: d.tauxDrop,
          quantiteMin: d.quantiteMin,
          quantiteMax: d.quantiteMax,
        };
        if (d.ressource) base.ressource = d.ressource.nom;
        if (d.equipement) base.equipement = d.equipement.nom;
        return base;
      }),
      regions: m.regions.map((rm: any) => ({
        region: rm.region.nom,
        probabilite: rm.probabilite,
      })),
    }));

    // ── Équipements ──
    const equipementsExport = equipements.map(e => ({
      nom: e.nom,
      slot: e.slot,
      niveauRequis: e.niveauMinimum,
      poids: e.poids,
      bonusForce: e.bonusForce,
      bonusForceMax: e.bonusForceMax,
      bonusIntelligence: e.bonusIntelligence,
      bonusIntelligenceMax: e.bonusIntelligenceMax,
      bonusDexterite: e.bonusDexterite,
      bonusDexteriteMax: e.bonusDexteriteMax,
      bonusAgilite: e.bonusAgilite,
      bonusAgiliteMax: e.bonusAgiliteMax,
      bonusVie: e.bonusVie,
      bonusVieMax: e.bonusVieMax,
      bonusChance: e.bonusChance,
      bonusChanceMax: e.bonusChanceMax,
      bonusPA: e.bonusPA,
      bonusPAMax: e.bonusPAMax,
      bonusPM: e.bonusPM,
      bonusPMMax: e.bonusPMMax,
      bonusPO: e.bonusPO,
      bonusPOMax: e.bonusPOMax,
      bonusCritique: e.bonusCritique,
      bonusCritiqueMax: e.bonusCritiqueMax,
      bonusDommages: e.bonusDommages,
      bonusDommagesMax: e.bonusDommagesMax,
      bonusSoins: e.bonusSoins,
      bonusSoinsMax: e.bonusSoinsMax,
      resistanceForce: e.resistanceForce,
      resistanceForceMax: e.resistanceForceMax,
      resistanceIntelligence: e.resistanceIntelligence,
      resistanceIntelligenceMax: e.resistanceIntelligenceMax,
      resistanceDexterite: e.resistanceDexterite,
      resistanceDexteriteMax: e.resistanceDexteriteMax,
      resistanceAgilite: e.resistanceAgilite,
      resistanceAgiliteMax: e.resistanceAgiliteMax,
      degatsMin: e.degatsMin,
      degatsMax: e.degatsMax,
      chanceCritBase: e.chanceCritBase,
      coutPA: e.coutPA,
      porteeMin: e.porteeMin,
      porteeMax: e.porteeMax,
      ligneDeVue: e.ligneDeVue,
      tauxEchec: e.tauxEchec,
      estVolDeVie: e.estVolDeVie,
      bonusCrit: e.bonusCrit,
      lignes: e.lignesDegats.map((l: any) => ({
        ordre: l.ordre,
        degatsMin: l.degatsMin,
        degatsMax: l.degatsMax,
        statUtilisee: l.statUtilisee,
        estVolDeVie: l.estVolDeVie,
        estSoin: l.estSoin,
      })),
    }));

    // ── Recettes ──
    const recettesExport = recettes.map(r => ({
      nom: r.nom,
      equipement: r.equipement.nom,
      niveauMinimum: r.niveauMinimum,
      coutOr: r.coutOr,
      ingredients: r.ingredients.map((i: any) => ({
        ressource: i.ressource.nom,
        quantite: i.quantite,
      })),
    }));

    // ── PNJ ──
    const pnjExport = pnjs.map(p => ({
      nom: p.nom,
      map: p.map?.nom ?? null,
      positionX: p.positionX,
      positionY: p.positionY,
      description: p.description,
      estMarchand: p.estMarchand,
      marchandLignes: p.lignes.map((l: any) => {
        const base: Record<string, unknown> = {
          prixMarchand: l.prixMarchand,
          prixRachat: l.prixRachat,
        };
        if (l.equipement) base.equipement = l.equipement.nom;
        if (l.ressource) base.ressource = l.ressource.nom;
        return base;
      }),
    }));

    // ── Quêtes ──
    const quetesExport = quetes.map(q => ({
      nom: q.nom,
      description: q.description,
      niveauRequis: q.niveauRequis,
      pnjDepart: q.pnjDepart?.nom ?? null,
      etapes: q.etapes.map((e: any) => {
        const base: Record<string, unknown> = {
          ordre: e.ordre,
          type: e.type,
          description: e.description,
        };
        if (e.pnj) base.pnj = e.pnj.nom;
        if (e.monstreTemplate) base.monstreTemplate = e.monstreTemplate.nom;
        if (e.quantite != null) base.quantite = e.quantite;
        if (e.ressource) base.ressource = e.ressource.nom;
        if (e.equipement) base.equipement = e.equipement.nom;
        return base;
      }),
      recompenses: q.recompenses.map((r: any) => {
        const base: Record<string, unknown> = {};
        if (r.xp) base.xp = r.xp;
        if (r.or) base.or = r.or;
        if (r.ressource) { base.ressource = r.ressource.nom; base.quantite = r.quantite; }
        if (r.equipement) base.equipement = r.equipement.nom;
        return base;
      }),
      prerequis: q.prerequis.map((p: any) => p.prerequis.nom),
    }));

    res.json({
      regions: regionsExport,
      maps: mapsExport,
      ressources: ressourcesExport,
      effets: effetsExport,
      zones: zonesExport,
      races: racesExport,
      sorts: sortsExport,
      monstres: monstresExport,
      equipements: equipementsExport,
      recettes: recettesExport,
      pnj: pnjExport,
      quetes: quetesExport,
    });
  } catch (err: any) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'export', details: err?.message });
  }
});

export default router;
