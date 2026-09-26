// Vercel serverless function
// YouTube API key stays ONLY in Vercel Environment Variables.

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return res.status(500).json({
      error:
        'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  const pageToken = req.query.pageToken || '';

  /*
   * Search specifically around Shorts.
   *
   * IMPORTANT:
   * YouTube Data API does NOT have a shortsOnly=true filter.
   * videoDuration=short means < 4 minutes, not Shorts.
   */
  const query =
    '#shorts Hindi|#shorts Bollywood|#shorts comedy|#shorts India|#shorts dank memes|#shorts entertainment|#shorts srk videos|#shorts hindi anime';

  const searchParams = new URLSearchParams({
    part: 'snippet',

    type: 'video',

    regionCode: 'IN',

    relevanceLanguage: 'hi',

    order: 'relevance',

    /*
     * This is still required because Shorts are normally short,
     * but it is NOT enough by itself to identify Shorts.
     */
    videoDuration: 'short',

    videoEmbeddable: 'true',

    safeSearch: 'moderate',

    q: query,

    maxResults: '25',

    key,
  });

  if (pageToken) {
    searchParams.set(
      'pageToken',
      pageToken
    );
  }

  try {
    /* =====================================================
       STEP 1
       SEARCH YOUTUBE
    ====================================================== */

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
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


    /*
     * Extract video IDs.
     */

    const videoIds =
      searchItems
        .map(
          (item) =>
            item?.id?.videoId
        )
        .filter(Boolean);


    if (!videoIds.length) {
      return res.status(200).json({
        items: [],
        nextPageToken:
          searchData.nextPageToken ||
          null,
        regionCode: 'IN',
        language: 'hi',
        count: 0,
      });
    }


    /* =====================================================
       STEP 2
       GET VIDEO DETAILS
    ====================================================== */

    const videoParams =
      new URLSearchParams({
        part:
          'snippet,contentDetails',

        id:
          videoIds.join(','),

        key,
      });


    const videoResponse =
      await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`
      );


    const videoData =
      await videoResponse.json();


    if (!videoResponse.ok) {
      console.error(
        'YouTube videos error:',
        videoData
      );

      return res.status(
        videoResponse.status
      ).json({
        error:
          videoData?.error?.message ||
          'Could not get YouTube video details',
      });
    }


    const videos =
      videoData.items || [];


    /* =====================================================
       STEP 3
       BUILD RESULTS
    ====================================================== */

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
            'YouTube Short',

          description:
            snippet.description ||
            '',

          thumbnail,

          authorName:
            snippet.channelTitle ||
            'YouTube',

          channelTitle:
            snippet.channelTitle ||
            'YouTube',

          youtubeUrl:
            `https://www.youtube.com/shorts/${videoId}`,

          /*
           * Useful for debugging/filtering later.
           */
          publishedAt:
            snippet.publishedAt ||
            null,

          channelId:
            snippet.channelId ||
            null,
        };
      });


    /* =====================================================
       STEP 4
       REMOVE DUPLICATES
    ====================================================== */

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

      uniqueItems.push(
        item
      );
    }


    /* =====================================================
       RESPONSE
    ====================================================== */

    return res.status(200).json({

      items:
        uniqueItems,

      nextPageToken:
        searchData.nextPageToken ||
        null,

      regionCode:
        'IN',

      language:
        'hi',

      count:
        uniqueItems.length,
    });

  } catch (e) {

    console.error(
      'YouTube proxy error:',
      e
    );

    return res.status(500).json({
      error:
        e?.message ||
        'Failed to load YouTube videos',
    });
  }
};