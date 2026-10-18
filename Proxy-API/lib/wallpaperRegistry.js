'use strict';

/*
 * KING X — server-side wallpaper allow-list.
 *
 * This is the security boundary for the private "chat-wallpapers" bucket:
 * a signed URL is only ever minted for a filename that appears in this list.
 * Anything a client sends that is not registered here (path traversal, an
 * arbitrary bucket object, another user's upload, ...) is rejected.
 *
 * It MUST mirror `WALLPAPERS` in the mobile app's `src/utils/chatTheme.js`
 * (same `id` and `file` values). When a wallpaper is added there, add the same
 * one line here. Filenames are kept byte-for-byte, including the original
 * "obisidian.webp" and "vegeta-ulta-2-db.webp" spellings.
 */

const WALLPAPERS = [
  { id: 'goku-ultra-2-db', file: 'goku-ultra-2-db.webp' },
  { id: 'awaken-gohan-db', file: 'awaken-gohan-db.webp' },
  { id: 'beerus-db', file: 'beerus-db.webp' },
  { id: 'beru-sl', file: 'beru-sl.webp' },
  { id: 'cave-blue', file: 'cave-blue.webp' },
  { id: 'cha-hae-sl', file: 'cha-hae-sl.webp' },
  { id: 'couple', file: 'couple.webp' },
  { id: 'doraemon', file: 'doraemon.webp' },
  { id: 'eren-titan-aot', file: 'eren-titan-aot.webp' },
  { id: 'erwin-aot', file: 'erwin-aot.webp' },
  { id: 'galaxy', file: 'galaxy.webp' },
  { id: 'goku-ultra', file: 'goku-ultra-db.webp' },
  { id: 'hinata-n', file: 'hinata-n.webp' },
  { id: 'itachi-n', file: 'itachi-n.webp' },
  { id: 'jellyfish-blue', file: 'jellyfish-blue.webp' },
  { id: 'jinha-sl', file: 'jinha-sl.webp' },
  { id: 'jinwoo-sl', file: 'jinwoo-sl.webp' },
  { id: 'lava', file: 'lava.webp' },
  { id: 'madara-n', file: 'madara-n.webp' },
  { id: 'naruto-n', file: 'naruto-n.webp' },
  { id: 'nature', file: 'nature.webp' },
  { id: 'obisidian', file: 'obisidian.webp' },
  { id: 'orange-piccolo', file: 'orange-piccolo.webp' },
  { id: 'purple', file: 'purple.webp' },
  { id: 'roshi-db', file: 'roshi-db.webp' },
  { id: 'sukuna-jjk', file: 'sukuna-jjk.webp' },
  { id: 'two-hearts', file: 'two-hearts.webp' },
  { id: 'unknown-places', file: 'unknown-places.webp' },
  { id: 'vegeta-db', file: 'vegeta-db.webp' },
  { id: 'vegeta-ulta-2-db', file: 'vegeta-ulta-2-db.webp' },
  { id: 'shinron', file: 'shinron.webp' },
];

/* Maximum ids accepted in one request, to keep the response and the signing
 * call bounded. The full registry is only 31 entries, so this is generous. */
const MAX_REQUEST_IDS = 50;

const BY_ID = new Map(WALLPAPERS.map((w) => [w.id, w.file]));
const BY_FILE = new Map(WALLPAPERS.map((w) => [w.file, w.id]));

/** Canonical list of registered Storage object names. */
const FILES = WALLPAPERS.map((w) => w.file);

/**
 * Resolve one client-supplied value (a wallpaper id OR a filename) to the
 * canonical registered filename, or `null` when it is not registered.
 */
function resolveWallpaper(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;
  if (BY_ID.has(value)) return BY_ID.get(value);
  if (BY_FILE.has(value)) return value;
  return null;
}

/**
 * Resolve a list of client values to a de-duplicated list of registered
 * filenames, plus the values that were not recognised.
 *
 * @param {Array} inputs
 * @returns {{ files: string[], unknown: string[] }}
 */
function resolveWallpapers(inputs) {
  const files = [];
  const unknown = [];
  const seen = new Set();
  const list = Array.isArray(inputs) ? inputs : [];

  for (const raw of list) {
    const file = resolveWallpaper(raw);
    if (!file) {
      unknown.push(typeof raw === 'string' ? raw : String(raw));
      continue;
    }
    if (!seen.has(file)) {
      seen.add(file);
      files.push(file);
    }
  }

  return { files, unknown };
}

module.exports = {
  WALLPAPERS,
  FILES,
  MAX_REQUEST_IDS,
  resolveWallpaper,
  resolveWallpapers,
  isValidWallpaperId: (value) => BY_ID.has(typeof value === 'string' ? value.trim() : value),
  isValidFile: (value) => BY_FILE.has(typeof value === 'string' ? value.trim() : value),
  fileForId: (id) => BY_ID.get(typeof id === 'string' ? id.trim() : id) || null,
  idForFile: (file) => BY_FILE.get(typeof file === 'string' ? file.trim() : file) || null,
};
