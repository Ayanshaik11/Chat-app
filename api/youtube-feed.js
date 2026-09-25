export default async function handler(req, res) {
  try {
    const API_KEY = process.env.YOUTUBE_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        error: 'YOUTUBE_API_KEY is not configured on Vercel.',
      });
    }

    const {
      pageToken = '',
      limit = '20',
      q = '',
    } = req.query;

    const maxResults = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      50
    );

    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: String(maxResults),

      // Short-form/public videos
      videoDuration: 'short',

      // Only videos that can be embedded/syndicated
      videoEmbeddable: 'true',
      videoSyndicated: 'true',

      // Helps return recent/relevant public content
      order: 'relevance',

      key: API_KEY,
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    if (q) {
      params.set('q', q);
    } else {
      // Rotate search topics instead of requesting the
      // exact same feed every time.
      const topics = [
        'funny',
        'edit',
        'music',
        'gaming',
        'football',
        'cricket',
        'anime',
        'technology',
        'cars',
        'travel',
        'motivation',
        'comedy',
      ];

      const randomTopic =
        topics[Math.floor(Math.random() * topics.length)];

      params.set('q', randomTopic);
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('YouTube API error:', data);

      return res.status(response.status).json({
        error: 'YouTube API request failed.',
        details: data.error?.message || 'Unknown error',
      });
    }

    const videos = (data.items || [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        id: `youtube-${item.id.videoId}`,
        videoId: item.id.videoId,

        title: item.snippet?.title || '',
        description: item.snippet?.description || '',

        channelTitle:
          item.snippet?.channelTitle || 'YouTube creator',

        channelId:
          item.snippet?.channelId || null,

        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          null,

        youtubeUrl:
          `https://www.youtube.com/watch?v=${item.id.videoId}`,

        isYouTube: true,
        isExternal: true,
      }));

    return res.status(200).json({
      videos,
      nextPageToken: data.nextPageToken || null,
    });
  } catch (error) {
    console.error('YouTube feed error:', error);

    return res.status(500).json({
      error: 'Failed to load YouTube feed.',
    });
  }
}