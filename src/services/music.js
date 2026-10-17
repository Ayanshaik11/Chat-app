
import { kingXMusicApi } from './kingXMusicApi';

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

export async function searchMusic(q = '', fbUser) {
  const query = String(q || '').trim();
  // If search query is empty, default to fetching latest new songs
  const effectiveQuery = query || 'latest songs';

  const params = new URLSearchParams({
    q: effectiveQuery,
    limit: '30',
  });

  const data = await kingXMusicApi(
    `/api/music/search?${params.toString()}`,
    fbUser
  );

  const seenIds = new Set();
  const items = [];

  for (const song of data.items || []) {
    const previewUrl = song.previewUrl || song.playback?.previewUrl || '';
    // Only return songs with a playable audio preview
    if (!previewUrl) continue;

    const id = String(song.providerTrackId || song.id || '');
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    items.push({
      id,
      name: decodeHtml(song.title || 'Unknown title'),
      artist: decodeHtml(
        Array.isArray(song.artists)
          ? song.artists.join(', ')
          : song.artist || 'Unknown artist'
      ),
      image: song.artwork || song.image || '',
      duration: Math.floor(Number(song.durationMs || 0) / 1000),
      url: previewUrl,
      providerUrl: song.playback?.url || '',
      ccurl: '',
    });
  }

  return items;
}

export async function getDiscoverMusic(category = 'latest', fbUser) {
  const tagMap = {
    latest: 'latest songs',
    trending: 'trending songs',
    bollywood: 'bollywood hits',
    punjabi: 'punjabi hits',
    romantic: 'romantic songs',
  };
  return searchMusic(tagMap[category] || category || 'latest songs', fbUser);
}

