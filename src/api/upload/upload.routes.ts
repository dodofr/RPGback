import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const ASSETS_BASE = path.resolve(__dirname, '../../../../frontend/public/assets');
const ALLOWED_TYPES = ['maps', 'characters', 'pnj', 'monsters', 'portals', 'races'];

const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function sanitizeFilename(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${base}${ext}`;
}

function makeStorage(subfolder: string) {
  const dir = path.join(ASSETS_BASE, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => cb(null, sanitizeFilename(file.originalname)),
  });
}

function makeUpload(subfolder: string) {
  return multer({
    storage: makeStorage(subfolder),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error('Format non supporté. Utilisez PNG, JPG, WEBP ou GIF.'));
    },
  });
}

// POST /api/upload/map-image  (rétrocompat)
router.post('/map-image', makeUpload('maps').single('image'), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Aucun fichier reçu' }); return; }
  res.json({ url: `/assets/maps/${req.file.filename}`, filename: req.file.filename });
});

// POST /api/upload/entity-image?type=characters|pnj|monsters|portals
router.post('/entity-image', (req: Request, res: Response) => {
  const type = req.query.type as string;
  if (!ALLOWED_TYPES.includes(type)) {
    res.status(400).json({ error: `Type invalide. Valeurs acceptées: ${ALLOWED_TYPES.join(', ')}` });
    return;
  }
  makeUpload(type).single('image')(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    if (!req.file) { res.status(400).json({ error: 'Aucun fichier reçu' }); return; }
    res.json({ url: `/assets/${type}/${req.file.filename}`, filename: req.file.filename });
  });
});

export default router;
