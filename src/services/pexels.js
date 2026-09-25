import { PEXELS_API_KEY } from '../config/pexels';

const BASE = 'https://api.pexels.com/v1/videos';

function pickFile(files = []) {
  const mp4 = files.filter((f) => f.file_type === 'video/mp4');

  // Prefer portrait videos for the Reels experience.
  const portrait = mp4.filter((f) => f.height > f.width);
  const pool = portrait.length ? portrait : mp4;

  // Prefer SD to reduce mobile data usage.
  const sd = pool.find((f) => f.quality === 'sd');

  return (sd || pool[0])?.link;
}

function mapVideo(v) {
  return {
    id: `pexels-${v.id}`,
    videoURL: pickFile(v.video_files),

    // External video
    authorId: null,
    authorName: v.user?.name || 'Pexels creator',
    authorURL: v.user?.url || null,

    likes: [],
    caption: '',

    pexelsUrl: v.url,
    isExternal: true,
  };
}

export async function fetchDiscoverVideos(page = 1, perPage = 10) {
  if (!PEXELS_API_KEY || PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY') {
    throw new Error(
      'Add your Pexels API key in src/config/pexels.js first.'
    );
  }

  const url =
    `${BASE}/popular?per_page=${perPage}` +
    `&page=${page}` +
    `&min_width=480`;

  const res = await fetch(url, {
    headers: {
      Authorization: PEXELS_API_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('Pexels error:', res.status, text);
    throw new Error('Could not load Pexels videos.');
  }

  const data = await res.json();

  return (data.videos || [])
    .map(mapVideo)
    .filter((video) => video.videoURL);
}