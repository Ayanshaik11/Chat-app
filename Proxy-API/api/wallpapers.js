'use strict';

/*
 * KING X — authenticated wallpaper signed-URL endpoint.
 *
 *   GET  /api/wallpapers                 -> signed URLs for every wallpaper
 *   GET  /api/wallpapers?ids=a,b,c       -> signed URLs for the given ids/files
 *   POST /api/wallpapers  { ids: [...] } -> same, for larger/structured lists
 *
 * The caller MUST send `Authorization: Bearer <Firebase ID token>`. The token
 * is verified with Firebase Admin; only then are short-lived Supabase signed
 * URLs minted for filenames in the server-side wallpaper allow-list.
 *
 * The bucket stays private. No signed URL, no service-role key and no expiry
 * handling is exposed anywhere else in the app.
 */

const { sendJson, parseJsonBody, getClientIp } = require('../lib/http');
const { createRateLimiter } = require('../lib/rateLimit');
const { verifyFirebaseIdToken } = require('../lib/firebaseAdmin');
const { createSignedWallpaperUrls, getSignedUrlTtl } = require('../lib/supabaseAdmin');
const { WALLPAPERS, MAX_REQUEST_IDS, resolveWallpapers } = require('../lib/wallpaperRegistry');

/* one limiter before auth (per IP) and one after (per verified user) */
const ipLimiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 });
const userLimiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 });

const FILE_TO_ID = new Map(WALLPAPERS.map((w) => [w.file, w.id]));

function tooManyRequests(res, retryAfter) {
  if (retryAfter) res.setHeader('Retry-After', String(retryAfter));
  return sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
}

/** Collect the requested values from either the query string or a JSON body. */
function collectRequested(input, source) {
  const raw = source === 'post' ? input?.ids ?? input?.id : input?.ids ?? input?.id;

  if (raw === undefined || raw === null || raw === '') return { all: true, list: [] };

  if (typeof raw === 'string') {
    return { all: false, list: raw.split(',').map((s) => s.trim()).filter(Boolean) };
  }

  if (Array.isArray(raw)) {
    return { all: false, list: raw };
  }

  return { invalid: true };
}

module.exports = async (req, res) => {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.end();
  }

  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return sendJson(res, 405, { error: 'Use GET or POST.' });
  }

  /* 1) cheap pre-auth limit so token verification can't be hammered */
  const ipCheck = ipLimiter(getClientIp(req));
  if (!ipCheck.ok) return tooManyRequests(res, ipCheck.retryAfter);

  /* 2) verify the Firebase ID token */
  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(req);
  } catch (error) {
    return sendJson(res, error.status || 401, { error: error.message || 'Unauthorized.' });
  }

  /* 3) per-user limit */
  const userCheck = userLimiter(decoded.uid);
  if (!userCheck.ok) return tooManyRequests(res, userCheck.retryAfter);

  /* 4) read + validate the requested ids */
  let body = {};
  if (method === 'POST') {
    body = parseJsonBody(req);
    if (body === null) return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  const requested = collectRequested(
    method === 'POST' ? body : req.query || {},
    method === 'POST' ? 'post' : 'get'
  );

  if (requested.invalid) {
    return sendJson(res, 400, { error: '`ids` must be an array of strings or a comma-separated string.' });
  }

  if (!requested.all && requested.list.length > MAX_REQUEST_IDS) {
    return sendJson(res, 400, { error: `Too many ids. Max ${MAX_REQUEST_IDS} per request.` });
  }

  const { files, unknown } = requested.all
    ? { files: WALLPAPERS.map((w) => w.file), unknown: [] }
    : resolveWallpapers(requested.list);

  if (!files.length) {
    return sendJson(res, 200, {
      urls: {},
      unknown,
      count: 0,
      expiresIn: getSignedUrlTtl(),
    });
  }

  const expiresIn = getSignedUrlTtl();

  /* 5) mint signed URLs for the allow-listed files only */
  let results;
  try {
    results = await createSignedWallpaperUrls(files, expiresIn);
  } catch (error) {
    console.error('wallpapers signing error:', error?.message || error);
    return sendJson(res, error.status || 502, { error: 'Could not create wallpaper URLs.' });
  }

  const urls = {};
  const errors = {};

  for (const result of results) {
    const id = FILE_TO_ID.get(result.path) || result.path;
    if (result.signedUrl) urls[id] = result.signedUrl;
    else if (result.error) errors[id] = result.error;
  }

  return sendJson(res, 200, {
    urls,
    unknown,
    errors: Object.keys(errors).length ? errors : undefined,
    count: Object.keys(urls).length,
    expiresIn,
  });
};
