'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { WALLPAPERS } = require('../lib/wallpaperRegistry');

/*
 * `src/utils/chatTheme.js` (mobile app) is the catalogue the picker renders from,
 * while `lib/wallpaperRegistry.js` (backend) is the security allow-list that
 * decides which Storage objects may be signed. They MUST mirror each other's
 * `id` and `file` values exactly, or a theme silently fails to load (mobile has
 * an id the backend rejects) or a signed URL is never requested (backend has an
 * entry the app never asks for).
 *
 * This test parses the mobile registry straight from source and fails the moment
 * the two drift, so a new wallpaper can never be added to only one side.
 */

const MOBILE_THEME_FILE = path.join(__dirname, '..', '..', 'src', 'utils', 'chatTheme.js');

function readMobileWallpapers() {
  const source = fs.readFileSync(MOBILE_THEME_FILE, 'utf8');
  const pair = /id:\s*'([^']+)'[^\n]*?file:\s*'([^']+)'/g;
  const entries = [];
  let match;
  while ((match = pair.exec(source)) !== null) {
    entries.push({ id: match[1], file: match[2] });
  }
  return entries;
}

test('mobile catalogue and backend allow-list carry the same id/file pairs', () => {
  const mobile = readMobileWallpapers();
  assert.ok(mobile.length > 0, 'expected to parse wallpaper entries from chatTheme.js');

  const mobileIds = mobile.map((w) => w.id);
  const mobileFiles = mobile.map((w) => w.file);
  assert.equal(new Set(mobileIds).size, mobile.length, 'mobile wallpaper ids must be unique');
  assert.equal(new Set(mobileFiles).size, mobile.length, 'mobile wallpaper files must be unique');

  const mobileById = new Map(mobile.map((w) => [w.id, w.file]));
  const backendById = new Map(WALLPAPERS.map((w) => [w.id, w.file]));

  assert.deepEqual(
    [...backendById.entries()].sort(),
    [...mobileById.entries()].sort(),
    'Proxy-API/lib/wallpaperRegistry.js is out of sync with src/utils/chatTheme.js'
  );
});
