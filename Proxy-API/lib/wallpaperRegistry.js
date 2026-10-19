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
 * one line here. Filenames are the exact private Storage object names.
 */

const WALLPAPERS = [
  /* Dragon Ball */
  { id: '17-x-18-db', file: '17-x-18-db.webp' },
  { id: 'awaken-gohan-db', file: 'awaken-gohan-db.webp' },
  { id: 'beerus-db', file: 'beerus-db.webp' },
  { id: 'bulma-db', file: 'bulma-db.webp' },
  { id: 'cell-db', file: 'cell-db.webp' },
  { id: 'destroyers-x-angels-db', file: 'destroyers-x-angels-db.webp' },
  { id: 'fat-buu-db', file: 'fat-buu-db.webp' },
  { id: 'frieza-base-db', file: 'frieza-base-db.webp' },
  { id: 'frieza-black-db', file: 'frieza-black-db.webp' },
  { id: 'frieza-golden-db', file: 'frieza-golden-db.webp' },
  { id: 'gogeta-ssj-blue-db', file: 'gogeta-ssj-blue-db.webp' },
  { id: 'goku-black-db', file: 'goku-black-db.webp' },
  { id: 'goku-black-ssj-rose-db', file: 'goku-black-ssj-rose-db.webp' },
  { id: 'goku-ssj-4-db', file: 'goku-ssj-4-db.webp' },
  { id: 'goku-ssj-blue-db', file: 'goku-ssj-blue-db.webp' },
  { id: 'goku-ssj-god-db', file: 'goku-ssj-god-db.webp' },
  { id: 'goku-ultra-db', file: 'goku-ultra-db.webp' },
  { id: 'goku-ultra-stand', file: 'goku-ultra-stand.webp' },
  { id: 'goku-x-jiren-db', file: 'goku-x-jiren-db.webp' },
  { id: 'gotenks-db', file: 'gotenks-db.webp' },
  { id: 'jiren-db', file: 'jiren-db.webp' },
  { id: 'kid-buu-db', file: 'kid-buu-db.webp' },
  { id: 'orange-piccolo', file: 'orange-piccolo.webp' },
  { id: 'pilaf-team-db', file: 'pilaf-team-db.webp' },
  { id: 'roshi-db', file: 'roshi-db.webp' },
  { id: 'shenron-db', file: 'shenron-db.webp' },
  { id: 'trunks-evil-db', file: 'trunks-evil-db.webp' },
  { id: 'vegeta-db', file: 'vegeta-db.webp' },
  { id: 'vegeta-ssj-blue-db', file: 'vegeta-ssj-blue-db.webp' },
  { id: 'vegeta-ssj-god-db', file: 'vegeta-ssj-god-db.webp' },
  { id: 'vegeta-ultra', file: 'vegeta-ultra.webp' },
  { id: 'vegito-ssj-blue-db', file: 'vegito-ssj-blue-db.webp' },
  { id: 'zamasu-halo-db', file: 'zamasu-halo-db.webp' },
  { id: 'zeno-db', file: 'zeno-db.webp' },

  /* Naruto */
  { id: 'hinata-n', file: 'hinata-n.webp' },
  { id: 'itachi-n', file: 'itachi-n.webp' },
  { id: 'kakashi-hatake-n', file: 'kakashi-hatake-n.webp' },
  { id: 'madara-n', file: 'madara-n.webp' },
  { id: 'naruto-n', file: 'naruto-n.webp' },
  { id: 'obito-n', file: 'obito-n.webp' },
  { id: 'sasuke-n', file: 'sasuke-n.webp' },

  /* Attack on Titan */
  { id: 'all-titans-x-eren', file: 'all-titans-x-eren.webp' },
  { id: 'armin-aot', file: 'armin-aot.webp' },
  { id: 'eren-long-hair-titans-aot', file: 'eren-long-hair-titans-aot.webp' },
  { id: 'eren-titan-aot', file: 'eren-titan-aot.webp' },
  { id: 'eren-x-mikasa-aot', file: 'eren-x-mikasa-aot.webp' },
  { id: 'erwin-aot', file: 'erwin-aot.webp' },
  { id: 'levi-ackerman-aot', file: 'levi-ackerman-aot.webp' },
  { id: 'mikasa-ackerman-aot', file: 'mikasa-ackerman-aot.webp' },

  /* Jujutsu Kaisen */
  { id: 'geto-jjk', file: 'geto-jjk.webp' },
  { id: 'gojo-hollow-purple-jjk', file: 'gojo-hollow-purple-jjk.webp' },
  { id: 'gojo-jjk', file: 'gojo-jjk.webp' },
  { id: 'gojo-red-blue-jjk', file: 'gojo-red-blue-jjk.webp' },
  { id: 'gojo-x-sukuna-jjk', file: 'gojo-x-sukuna-jjk.webp' },
  { id: 'igris-jjk', file: 'igris-jjk.webp' },
  { id: 'inumaki-jjk', file: 'inumaki-jjk.webp' },
  { id: 'kento-nanami-jjk', file: 'kento-nanami-jjk.webp' },
  { id: 'maki-zenin-jjk', file: 'maki-zenin-jjk.webp' },
  { id: 'megumi-fushiguro-jjk', file: 'megumi-fushiguro-jjk.webp' },
  { id: 'nobara-kugisaki-jjk', file: 'nobara-kugisaki-jjk.webp' },
  { id: 'panda-jjk', file: 'panda-jjk.webp' },
  { id: 'sukuna-domain-jjk', file: 'sukuna-domain-jjk.webp' },
  { id: 'sukuna-jjk', file: 'sukuna-jjk.webp' },
  { id: 'toji-fushiguro', file: 'toji-fushiguro.webp' },
  { id: 'yuta-jjk', file: 'yuta-jjk.webp' },

  /* One Piece */
  { id: 'luffy-gear-5-op', file: 'luffy-gear-5-op.webp' },
  { id: 'roronoa-zoro-op', file: 'roronoa-zoro-op.webp' },
  { id: 'shanks-op', file: 'shanks-op.webp' },

  /* Solo Leveling */
  { id: 'beru-sl', file: 'beru-sl.webp' },
  { id: 'cha-hae-in-sl', file: 'cha-hae-in-sl.webp' },
  { id: 'jinha-sl', file: 'jinha-sl.webp' },
  { id: 'jinwoo-sl', file: 'jinwoo-sl.webp' },

  /* Doraemon */
  { id: 'doraemon', file: 'doraemon.webp' },

  /* Nature & Abstract */
  { id: 'cave-blue', file: 'cave-blue.webp' },
  { id: 'galaxy', file: 'galaxy.webp' },
  { id: 'jellyfish-blue', file: 'jellyfish-blue.webp' },
  { id: 'lava', file: 'lava.webp' },
  { id: 'nature', file: 'nature.webp' },
  { id: 'obsidian', file: 'obsidian.webp' },
  { id: 'purple', file: 'purple.webp' },

  /* Couples & General */
  { id: 'couple', file: 'couple.webp' },
  { id: 'two-hearts', file: 'two-hearts.webp' },
  { id: 'unknown-places', file: 'unknown-places.webp' },
];

/* Maximum ids accepted in one explicit request, to keep the response and the
 * signing call bounded. The full registry is 83 entries; a whole-registry fetch
 * (no `ids`) is served directly and does not pass through this cap. */
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
