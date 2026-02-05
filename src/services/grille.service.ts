import prisma from '../config/database';

export class GrilleService {
  async create(data: {
    nom: string;
    mapId: number;
    largeur: number;
    hauteur: number;
    cases: { x: number; y: number; bloqueDeplacement: boolean; bloqueLigneDeVue: boolean }[];
    spawns: { x: number; y: number; equipe: number; ordre: number }[];
  }) {
    // Validate map exists
    const map = await prisma.map.findUnique({ where: { id: data.mapId } });
    if (!map) {
      throw new Error('Map not found');
    }

    // Validate spawns: exactly 8 per team
    const playerSpawns = data.spawns.filter(s => s.equipe === 0);
    const enemySpawns = data.spawns.filter(s => s.equipe === 1);
    if (playerSpawns.length !== 8) {
      throw new Error('Exactly 8 player spawns (equipe=0) required');
    }
    if (enemySpawns.length !== 8) {
      throw new Error('Exactly 8 enemy spawns (equipe=1) required');
    }

    // Validate all positions within bounds
    const spawnPositions = new Set<string>();
    for (const spawn of data.spawns) {
      if (spawn.x < 0 || spawn.x >= data.largeur || spawn.y < 0 || spawn.y >= data.hauteur) {
        throw new Error(`Spawn position (${spawn.x}, ${spawn.y}) is out of grid bounds`);
      }
      spawnPositions.add(`${spawn.x},${spawn.y}`);
    }

    for (const c of data.cases) {
      if (c.x < 0 || c.x >= data.largeur || c.y < 0 || c.y >= data.hauteur) {
        throw new Error(`Obstacle position (${c.x}, ${c.y}) is out of grid bounds`);
      }
      if (spawnPositions.has(`${c.x},${c.y}`)) {
        throw new Error(`Obstacle at (${c.x}, ${c.y}) conflicts with a spawn position`);
      }
    }

    return prisma.grilleCombat.create({
      data: {
        nom: data.nom,
        mapId: data.mapId,
        largeur: data.largeur,
        hauteur: data.hauteur,
        cases: {
          create: data.cases.map(c => ({
            x: c.x,
            y: c.y,
            bloqueDeplacement: c.bloqueDeplacement,
            bloqueLigneDeVue: c.bloqueLigneDeVue,
          })),
        },
        spawns: {
          create: data.spawns.map(s => ({
            x: s.x,
            y: s.y,
            equipe: s.equipe,
            ordre: s.ordre,
          })),
        },
      },
      include: {
        cases: true,
        spawns: { orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }] },
        map: { select: { id: true, nom: true } },
      },
    });
  }

  async findAll() {
    return prisma.grilleCombat.findMany({
      include: {
        map: { select: { id: true, nom: true } },
        _count: { select: { cases: true, spawns: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    return prisma.grilleCombat.findUnique({
      where: { id },
      include: {
        cases: true,
        spawns: { orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }] },
        map: { select: { id: true, nom: true } },
      },
    });
  }

  async update(id: number, data: {
    nom: string;
    mapId: number;
    largeur: number;
    hauteur: number;
    cases: { x: number; y: number; bloqueDeplacement: boolean; bloqueLigneDeVue: boolean }[];
    spawns: { x: number; y: number; equipe: number; ordre: number }[];
  }) {
    const existing = await prisma.grilleCombat.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Grid not found');
    }

    const map = await prisma.map.findUnique({ where: { id: data.mapId } });
    if (!map) {
      throw new Error('Map not found');
    }

    // Validate spawns
    const playerSpawns = data.spawns.filter(s => s.equipe === 0);
    const enemySpawns = data.spawns.filter(s => s.equipe === 1);
    if (playerSpawns.length !== 8) {
      throw new Error('Exactly 8 player spawns (equipe=0) required');
    }
    if (enemySpawns.length !== 8) {
      throw new Error('Exactly 8 enemy spawns (equipe=1) required');
    }

    const spawnPositions = new Set<string>();
    for (const spawn of data.spawns) {
      if (spawn.x < 0 || spawn.x >= data.largeur || spawn.y < 0 || spawn.y >= data.hauteur) {
        throw new Error(`Spawn position (${spawn.x}, ${spawn.y}) is out of grid bounds`);
      }
      spawnPositions.add(`${spawn.x},${spawn.y}`);
    }

    for (const c of data.cases) {
      if (c.x < 0 || c.x >= data.largeur || c.y < 0 || c.y >= data.hauteur) {
        throw new Error(`Obstacle position (${c.x}, ${c.y}) is out of grid bounds`);
      }
      if (spawnPositions.has(`${c.x},${c.y}`)) {
        throw new Error(`Obstacle at (${c.x}, ${c.y}) conflicts with a spawn position`);
      }
    }

    // Delete existing cases and spawns, then recreate
    await prisma.grilleCase.deleteMany({ where: { grilleId: id } });
    await prisma.grilleSpawn.deleteMany({ where: { grilleId: id } });

    return prisma.grilleCombat.update({
      where: { id },
      data: {
        nom: data.nom,
        mapId: data.mapId,
        largeur: data.largeur,
        hauteur: data.hauteur,
        cases: {
          create: data.cases.map(c => ({
            x: c.x,
            y: c.y,
            bloqueDeplacement: c.bloqueDeplacement,
            bloqueLigneDeVue: c.bloqueLigneDeVue,
          })),
        },
        spawns: {
          create: data.spawns.map(s => ({
            x: s.x,
            y: s.y,
            equipe: s.equipe,
            ordre: s.ordre,
          })),
        },
      },
      include: {
        cases: true,
        spawns: { orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }] },
        map: { select: { id: true, nom: true } },
      },
    });
  }

  async delete(id: number) {
    const existing = await prisma.grilleCombat.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Grid not found');
    }
    await prisma.grilleCombat.delete({ where: { id } });
  }

  async replaceCases(id: number, cases: { x: number; y: number; bloqueDeplacement: boolean; bloqueLigneDeVue: boolean }[]) {
    const grille = await prisma.grilleCombat.findUnique({
      where: { id },
      include: { spawns: true },
    });
    if (!grille) {
      throw new Error('Grid not found');
    }

    const spawnPositions = new Set(grille.spawns.map(s => `${s.x},${s.y}`));

    for (const c of cases) {
      if (c.x < 0 || c.x >= grille.largeur || c.y < 0 || c.y >= grille.hauteur) {
        throw new Error(`Obstacle position (${c.x}, ${c.y}) is out of grid bounds`);
      }
      if (spawnPositions.has(`${c.x},${c.y}`)) {
        throw new Error(`Obstacle at (${c.x}, ${c.y}) conflicts with a spawn position`);
      }
    }

    await prisma.grilleCase.deleteMany({ where: { grilleId: id } });

    if (cases.length > 0) {
      await prisma.grilleCase.createMany({
        data: cases.map(c => ({
          grilleId: id,
          x: c.x,
          y: c.y,
          bloqueDeplacement: c.bloqueDeplacement,
          bloqueLigneDeVue: c.bloqueLigneDeVue,
        })),
      });
    }

    return this.findById(id);
  }

  async replaceSpawns(id: number, spawns: { x: number; y: number; equipe: number; ordre: number }[]) {
    const grille = await prisma.grilleCombat.findUnique({
      where: { id },
      include: { cases: true },
    });
    if (!grille) {
      throw new Error('Grid not found');
    }

    const playerSpawns = spawns.filter(s => s.equipe === 0);
    const enemySpawns = spawns.filter(s => s.equipe === 1);
    if (playerSpawns.length !== 8) {
      throw new Error('Exactly 8 player spawns (equipe=0) required');
    }
    if (enemySpawns.length !== 8) {
      throw new Error('Exactly 8 enemy spawns (equipe=1) required');
    }

    const obstaclePositions = new Set(grille.cases.map(c => `${c.x},${c.y}`));

    for (const s of spawns) {
      if (s.x < 0 || s.x >= grille.largeur || s.y < 0 || s.y >= grille.hauteur) {
        throw new Error(`Spawn position (${s.x}, ${s.y}) is out of grid bounds`);
      }
      if (obstaclePositions.has(`${s.x},${s.y}`)) {
        throw new Error(`Spawn at (${s.x}, ${s.y}) conflicts with an obstacle`);
      }
    }

    await prisma.grilleSpawn.deleteMany({ where: { grilleId: id } });

    await prisma.grilleSpawn.createMany({
      data: spawns.map(s => ({
        grilleId: id,
        x: s.x,
        y: s.y,
        equipe: s.equipe,
        ordre: s.ordre,
      })),
    });

    return this.findById(id);
  }

  /**
   * Get a random combat grid template for a given map
   */
  async getRandomGridForMap(mapId: number) {
    const grilles = await prisma.grilleCombat.findMany({
      where: { mapId },
      include: {
        cases: true,
        spawns: { orderBy: [{ equipe: 'asc' }, { ordre: 'asc' }] },
      },
    });

    if (grilles.length === 0) {
      throw new Error(`No combat grid templates configured for map ${mapId}`);
    }

    // Pick a random one
    const index = Math.floor(Math.random() * grilles.length);
    return grilles[index];
  }
}

export const grilleService = new GrilleService();
