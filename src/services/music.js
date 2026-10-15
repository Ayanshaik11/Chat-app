import PROXY_API_URL from '../config/proxy';

// Search free (Creative Commons) songs through our own server — the Jamendo key never reaches the app.
export async function searchMusic(q = '') {
  const res = await fetch(`${PROXY_API_URL}/api/music?q=${encodeURIComponent(q.trim())}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Could not load music.');
  return data.items || [];
}
