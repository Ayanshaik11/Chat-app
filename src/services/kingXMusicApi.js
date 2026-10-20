const FALLBACK_MUSIC_API_BASE_URLS = [
  'https://kingx-music-api-backend.onrender.com',
  'https://king-x-music-api-backend.vercel.app',
];
const DEFAULT_TIMEOUT_MS = 12000;

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';

  // Ignore untouched placeholders copied from .env.example; fall back to the
  // hosted King X Music API instead of calling a non-existent host.
  if (/your[-.]|example\.(com|org)|placeholder|changeme/i.test(raw)) return '';

  return raw.replace(/\/+$/, '');
}

const MUSIC_API_BASE_URLS = [
  normalizeBaseUrl(process.env.EXPO_PUBLIC_MUSIC_API_BASE_URL),
  ...FALLBACK_MUSIC_API_BASE_URLS,
].filter((value, index, list) => value && list.indexOf(value) === index);

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log(`KING X Music API base URLs: ${MUSIC_API_BASE_URLS.join(', ')}`);
}

export function getMusicApiBaseUrl() {
  return MUSIC_API_BASE_URLS[0] || '';
}

export function getMusicApiBaseUrls() {
  return [...MUSIC_API_BASE_URLS];
}

export function isAbortError(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'ABORT_ERR' ||
    error?.name === 'AbortErrorException'
  );
}

// Errors do not always arrive as Error instances (React Native fetch and some
// native modules reject with plain objects). Always produce a readable string
// so the UI can never render "[object Object]".
export function toErrorMessage(value, fallback = 'Something went wrong.') {
  const clean = (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    return trimmed && trimmed !== '[object Object]' ? trimmed : '';
  };

  if (value == null) return fallback;
  if (typeof value === 'string') return clean(value) || fallback;

  if (value instanceof Error) {
    return clean(value.message) || fallback;
  }

  if (typeof value === 'object') {
    const message = value.message ?? value.error ?? value.reason;
    const text = clean(message);
    if (text) return text;
    if (message && message !== value) return toErrorMessage(message, fallback);

    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // Circular or unserializable object: fall through.
    }
  }

  const text = String(value).trim();
  return text && text !== '[object Object]' ? text : fallback;
}

function createAbortController() {
  try {
    if (typeof AbortController !== 'function') return null;
    const controller = new AbortController();
    if (!controller?.signal || typeof controller.abort !== 'function') return null;
    if (typeof controller.signal.addEventListener !== 'function') return null;
    return controller;
  } catch {
    return null;
  }
}

function timeoutError() {
  const error = new Error(
    'The music service took too long to respond. Please try again.'
  );
  error.code = 'TIMEOUT';
  error.isTimeout = true;
  return error;
}

function canTryNextHost(error) {
  if (!error || error.isTimeout || isAbortError(error)) return false;
  if (error.tryNextHost === true) return true;
  if (error instanceof TypeError) return true;

  return [404, 410, 429, 502, 503, 504].includes(Number(error.status));
}

async function requestOnce(baseUrl, path, options) {
  const { signal, timeoutMs, headers, ...rest } = options;
  const controller = createAbortController();
  let timedOut = false;
  let timer = null;
  const forwardAbort = () => controller?.abort();

  if (controller && signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener?.('abort', forwardAbort);
  }

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller?.abort();
      reject(timeoutError());
    }, timeoutMs);
  });

  try {
    const request = fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: { Accept: 'application/json', ...(headers || {}) },
      ...(controller ? { signal: controller.signal } : {}),
    });

    const response = await Promise.race([request, timeout]);
    const text = await response.text();
    let data = null;
    let invalidJson = false;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        invalidJson = true;
      }
    }

    if (!response.ok) {
      const message =
        toErrorMessage(data?.error, '') ||
        toErrorMessage(data?.message, '') ||
        `Music service request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      error.code = data?.code || 'HTTP_ERROR';
      error.tryNextHost = [404, 410, 429, 502, 503, 504].includes(
        Number(response.status)
      );
      throw error;
    }

    if (invalidJson) {
      const error = new Error('The music service returned an invalid response.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }

    if (!data || typeof data !== 'object') {
      const error = new Error('The music service returned an empty response.');
      error.code = 'EMPTY_RESPONSE';
      throw error;
    }

    return data;
  } catch (error) {
    if (timedOut) throw timeoutError();

    if (isAbortError(error)) throw error;

    if (error instanceof TypeError) {
      const nextError = new Error(
        `Could not reach the music service at ${baseUrl}. Check your connection and try again.`
      );
      nextError.code = 'NETWORK_ERROR';
      nextError.tryNextHost = true;
      throw nextError;
    }

    if (error instanceof Error) throw error;

    const nextError = new Error(
      toErrorMessage(error, 'The music service request failed.')
    );
    nextError.tryNextHost = true;
    throw nextError;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', forwardAbort);
  }
}

// Small wrapper around the King X Music API. It never sends authentication:
// the backend endpoints used by the app are public.
export async function kingXMusicApi(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/api/')) {
    throw new Error('Invalid Music API path.');
  }

  if (!MUSIC_API_BASE_URLS.length) {
    throw new Error('No music service is configured.');
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = options;
  let firstError = null;
  let lastError = null;

  for (const baseUrl of MUSIC_API_BASE_URLS) {
    try {
      return await requestOnce(baseUrl, path, {
        ...rest,
        signal,
        timeoutMs,
      });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error;

      if (!firstError) firstError = error;
      lastError = error;

      if (!canTryNextHost(error)) {
        if (firstError !== error && Number(firstError.status) >= 500) {
          throw firstError;
        }
        throw error;
      }
    }
  }

  if (firstError && firstError !== lastError && Number(firstError.status) >= 500) {
    throw firstError;
  }

  throw lastError || new Error('The music service request failed.');
}
