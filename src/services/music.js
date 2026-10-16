
import { kingXMusicApi } from './kingXMusicApi';

export async function searchMusic(q = '', fbUser) {
  const params = new URLSearchParams({
    limit: '25',
    ...(q.trim() ? { q: q.trim() } : {}),
  });

  const data = await kingXMusicApi(
    `/api/music/search?${params.toString()}`,
    fbUser
  );

  return (data.items || [])
    .map((song) => ({
      id: String(song.providerTrackId || song.id),
      name: song.title || 'Unknown title',
      artist: Array.isArray(song.artists)
        ? song.artists.join(', ')
        : song.artist || 'Unknown artist',
      image: song.artwork || song.image || '',
      duration: Math.floor(
        Number(song.durationMs || 0) / 1000
      ),
      url:
        song.previewUrl ||
        song.playback?.previewUrl ||
        '',
      providerUrl: song.playback?.url || '',
      ccurl: '',
    }))
    .filter((song) => song.url);
}
