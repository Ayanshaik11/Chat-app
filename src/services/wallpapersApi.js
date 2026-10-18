import PROXY_API_URL from '../config/proxy';

/*
 * Client for the authenticated King X wallpaper endpoint.
 *
 * Signed URLs are minted by the backend at POST /api/wallpapers after it
 * verifies the caller's Firebase ID token. The token is fetched at request
 * time from the signed-in user and is never stored, cached here or logged.
 *
 * A single HTTP 401 triggers one forced token refresh and one retry — never
 * an unbounded retry loop.
 */

const WALLPAPERS_ENDPOINT = `${PROXY_API_URL}/api/wallpapers`;
const MAX_WALLPAPER_IDS = 50;

function apiError(message, status) {
  const error = new Error(message);
  if (status) error.status = status;
  return error;
}

/** Clean, de-duplicated ids; `null` means "the whole registry". */
function normaliseWallpaperIds(input) {
  if (input === undefined || input === null) return null;

  const list = Array.isArray(input) ? input : [input];
  const seen = new Set();
  const ids = [];

  for (const raw of list) {
    if (typeof raw !== 'string') throw new TypeError('Wallpaper ids must be strings.');
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }

  if (ids.length > MAX_WALLPAPER_IDS) {
    throw apiError(`Too many wallpaper ids (max ${MAX_WALLPAPER_IDS}).`, 400);
  }

  return ids.length ? ids : null;
}

/** Read a response body as JSON without throwing on malformed content. */
async function readJson(response) {
  let text = '';
  try {
    text = await response.text();
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestWallpaperUrls(token, ids, signal) {
  const response = await fetch(WALLPAPERS_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(ids ? { ids } : {}),
    signal,
  });

  return { response, data: await readJson(response) };
}

function shapeResult(data) {
  const urls = data && typeof data.urls === 'object' && data.urls ? data.urls : {};
  return {
    urls,
    unknown: Array.isArray(data?.unknown) ? data.unknown : [],
    errors: data && typeof data.errors === 'object' && data.errors ? data.errors : {},
    count: Number.isFinite(data?.count) ? data.count : Object.keys(urls).length,
    expiresIn: Number.isFinite(data?.expiresIn) ? data.expiresIn : null,
  };
}

/**
 * Fetch signed URLs for registered chat wallpapers.
 *
 * @param {object} fbUser signed-in Firebase user (must expose getIdToken)
 * @param {string[]|string} [wallpaperIds] registered wallpaper ids or filenames;
 *   omit / null / empty to request the full registry
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ urls: Record<string,string>, unknown: string[], errors: Record<string,string>, count: number, expiresIn: number|null }>}
 */
export async function fetchWallpaperUrls(fbUser, wallpaperIds, options = {}) {
  if (!fbUser || typeof fbUser.getIdToken !== 'function') {
    throw apiError('Sign in to load wallpapers.', 401);
  }

  const ids = normaliseWallpaperIds(wallpaperIds);
  const signal = options?.signal;

  let token;
  try {
    token = await fbUser.getIdToken();
  } catch {
    throw apiError('Could not authenticate the wallpaper request.', 401);
  }

  let { response, data } = await requestWallpaperUrls(token, ids, signal);

  // One forced refresh + one retry on 401.
  if (response.status === 401) {
    let refreshed;
    try {
      refreshed = await fbUser.getIdToken(true);
    } catch {
      throw apiError('Session expired. Please sign in again.', 401);
    }
    ({ response, data } = await requestWallpaperUrls(refreshed, ids, signal));
  }

  if (response.status === 401) {
    throw apiError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    throw apiError(data?.error || `Wallpaper service error (${response.status}).`, response.status);
  }

  if (data === null || typeof data !== 'object') {
    throw apiError('Invalid response from the wallpaper service.', response.status);
  }

  return shapeResult(data);
}

export default fetchWallpaperUrls;
