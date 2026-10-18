'use strict';

/*
 * KING X — Supabase Admin client (server-side only).
 *
 * Uses the service-role key, which must live ONLY in the backend environment
 * (Vercel → Settings → Environment Variables). It must never be exposed through
 * an EXPO_PUBLIC_* variable, bundled into the mobile app, logged or committed.
 *
 * The bucket stays private for now; this module is only used to mint
 * short-lived signed URLs for registered wallpaper objects.
 */

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_BUCKET = 'chat-wallpapers';
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour
const MIN_TTL_SECONDS = 60; // 1 minute
const MAX_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let client = null;

/** Read + validate the Supabase config. Throws a 500-tagged error if unset. */
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const error = new Error(
      'Wallpaper storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables.'
    );
    error.status = 500;
    throw error;
  }

  return { url, serviceRoleKey, bucket: getBucket() };
}

function getBucket() {
  const bucket = process.env.SUPABASE_WALLPAPER_BUCKET;
  return typeof bucket === 'string' && bucket.trim() ? bucket.trim() : DEFAULT_BUCKET;
}

/** Signed-URL lifetime in seconds, clamped to a safe range. */
function getSignedUrlTtl() {
  const parsed = Number.parseInt(process.env.WALLPAPER_SIGNED_URL_TTL, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(parsed, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}

function getSupabaseAdmin() {
  if (client) return client;
  const { url, serviceRoleKey } = getSupabaseConfig();
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

/** Normalise one storage-js signed-URL result across SDK versions. */
function normaliseResult(path, item, error) {
  const signedUrl = item?.signedUrl || item?.signedURL || null;
  const itemError = item?.error ? String(item.error.message || item.error) : null;
  const topError = error ? String(error.message || error) : null;
  return { path, signedUrl, error: topError || itemError };
}

/**
 * Create signed URLs for a list of registered storage object paths.
 *
 * @param {string[]} files canonical filenames from wallpaperRegistry
 * @param {number} [expiresIn] seconds; defaults to WALLPAPER_SIGNED_URL_TTL
 * @returns {Promise<Array<{ path: string, signedUrl: string|null, error: string|null }>>}
 */
async function createSignedWallpaperUrls(files, expiresIn) {
  const ttl = Number.isFinite(expiresIn) ? expiresIn : getSignedUrlTtl();
  const storage = getSupabaseAdmin().storage.from(getBucket());

  // Batch API (supabase-js >= 2) — one round trip for every object.
  if (typeof storage.createSignedUrls === 'function') {
    const { data, error } = await storage.createSignedUrls(files, ttl);
    if (error) {
      const requestError = new Error(error.message || 'Supabase signing failed.');
      requestError.status = 502;
      throw requestError;
    }
    return (data || []).map((item) => normaliseResult(item?.path, item, null));
  }

  // Fallback for older SDKs without the batch helper.
  return Promise.all(
    files.map(async (path) => {
      const { data, error } = await storage.createSignedUrl(path, ttl);
      return normaliseResult(path, data, error);
    })
  );
}

module.exports = {
  DEFAULT_BUCKET,
  DEFAULT_TTL_SECONDS,
  getBucket,
  getSignedUrlTtl,
  getSupabaseAdmin,
  createSignedWallpaperUrls,
};
