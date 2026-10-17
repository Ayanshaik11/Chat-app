
const MUSIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_MUSIC_API_BASE_URL ||
  'https://king-x-music-api-backend.vercel.app';

export async function kingXMusicApi(path, fbUser, options = {}) {
  if (!path.startsWith('/api/')) {
    throw new Error('Invalid Music API path.');
  }

  let idToken = null;
  if (fbUser && typeof fbUser.getIdToken === 'function') {
    try {
      idToken = await fbUser.getIdToken();
    } catch {}
  }

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch(`${MUSIC_API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Music API request failed (${response.status})`
    );
  }

  return data;
}
