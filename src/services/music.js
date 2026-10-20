import { isAbortError, kingXMusicApi, toErrorMessage } from './kingXMusicApi';

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;

const searchCache = new Map();
const previewCache = new Map();
const inFlightSearches = new Map();
const inFlightPreviews = new Map();

function decodeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

function asText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object') {
    const nested = value.name ?? value.title ?? value.text ?? value.label;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return '';
}

function httpUrl(value) {
  const url = asText(value);
  return /^https?:\/\//i.test(url) ? url : '';
}

function cacheGet(cache, key, ttl) {
  const hit = cache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.at > ttl) {
    cache.delete(key);
    return null;
  }

  return hit.value;
}

function cacheSet(cache, key, value) {
  cache.set(key, { at: Date.now(), value });
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    throw error;
  }
}

const cloneTrack = (track) => ({ ...track });

function readResults(data) {
  if (data?.success === false) {
    throw new Error(
      toErrorMessage(data.error || data.message, 'The music service could not complete the search.')
    );
  }

  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;

  throw new Error('The music service returned an unexpected response.');
}

function readTrack(data) {
  if (data?.success === false) {
    throw new Error(
      toErrorMessage(data.error || data.message, 'The music service could not load this song.')
    );
  }

  const raw = data?.track || data?.result || data?.item;
  const track = normalizeTrack(raw);

  if (!track) {
    throw new Error('The music service returned an invalid song.');
  }

  return track;
}

// Converts both the current King X Music API fields (title/artwork/previewUrl)
// and older fields (name/image/url) into one shape used by the app.
export function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = asText(raw.id ?? raw.providerTrackId ?? raw.trackId);
  const name = decodeHtml(asText(raw.title ?? raw.song ?? raw.name));

  if (!id || !name) return null;

  const rawArtists = raw.artists ?? raw.artist ?? raw.primaryArtists ?? raw.primary_artists;
  const artist =
    decodeHtml(
      Array.isArray(rawArtists)
        ? rawArtists.map((item) => asText(item)).filter(Boolean).join(', ')
        : asText(rawArtists)
    ) || 'Unknown artist';

  const image = httpUrl(raw.artwork ?? raw.image ?? raw.artworkUrl);
  const previewUrl = httpUrl(
    raw.previewUrl ??
      raw.playback?.previewUrl ??
      raw.media_preview_url ??
      raw.vlink
  );
  const previewFallbackUrl = httpUrl(
    raw.previewFallbackUrl ??
      raw.tunePreviewUrl ??
      raw.vlink ??
      raw.media_preview_url
  );
  const providerUrl = httpUrl(
    raw.providerUrl ?? raw.url ?? raw.playback?.url ?? raw.perma_url
  );

  const rawDuration = Number(
    raw.duration != null
      ? raw.duration
      : raw.durationMs != null
        ? raw.durationMs / 1000
        : 0
  );
  const duration = Number.isFinite(rawDuration)
    ? Math.max(0, Math.round(rawDuration))
    : 0;

  const disabled =
    raw.disabled === true || String(raw.disabled).toLowerCase() === 'true';
  const disabledText = asText(raw.disabledText ?? raw.disabled_text);
  const rightsReason = asText(raw.rightsReason ?? raw.rights?.reason);
  const isDrm = raw.isDrm === true || Number(raw.isDrm ?? raw.is_drm) === 1;
  const playable =
    raw.playable === true ||
    (raw.playable !== false &&
      !!previewUrl &&
      !disabled &&
      !rightsReason);

  return {
    id,
    name,
    title: name,
    artist,
    image,
    artwork: image,
    duration,
    url: previewUrl,
    previewUrl,
    previewFallbackUrl:
      previewFallbackUrl && previewFallbackUrl !== previewUrl
        ? previewFallbackUrl
        : '',
    providerUrl,
    tunePreviewUrl: httpUrl(raw.tunePreviewUrl ?? raw.vlink),
    playbackType:
      asText(raw.playbackType).toLowerCase() ||
      (previewUrl ? 'preview' : 'unavailable'),
    isFullTrack: raw.isFullTrack === true,
    fullTrackAvailable: raw.fullTrackAvailable === true,
    playbackMessage: asText(raw.playbackMessage),
    playable,
    disabled,
    disabledText,
    isDrm,
    rightsReason,
    source: asText(
      raw.source ??
        raw.provider ??
        (String(id).startsWith('itunes_') ? 'itunes' : 'jiosaavn')
    ).toLowerCase(),
    ccurl: '',
  };
}

export function isTrackPlayable(track) {
  if (!track || track.disabled || track.rightsReason) return false;
  return Boolean(track.url || track.previewUrl) && track.playable !== false;
}

// The stored song keeps the app's existing field names and the API's field
// names, so current and future readers can use either without a migration.
export function toSelectedMusic(track, start = 0) {
  const normalized = normalizeTrack(track);
  if (!normalized) throw new Error('Invalid song.');

  const position = Math.max(0, Math.floor(Number(start) || 0));

  return {
    ...normalized,
    ...(position ? { start: position } : {}),
  };
}

export function clearMusicCache() {
  searchCache.clear();
  previewCache.clear();
  inFlightSearches.clear();
  inFlightPreviews.clear();
}

export function getCachedSearch(q = '') {
  const key = String(q || '').trim().toLowerCase();
  if (!key) return null;

  const cached = cacheGet(searchCache, key, SEARCH_CACHE_TTL_MS);
  return cached ? cached.map(cloneTrack) : null;
}

async function fetchSearchItems(query, options = {}) {
  const key = query.toLowerCase();

  if (inFlightSearches.has(key)) {
    return inFlightSearches.get(key);
  }

  const request = (async () => {
    const params = new URLSearchParams();
    params.append('q', query);
    const data = await kingXMusicApi(
      `/api/music/search?${params.toString()}`,
      { timeoutMs: options.timeoutMs }
    );

    const seenIds = new Set();
    const items = [];

    for (const raw of readResults(data)) {
      const track = normalizeTrack(raw);
      if (!track || seenIds.has(track.id)) continue;

      seenIds.add(track.id);
      items.push({ ...track, searchQuery: query });
    }

    cacheSet(searchCache, key, items);
    return items;
  })();

  inFlightSearches.set(key, request);

  try {
    return await request;
  } finally {
    if (inFlightSearches.get(key) === request) inFlightSearches.delete(key);
  }
}

export async function searchMusic(q = '', options = {}) {
  const query = String(q || '').trim();
  if (!query) throw new Error('Type a song or artist to search.');

  throwIfAborted(options.signal);

  const key = query.toLowerCase();
  const cached = cacheGet(searchCache, key, SEARCH_CACHE_TTL_MS);

  if (cached && !options.forceRefresh) {
    if (options.revalidate !== false) {
      fetchSearchItems(query, options)
        .then((items) => {
          if (options.signal?.aborted) return;
          options.onRevalidate?.(items.map(cloneTrack));
        })
        .catch(() => {
          // Cached results remain usable when the background refresh fails.
        });
    }

    return cached.map(cloneTrack);
  }

  try {
    const items = await fetchSearchItems(query, options);
    throwIfAborted(options.signal);
    return items.map(cloneTrack);
  } catch (error) {
    if (!isAbortError(error) || options.signal?.aborted) throw error;

    const items = await fetchSearchItems(query, options);
    throwIfAborted(options.signal);
    return items.map(cloneTrack);
  }
}

export async function getTrackPreview(id, q, options = {}) {
  const trackId = String(id || '').trim();
  const query = String(q || '').trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(trackId)) {
    throw new Error('Invalid song.');
  }

  throwIfAborted(options.signal);

  const key = `${trackId}:${query.toLowerCase()}`;
  const cached = cacheGet(previewCache, key, PREVIEW_CACHE_TTL_MS);
  if (cached) return cloneTrack(cached);

  if (inFlightPreviews.has(key)) {
    const track = await inFlightPreviews.get(key);
    throwIfAborted(options.signal);
    return cloneTrack(track);
  }

  const request = (async () => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const data = await kingXMusicApi(
      `/api/music/preview/${encodeURIComponent(trackId)}${suffix}`,
      { timeoutMs: options.timeoutMs }
    );
    const track = readTrack(data);
    cacheSet(previewCache, key, track);
    return track;
  })();

  inFlightPreviews.set(key, request);

  try {
    const track = await request;
    throwIfAborted(options.signal);
    return cloneTrack(track);
  } finally {
    if (inFlightPreviews.get(key) === request) inFlightPreviews.delete(key);
  }
}

export async function getDiscoverMusic(category = 'latest', options = {}) {
  const tagMap = {
    latest: 'latest songs',
    trending: 'trending songs',
    bollywood: 'bollywood hits',
    punjabi: 'punjabi hits',
    romantic: 'romantic songs',
  };

  return searchMusic(tagMap[category] || category || 'latest songs', options);
}

export { isAbortError, toErrorMessage };
