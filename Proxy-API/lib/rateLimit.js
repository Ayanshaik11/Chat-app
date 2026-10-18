'use strict';

/*
 * KING X — best-effort in-memory rate limiter.
 *
 * Vercel functions are ephemeral and may run on many instances, so this bounds
 * bursts hitting a single warm instance (defense-in-depth against accidental
 * request loops and casual abuse) rather than acting as a global quota. State
 * resets on cold start, which is acceptable for this endpoint.
 */

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 60;
const MAX_KEYS = 5000; // hard cap so a burst of unique keys cannot grow forever

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * @param {{ windowMs?: number, max?: number }} [options]
 * @returns {(key: string) => { ok: boolean, remaining?: number, retryAfter?: number }}
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || envInt('WALLPAPER_RATE_WINDOW_MS', DEFAULT_WINDOW_MS);
  const max = options.max || envInt('WALLPAPER_RATE_MAX', DEFAULT_MAX);
  const hits = new Map();

  return function check(key) {
    const now = Date.now();
    const safeKey = typeof key === 'string' && key ? key : 'anonymous';

    if (hits.size >= MAX_KEYS) {
      for (const [entryKey, entry] of hits) {
        if (now - entry.start >= windowMs) hits.delete(entryKey);
      }
      if (hits.size >= MAX_KEYS) hits.clear();
    }

    const entry = hits.get(safeKey);

    if (!entry || now - entry.start >= windowMs) {
      hits.set(safeKey, { start: now, count: 1 });
      return { ok: true, remaining: max - 1 };
    }

    entry.count += 1;

    if (entry.count > max) {
      return {
        ok: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)),
      };
    }

    return { ok: true, remaining: max - entry.count };
  };
}

module.exports = { createRateLimiter, DEFAULT_WINDOW_MS, DEFAULT_MAX };
