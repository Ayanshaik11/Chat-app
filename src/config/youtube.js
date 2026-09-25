const YOUTUBE_FEED_URL =
  'https://YOUR-VERCEL-DOMAIN.vercel.app/api/youtube-feed';

/**
 * Fetch public YouTube short-form videos
 * through the Vercel backend.
 *
 * The YouTube API key is NOT stored in the app.
 */
export async function fetchYouTubeVideos({
  pageToken = '',
  limit = 20,
  query = '',
} = {}) {
  const params = new URLSearchParams();

  params.set('limit', String(limit));

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  if (query) {
    params.set('q', query);
  }

  const url = `${YOUTUBE_FEED_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text().catch(() => '');

    console.warn(
      'YouTube feed error:',
      response.status,
      text
    );

    throw new Error('Could not load YouTube videos.');
  }

  const data = await response.json();

  return {
    videos: Array.isArray(data.videos)
      ? data.videos
      : [],
    nextPageToken: data.nextPageToken || null,
  };
}