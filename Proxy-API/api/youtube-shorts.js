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
  const defaultQuery =
    '#shorts Hindi | ' +
    '#shorts Bollywood | ' +
    '#shorts comedy | ' +
    '#shorts India | ' +
    '#shorts memes | ' +
    '#shorts entertainment';

  /*
   * If user searches something:
   *
   * "Shah Rukh Khan"
   *
   * becomes:
   *
   * "#shorts Shah Rukh Khan"
   *
   * This is a relevance search, not an exact
   * phrase-only search.
   */
  const query = userQuery
    ? `#shorts ${userQuery}`
    : defaultQuery;

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',

    regionCode: 'IN',

    relevanceLanguage: 'hi',

    order: 'relevance',

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

    return res.status(200).json({
      items: uniqueItems,

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