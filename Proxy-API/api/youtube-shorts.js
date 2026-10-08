/*
 * KING X — YOUTUBE VERCEL PROXY
 *
 * API KEY:
 * YOUTUBE_API_KEY is stored ONLY in Vercel
 * Environment Variables.
 */

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return res.status(500).json({
      error:
        'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  /*
   * Search query from the app.
   *
   * Example:
   * /api/youtube-shorts?q=srk
   *
   * If no query is supplied, use the
   * default King X Discover keywords.
   */
  const userQuery =
    typeof req.query?.q === 'string'
      ? req.query.q.trim()
      : '';

  const pageToken =
    typeof req.query?.pageToken === 'string'
      ? req.query.pageToken
      : '';

  /*
   * Default Discover feed.
   *
   * The | operator tells YouTube to search
   * across multiple keyword groups.
   */
  /*
   * Fresh feed every time the app opens.
   *
   * The app sends a random "seed" for each session. The seed picks
   * different topics, a different sort order and a different time
   * window, so the results change on every open — while pages inside
   * one session stay consistent (same seed = same search, so
   * pageToken keeps working).
   */
  const seedRaw = parseInt(req.query?.seed, 10);
  let seedState = Number.isFinite(seedRaw)
    ? seedRaw >>> 0
    : (Date.now() >>> 0);

  const random = () => {
    // mulberry32 seeded random
    seedState = (seedState + 0x6d2b79f5) >>> 0;
    let t = seedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const shuffle = (list) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const TOPICS = [
    'Hindi dark memes','hindi songs','bollywood','hindi anime edits','instagram viral reels'  ];

  const pickedTopics = shuffle(TOPICS).slice(0, 3);

  const defaultQuery = pickedTopics
    .map((topic) => `#shorts ${topic}`)
    .join(' | ');

  const SORTS = ['date', 'viewCount', 'relevance', 'rating'];
  const order = SORTS[Math.floor(random() * SORTS.length)];

  // look back between 2 and 90 days
  const daysBack = 2 + Math.floor(random() * 88);
  const publishedAfter = new Date(
    Date.now() - daysBack * 24 * 60 * 60 * 1000
  ).toISOString();

  const query = userQuery
    ? `#shorts ${userQuery}`
    : defaultQuery;

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',

    regionCode: 'IN',

    relevanceLanguage: 'hi',

    order: userQuery ? 'relevance' : order,

    /*
     * YouTube "short" means under 4 minutes.
     * It does NOT guarantee an actual Shorts video.
     */
    videoDuration: 'short',

    videoEmbeddable: 'true',

    safeSearch: 'moderate',

    q: query,

    maxResults: '25',

    key,
  });

  if (!userQuery) {
    params.set('publishedAfter', publishedAfter);
  }

  if (pageToken) {
    params.set(
      'pageToken',
      pageToken
    );
  }

  try {
    /*
     * STEP 1
     * Search YouTube.
     */
    const searchResponse =
      await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
      );

    const searchData =
      await searchResponse.json();

    if (!searchResponse.ok) {
      console.error(
        'YouTube search error:',
        searchData
      );

      return res.status(
        searchResponse.status
      ).json({
        error:
          searchData?.error?.message ||
          'YouTube search failed',
      });
    }

    const searchItems =
      searchData.items || [];

    const videoIds =
      searchItems
        .map(
          (item) =>
            item?.id?.videoId
        )
        .filter(Boolean);

    /*
     * No results.
     */
    if (!videoIds.length) {
      return res.status(200).json({
        items: [],

        nextPageToken:
          searchData.nextPageToken ||
          null,

        regionCode: 'IN',

        language: 'hi',

        query,

        count: 0,
      });
    }

    /*
     * STEP 2
     *
     * Get additional video information.
     */
    const detailParams =
      new URLSearchParams({
        part:
          'snippet,contentDetails,status',

        id: videoIds.join(','),

        key,
      });

    const detailResponse =
      await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`
      );

    const detailData =
      await detailResponse.json();

    if (!detailResponse.ok) {
      console.error(
        'YouTube videos error:',
        detailData
      );

      return res.status(
        detailResponse.status
      ).json({
        error:
          detailData?.error?.message ||
          'Could not get YouTube video details',
      });
    }

    // Keep only videos that can really play inside an embedded player:
    // embeddable, public, not age-restricted and not blocked in India.
    const videos = (detailData.items || []).filter((v) => {
      const status = v.status || {};
      const details = v.contentDetails || {};
      if (status.embeddable === false) return false;
      if (status.privacyStatus && status.privacyStatus !== 'public') return false;
      if (details.contentRating?.ytRating === 'ytAgeRestricted') return false;
      const region = details.regionRestriction;
      if (region?.blocked?.includes('IN')) return false;
      if (region?.allowed && !region.allowed.includes('IN')) return false;
      return true;
    });

    /*
     * Convert YouTube response into
     * a small clean object for King X.
     */
    const items =
      videos.map((video) => {
        const videoId =
          video.id;

        const snippet =
          video.snippet || {};

        const thumbnail =
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          videoId,

          title:
            snippet.title ||
            'YouTube Video',

          description:
            snippet.description ||
            '',

          thumbnail,

          thumbnailUrl:
            thumbnail,

          authorName:
            snippet.channelTitle ||
            'YouTube',

          channelTitle:
            snippet.channelTitle ||
            'YouTube',

          youtubeUrl:
            `https://www.youtube.com/shorts/${videoId}`,

          publishedAt:
            snippet.publishedAt ||
            null,

          channelId:
            snippet.channelId ||
            null,
        };
      });

    /*
     * Remove duplicates.
     */
    const uniqueItems = [];

    const seen =
      new Set();

    for (const item of items) {
      if (
        !item.videoId ||
        seen.has(item.videoId)
      ) {
        continue;
      }

      seen.add(
        item.videoId
      );

      uniqueItems.push(item);
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');

    return res.status(200).json({
      items: userQuery ? uniqueItems : shuffle(uniqueItems),

      nextPageToken:
        searchData.nextPageToken ||
        null,

      regionCode: 'IN',

      language: 'hi',

      query,

      count:
        uniqueItems.length,
    });
  } catch (error) {
    console.error(
      'YouTube proxy error:',
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        'Failed to load YouTube videos',
    });
  }
};