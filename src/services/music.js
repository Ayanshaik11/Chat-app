import {
  isAbortError,
  kingXMusicApi,
  toErrorMessage,
} from './kingXMusicApi';

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_REVALIDATE_AFTER_MS = 30 * 1000;
const SEARCH_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_SEARCH_CACHE_ENTRIES = 30;
const MAX_PREVIEW_CACHE_ENTRIES = 60;

const searchCache = new Map();
const previewCache = new Map();
const inFlightSearches = new Map();
const inFlightPreviews = new Map();

function decodeHtml(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCharCode(Number(n))
    );
}

function asText(value) {
  if (typeof value === 'string') return value.trim();

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (value && typeof value === 'object') {
    return asText(
      value.name ?? value.title ?? value.text ?? value.label
    );
  }

  return '';
}

function httpUrl(value) {
  const url = asText(value);
  return /^https?:\/\//i.test(url) ? url : '';
}

function looksLikePreviewUrl(value) {
  const url = httpUrl(value);

  if (!url) return false;

  const path = url.split('?')[0].split('#')[0];

  return /(?:^|[\/_.-])(?:preview|sample|snippet|clip|teaser|30s)(?:[\/_.-]|$)/i.test(
    path
  );
}

function cacheGetEntry(cache, key, ttl) {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.at > ttl) {
    cache.delete(key);
    return null;
  }

  return entry;
}

function cacheGet(cache, key, ttl) {
  return cacheGetEntry(cache, key, ttl)?.value || null;
}

function cacheSet(cache, key, value, maxEntries) {
  if (cache.has(key)) cache.delete(key);

  cache.set(key, { at: Date.now(), value });

  while (cache.size > maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

const cloneTrack = (track) => ({ ...track });

function waitForSharedRequest(entry, signal) {
  if (!signal) return entry.promise;

  if (signal.aborted) return Promise.reject(abortError());

  entry.subscribers += 1;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener?.('abort', onAbort);
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      entry.subscribers -= 1;

      if (entry.subscribers <= 0) {
        entry.controller?.abort();
      }

      reject(abortError());
    };

    signal.addEventListener?.('abort', onAbort);

    entry.promise.then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error)
    );
  });
}

function startSharedRequest(map, key, factory) {
  const existing = map.get(key);

  if (existing) {
    if (!existing.controller?.signal?.aborted) return existing;
    map.delete(key);
  }

  const controller =
    typeof AbortController === 'function'
      ? new AbortController()
      : null;

  const entry = {
    controller,
    subscribers: 0,
    promise: null,
  };

  entry.promise = (async () => {
    try {
      return await factory(controller?.signal);
    } finally {
      if (map.get(key) === entry) map.delete(key);
    }
  })();

  entry.promise.catch(() => {});

  map.set(key, entry);

  return entry;
}

function playbackLabel(type) {
  if (type === 'full') return 'Full track';
  if (type === 'preview') return 'Preview';
  if (type === 'stream') return 'Audio stream';
  return 'Unavailable';
}

export function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = asText(
    raw.id ?? raw.trackId ?? raw.providerTrackId
  );

  const name = decodeHtml(
    asText(raw.title ?? raw.name ?? raw.song)
  );

  if (!id || !name) return null;

  const artists =
    raw.artists ??
    raw.artist ??
    raw.primaryArtists ??
    raw.primary_artists;

  const artist =
    decodeHtml(
      Array.isArray(artists)
        ? artists.map(asText).filter(Boolean).join(', ')
        : asText(artists)
    ) || 'Unknown artist';

  const image = httpUrl(
    raw.artwork ??
      raw.image ??
      raw.artworkUrl ??
      raw.coverArt
  );

  const streamUrl = httpUrl(
    raw.streamUrl ??
      raw.stream_url ??
      raw.playback?.streamUrl ??
      raw.playback?.stream_url ??
      raw.playbackUrl ??
      raw.audioUrl
  );

  const legacyPreviewUrl = httpUrl(
    raw.previewUrl ??
      raw.preview_url ??
      raw.playback?.previewUrl ??
      raw.playback?.preview_url ??
      raw.media_preview_url
  );

  const providerUrl = httpUrl(
    raw.permalink ??
      raw.providerUrl ??
      raw.perma_url ??
      raw.playback?.url ??
      raw.url
  );

  const durationValue =
    raw.duration != null
      ? Number(raw.duration)
      : raw.durationMs != null
        ? Number(raw.durationMs) / 1000
        : raw.duration_ms != null
          ? Number(raw.duration_ms) / 1000
          : 0;

  const duration = Number.isFinite(durationValue)
    ? Math.max(0, Math.round(durationValue))
    : 0;

  const playbackUrl = streamUrl || legacyPreviewUrl;
  const source = asText(
    raw.provider ??
      raw.source ??
      (String(id).startsWith('itunes_') ? 'itunes' : '')
  ).toLowerCase();

  const rawPlaybackType = asText(
    raw.playbackType ?? raw.playback?.type
  ).toLowerCase();

  const explicitPreview =
    raw.isPreview === true ||
    raw.is_preview === true ||
    raw.previewOnly === true ||
    raw.preview === true ||
    raw.playback?.preview === true ||
    raw.playback?.isPreview === true ||
    rawPlaybackType.includes('preview');

  const explicitFull =
    raw.isFullTrack === true ||
    raw.is_full_track === true ||
    raw.fullTrackAvailable === true ||
    raw.full_track_available === true ||
    rawPlaybackType.includes('full') ||
    rawPlaybackType === 'stream';

  const urlLooksLikePreview = looksLikePreviewUrl(playbackUrl);

  let playbackType = 'unavailable';

  if (playbackUrl) {
    if (explicitPreview || urlLooksLikePreview) {
      playbackType = 'preview';
    } else if (explicitFull) {
      playbackType = 'full';
    } else if (!streamUrl && legacyPreviewUrl) {
      playbackType = 'preview';
    } else if (source === 'audius') {
      playbackType = 'full';
    } else {
      playbackType = 'stream';
    }
  }

  const disabled =
    raw.disabled === true ||
    String(raw.disabled).toLowerCase() === 'true';

  const disabledText = asText(
    raw.disabledText ?? raw.disabled_text
  );

  const isDrm =
    raw.isDrm === true ||
    raw.is_drm === true ||
    Number(raw.isDrm ?? raw.is_drm) === 1;

  const rightsReason = asText(
    raw.rightsReason ?? raw.rights?.reason
  );

  const playable =
    Boolean(playbackUrl) &&
    !disabled &&
    !isDrm &&
    !rightsReason &&
    raw.playable !== false;

  return {
    id,
    name,
    title: name,
    artist,
    image,
    artwork: image,
    duration,

    url: playbackUrl,
    previewUrl: playbackUrl,
    streamUrl,
    previewFallbackUrl: '',
    providerUrl,
    tunePreviewUrl: '',

    playbackType,
    playbackLabel: playbackLabel(playbackType),
    playbackVerified: false,
    isFullTrack: playbackType === 'full',
    fullTrackAvailable: playbackType === 'full',
    isPreview: playbackType === 'preview',

    playbackMessage: asText(raw.playbackMessage),
    playable,
    disabled,
    disabledText,
    isDrm,
    rightsReason,
    source,
    ccurl: '',
  };
}

export function getPlaybackVerification(track, actualDuration) {
  const seconds = Math.max(
    0,
    Math.round(Number(actualDuration) || 0)
  );

  if (!track || !seconds) return null;

  const expected = Math.max(
    0,
    Math.round(Number(track.duration) || 0)
  );

  const isPreview =
    track.playbackType === 'preview' ||
    (expected > 45 && seconds <= Math.min(35, expected * 0.6)) ||
    (expected > 0 && seconds < expected * 0.7 && expected - seconds > 20);

  let playbackType = track.playbackType || 'stream';

  if (isPreview) {
    playbackType = 'preview';
  } else if (expected > 0 && seconds >= expected * 0.85) {
    playbackType = 'full';
  }

  return {
    playbackType,
    playbackLabel: playbackLabel(playbackType),
    playbackVerified: true,
    isFullTrack: playbackType === 'full',
    fullTrackAvailable: playbackType === 'full',
    isPreview: playbackType === 'preview',
  };
}

function readResults(data) {
  if (data?.success === false) {
    throw new Error(
      toErrorMessage(
        data.error || data.message,
        'Music search failed.'
      )
    );
  }

  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;

  throw new Error(
    'The music service returned an unexpected response.'
  );
}

export function isTrackPlayable(track) {
  return Boolean(
    track &&
      !track.disabled &&
      !track.isDrm &&
      !track.rightsReason &&
      track.playable !== false &&
      (httpUrl(track.url) || httpUrl(track.streamUrl))
  );
}

export function toSelectedMusic(track, start = 0) {
  const fallbackUrl = httpUrl(track?.url);

  const normalized = normalizeTrack({
    ...track,
    previewUrl: httpUrl(track?.previewUrl) || fallbackUrl,
  });

  if (!normalized) {
    throw new Error('Invalid song.');
  }

  return {
    ...normalized,
    start: Math.max(0, Math.floor(Number(start) || 0)),
  };
}

export function clearMusicCache() {
  for (const entry of inFlightSearches.values()) {
    entry.controller?.abort();
  }

  for (const entry of inFlightPreviews.values()) {
    entry.controller?.abort();
  }

  searchCache.clear();
  previewCache.clear();
  inFlightSearches.clear();
  inFlightPreviews.clear();
}

export function getCachedSearch(query = '', options = {}) {
  const key = String(query).trim().toLowerCase();

  if (!key) return null;

  const ttl = options.allowStale
    ? SEARCH_STALE_TTL_MS
    : SEARCH_CACHE_TTL_MS;

  const entry = cacheGetEntry(searchCache, key, ttl);

  return entry ? entry.value.map(cloneTrack) : null;
}

async function fetchSearchItems(query, options = {}) {
  const key = query.toLowerCase();

  const entry = startSharedRequest(
    inFlightSearches,
    key,
    async (signal) => {
      const params = new URLSearchParams({ q: query });

      const data = await kingXMusicApi(
        `/v1/search?${params.toString()}`,
        {
          timeoutMs: options.timeoutMs,
          signal,
        }
      );

      const seen = new Set();
      const tracks = [];

      for (const raw of readResults(data)) {
        const track = normalizeTrack({
          ...raw,
          provider: raw.provider ?? raw.source ?? data?.provider,
        });

        if (!track || seen.has(track.id)) continue;

        seen.add(track.id);

        tracks.push({
          ...track,
          searchQuery: query,
        });
      }

      tracks.sort(
        (a, b) =>
          Number(isTrackPlayable(b)) -
          Number(isTrackPlayable(a))
      );

      cacheSet(
        searchCache,
        key,
        tracks,
        MAX_SEARCH_CACHE_ENTRIES
      );

      return tracks;
    }
  );

  return waitForSharedRequest(entry, options.signal);
}

export async function searchMusic(query = '', options = {}) {
  const q = String(query).trim();

  if (!q) {
    throw new Error('Type a song or artist to search.');
  }

  throwIfAborted(options.signal);

  const key = q.toLowerCase();
  const entry = cacheGetEntry(
    searchCache,
    key,
    SEARCH_CACHE_TTL_MS
  );

  if (entry && !options.forceRefresh) {
    const age = Date.now() - entry.at;

    if (
      options.revalidate !== false &&
      age >= SEARCH_REVALIDATE_AFTER_MS
    ) {
      fetchSearchItems(q, { timeoutMs: options.timeoutMs })
        .then((fresh) => {
          options.onRevalidate?.(fresh.map(cloneTrack));
        })
        .catch(() => {});
    }

    return entry.value.map(cloneTrack);
  }

  let items;

  try {
    items = await fetchSearchItems(q, options);
  } catch (error) {
    if (!isAbortError(error) || options.signal?.aborted) {
      throw error;
    }

    items = await fetchSearchItems(q, options);
  }

  throwIfAborted(options.signal);

  return items.map(cloneTrack);
}

export async function getTrackPreview(
  id,
  query = '',
  options = {}
) {
  const trackId = String(id || '').trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(trackId)) {
    throw new Error('Invalid song.');
  }

  throwIfAborted(options.signal);

  const queryText = String(query).trim();
  const key = `${trackId}:${queryText.toLowerCase()}`;

  const cached = options.forceRefresh
    ? null
    : cacheGet(previewCache, key, PREVIEW_CACHE_TTL_MS);

  if (cached) return cloneTrack(cached);

  const entry = startSharedRequest(
    inFlightPreviews,
    key,
    async (signal) => {
      const data = await kingXMusicApi(
        `/v1/stream/${encodeURIComponent(trackId)}`,
        {
          timeoutMs: options.timeoutMs,
          signal,
        }
      );

      const payload =
        data?.track ||
        data?.result ||
        data?.item ||
        data?.data ||
        data ||
        {};

      const streamUrl = httpUrl(
        payload.streamUrl ??
          payload.stream_url ??
          payload.playback?.streamUrl ??
          data?.streamUrl ??
          data?.playback?.streamUrl ??
          payload.playbackUrl ??
          payload.audioUrl
      );

      if (!streamUrl) {
        throw new Error(
          'Playback is unavailable for this song.'
        );
      }

      const cachedTracks =
        getCachedSearch(queryText, { allowStale: true }) || [];

      const existing = cachedTracks.find(
        (track) => track.id === trackId
      );

      const track = normalizeTrack({
        ...(existing || {}),
        ...(payload && typeof payload === 'object'
          ? payload
          : {}),
        id: asText(payload.id) || trackId,
        title:
          asText(payload.title ?? payload.name) ||
          existing?.title ||
          trackId,
        artist:
          asText(payload.artist ?? payload.artists) ||
          existing?.artist ||
          'Unknown artist',
        artwork:
          asText(
            payload.artwork ??
              payload.image ??
              payload.artworkUrl
          ) ||
          existing?.artwork ||
          '',
        provider:
          asText(payload.provider ?? data?.provider) ||
          existing?.source ||
          '',
        streamUrl,
        playable:
          payload.playable === false ? false : undefined,
        permalink:
          existing?.providerUrl ||
          asText(payload.permalink ?? payload.url),
        duration:
          Number(payload.duration ?? data?.duration) ||
          existing?.duration ||
          0,
      });

      if (!track || !isTrackPlayable(track)) {
        throw new Error(
          'The music service returned an invalid song.'
        );
      }

      cacheSet(
        previewCache,
        key,
        track,
        MAX_PREVIEW_CACHE_ENTRIES
      );

      return track;
    }
  );

  const track = await waitForSharedRequest(entry, options.signal);

  throwIfAborted(options.signal);

  return cloneTrack(track);
}

export async function getDiscoverMusic(
  category = 'latest',
  options = {}
) {
  const categories = {
    latest: 'latest songs',
    trending: 'trending songs',
    bollywood: 'bollywood hits',
    punjabi: 'punjabi hits',
    romantic: 'romantic songs',
  };

  return searchMusic(
    categories[category] || category || 'latest songs',
    options
  );
}

export { isAbortError, toErrorMessage };
