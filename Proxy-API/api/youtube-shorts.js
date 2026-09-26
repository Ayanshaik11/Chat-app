// Vercel serverless function
// YouTube API key stays only in Vercel Environment Variables.

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return res.status(500).json({
      error:
        'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  const pageToken = req.query.pageToken || '';

  const query =
    'Hindi songs|Bollywood songs|Hindi comedy|Indian comedy|Hindi memes|Bollywood|Indian entertainment|trending India|Hindi shorts|Indian shorts';

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',

    // Indian content
    regionCode: 'IN',

    // Prefer Hindi-language results
    relevanceLanguage: 'hi',

    // Search relevance
    order: 'relevance',

    // Short videos
    videoDuration: 'short',

    // Only videos that can be embedded in the app
    videoEmbeddable: 'true',

    // Moderate filtering
    safeSearch: 'moderate',

    q: query,

    maxResults: '25',
    key,
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  try {
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );

    const data = await ytRes.json();

    if (!ytRes.ok) {
      console.error('YouTube API error:', data);

      return res.status(ytRes.status).json({
        error:
          data?.error?.message ||
          'YouTube request failed',
      });
    }

    const items = (data.items || [])
      .filter((item) => item?.id?.videoId)
      .map((item) => {
        const videoId = item.id.videoId;
        const snippet = item.snippet || {};

        const thumbnail =
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          videoId,

          title: snippet.title || 'YouTube Short',

          description: snippet.description || '',

          thumbnail,

          authorName:
            snippet.channelTitle || 'YouTube',

          channelTitle:
            snippet.channelTitle || 'YouTube',

          youtubeUrl:
            `https://www.youtube.com/shorts/${videoId}`,
        };
      });

    return res.status(200).json({
      items,
      nextPageToken: data.nextPageToken || null,

      regionCode: 'IN',
      language: 'hi',
      count: items.length,
    });
  } catch (e) {
    console.error('YouTube proxy error:', e);

    return res.status(500).json({
      error: e?.message || 'Failed to load YouTube videos',
    });
  }
};