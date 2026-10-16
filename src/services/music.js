
import { kingXMusicApi } from './kingXMusicApi';

export async function searchMusic(q = '', fbUser) {
  const query = String(q || '').trim();

  if (!query) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    limit: '25',
  });

  const data = await kingXMusicApi(
    `/api/music/search?${params.toString()}`,
    fbUser
  );

  return (data.items || []).map((song) => ({
    id: String(song.providerTrackId || song.id || ''),
    name: song.title || 'Unknown title',

    artist: Array.isArray(song.artists)
      ? song.artists.join(', ')
      : song.artist || 'Unknown artist',

    image: song.artwork || song.image || '',

    duration: Math.floor(
      Number(song.durationMs || 0) / 1000
    ),

    // Direct audio preview, if the API provides one.
    url: song.previewUrl || song.playback?.previewUrl || '',

    // Song webpage, not a direct audio stream.
    providerUrl: song.playback?.url || '',

    ccurl: '',
  }));
}
