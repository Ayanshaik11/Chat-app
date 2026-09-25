import { PEXELS_API_KEY } from '../config/pexels';

const BASE = 'https://api.pexels.com/videos';

// Pick a playable mp4 file, preferring a portrait (reel-shaped) version when
// the source video has one. Landscape sources still play fine — the video
// is cropped to fill the screen (like Instagram does with wide clips).
function pickFile(files = []) {
  const mp4 = files.filter((f) => f.file_type === 'video/mp4');
  const portrait = mp4.filter((f) => f.height > f.width);
  const pool = portrait.length ? portrait : mp4;
  const sd = pool.find((f) => f.quality === 'sd');
  return (sd || pool[0])?.link;
}

function mapVideo(v) {
  return {
    id: `pexels-${v.id}`,
    videoURL: pickFile(v.video_files),
    authorName: v.user?.name || 'Pexels',
    authorId: null,
    likes: [],
    caption: '',
    pexelsUrl: v.url,
    isExternal: true,
  };
}

// A general "discover" feed of popular stock videos, paginated.
export async function fetchDiscoverVideos(page = 1, perPage = 10) {
  if (!PEXELS_API_KEY || PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY') {
    throw new Error('Add your Pexels API key in src/config/pexels.js first.');
  }
  const res = await fetch(`${BASE}/popular?per_page=${perPage}&page=${page}&min_width=480`, {
    headers: { Authorization: PEXELS_API_KEY },
  });
  if (!res.ok) throw new Error('Could not load videos right now. Try again shortly.');
  const data = await res.json();
  return (data.videos || []).map(mapVideo).filter((v) => v.videoURL);
}
