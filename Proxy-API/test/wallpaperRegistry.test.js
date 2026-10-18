'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WALLPAPERS,
  FILES,
  MAX_REQUEST_IDS,
  resolveWallpaper,
  resolveWallpapers,
  isValidWallpaperId,
  isValidFile,
  fileForId,
  idForFile,
} = require('../lib/wallpaperRegistry');

test('registry has 31 unique ids and filenames', () => {
  assert.equal(WALLPAPERS.length, 31);
  assert.equal(new Set(WALLPAPERS.map((w) => w.id)).size, 31);
  assert.equal(new Set(WALLPAPERS.map((w) => w.file)).size, 31);
  assert.equal(FILES.length, 31);
});

test('keeps the original spellings byte-for-byte', () => {
  assert.ok(FILES.includes('obisidian.webp'));
  assert.ok(FILES.includes('vegeta-ulta-2-db.webp'));
  assert.ok(FILES.includes('shinron.webp'));
  assert.ok(FILES.includes('goku-ultra-2-db.webp'));
});

test('resolves a known id to its filename', () => {
  assert.equal(resolveWallpaper('goku-ultra'), 'goku-ultra-db.webp');
  assert.equal(resolveWallpaper('naruto-n'), 'naruto-n.webp');
  assert.equal(fileForId('obisidian'), 'obisidian.webp');
});

test('resolves a known filename to itself and back to its id', () => {
  assert.equal(resolveWallpaper('naruto-n.webp'), 'naruto-n.webp');
  assert.equal(idForFile('naruto-n.webp'), 'naruto-n');
});

test('rejects unknown ids/files and unsafe paths', () => {
  for (const bad of [
    'not-a-wallpaper',
    '../secrets.env',
    '../../etc/passwd',
    'folder/naruto-n.webp',
    'naruto-n.webp/../../other',
    '',
    '   ',
    null,
    42,
    {},
  ]) {
    assert.equal(resolveWallpaper(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('validates ids and files strictly', () => {
  assert.equal(isValidWallpaperId('lava'), true);
  assert.equal(isValidWallpaperId('lava.webp'), false);
  assert.equal(isValidFile('lava.webp'), true);
  assert.equal(isValidFile('lava'), false);
  assert.equal(isValidWallpaperId('../../x'), false);
});

test('resolveWallpapers de-duplicates and reports unknown values', () => {
  const { files, unknown } = resolveWallpapers([
    'lava',
    'lava.webp', // same object via a different alias -> de-duplicated
    'galaxy',
    'does-not-exist',
    '../evil',
  ]);

  assert.deepEqual(files, ['lava.webp', 'galaxy.webp']);
  assert.deepEqual(unknown, ['does-not-exist', '../evil']);
});

test('resolveWallpapers tolerates a non-array input', () => {
  assert.deepEqual(resolveWallpapers(undefined), { files: [], unknown: [] });
  assert.deepEqual(resolveWallpapers('lava'), { files: [], unknown: [] });
});

test('request cap is a sane positive number', () => {
  assert.ok(Number.isInteger(MAX_REQUEST_IDS) && MAX_REQUEST_IDS > 0);
});
