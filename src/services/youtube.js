import { PROXY_BASE_URL } from '../config/proxy';

function mapItem(item) {
  const videoId = item.id?.videoId;
  if (!videoId) return null;
  return {
    id: `yt-${videoId}`,
    videoId,
    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
    authorName: item.snippet?.channelTitle || 'YouTube',
    caption: item.snippet?.title || '',
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    isExternal: true,
    authorId: null,
    likes: [],
  };
}

// Calls your own Vercel proxy — the real YouTube API key never ships
// inside the app; it lives only as a Vercel environment variable.
export async function fetchShorts(pageToken = null) {
  if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('YOUR-PROJECT')) {
    throw new Error('Set PROXY_BASE_URL in src/config/proxy.js to your deployed Vercel URL.');
  }
  const url = new URL(`${PROXY_BASE_URL}/api/youtube-shorts`);
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Could not load videos right now. Try again shortly.');

  return {
    items: (data.items || []).map(mapItem).filter(Boolean),
    nextPageToken: data.nextPageToken || null,
  };
}
