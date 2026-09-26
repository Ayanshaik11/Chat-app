import { YOUTUBE_API_KEY } from '../config/youtube';

const BASE = 'https://www.googleapis.com/youtube/v3/search';

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

// There's no official "Shorts only" filter in the public API, so this
// combines videoDuration=short (under 4 min) with a #shorts search term —
// the standard workaround developers use to bias results toward real Shorts.
export async function fetchShorts(pageToken = null) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
    throw new Error('Add your YouTube API key in src/config/youtube.js first.');
  }
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoDuration: 'short',
    q: '#shorts',
    maxResults: '10',
    key: YOUTUBE_API_KEY,
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || 'Could not load videos right now. Try again shortly.');
  }
  const data = await res.json();
  return {
    items: (data.items || []).map(mapItem).filter(Boolean),
    nextPageToken: data.nextPageToken || null,
  };
}
