
const MUSIC_API_BASE_URL =
  'https://king-x-music-api-backend.vercel.app';

export async function kingXMusicApi(path, fbUser, options = {}) {
  if (!fbUser) {
    throw new Error('Please sign in to King X first.');
  }

  if (!path.startsWith('/api/')) {
    throw new Error('Invalid Music API path.');
  }

  const idToken = await fbUser.getIdToken();

  const response = await fetch(`${MUSIC_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Music API request failed (${response.status})`
    );
  }

  return data;
}
