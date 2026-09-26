/*
 * =========================================================
 * KING X — YOUTUBE VERCEL PROXY
 * =========================================================
 *
 * IMPORTANT:
 *
 * YOUTUBE_API_KEY is stored ONLY in Vercel.
 *
 * Never put the key inside the React Native app.
 *
 * Vercel endpoint:
 *
 * /api/youtube-shorts
 * =========================================================
 */


module.exports = async (
  req,
  res
) => {

  const key =
    process.env.YOUTUBE_API_KEY;


  /* =======================================================
     API KEY CHECK
  ======================================================== */

  if (!key) {

    return res.status(500).json({

      error:
        'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.',

    });

  }


  const pageToken =
    req.query?.pageToken ||
    '';


  /*
   * =======================================================
   * SEARCH QUERY
   * =======================================================
   *
   * YouTube Data API does NOT have:
   *
   * shortsOnly=true
   *
   * So we target Shorts using #shorts and
   * Indian/Hindi search terms.
   */

  const query =
    '#shorts Hindi|#shorts Bollywood|#shorts comedy|#shorts India|#shorts memes|#shorts entertainment';


  /* =======================================================
     SEARCH PARAMETERS
  ======================================================== */

  const params =
    new URLSearchParams({

      part:
        'snippet',

      type:
        'video',

      regionCode:
        'IN',

      relevanceLanguage:
        'hi',

      order:
        'relevance',

      /*
       * NOTE:
       *
       * "short" means less than 4 minutes.
       * It does NOT mean Shorts-only.
       */

      videoDuration:
        'short',

      videoEmbeddable:
        'true',

      safeSearch:
        'moderate',

      q:
        query,

      maxResults:
        '25',

      key,

    });


  if (pageToken) {

    params.set(
      'pageToken',
      pageToken
    );

  }


  try {

    /* =====================================================
       STEP 1 — SEARCH
    ====================================================== */

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
      searchData.items ||
      [];


    /*
     * Extract IDs.
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

        regionCode:
          'IN',

        language:
          'hi',

        count:
          0,

      });

    }


    /* =====================================================
       STEP 2 — GET VIDEO DETAILS
    ====================================================== */

    const detailParams =
      new URLSearchParams({

        part:
          'snippet,contentDetails',

        id:
          videoIds.join(','),

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


    const videos =
      detailData.items ||
      [];


    /* =====================================================
       STEP 3 — FORMAT
    ====================================================== */

    const items =
      videos
        .map(
          (video) => {

            const videoId =
              video.id;


            if (!videoId) {
              return null;
            }


            const snippet =
              video.snippet ||
              {};


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

              publishedAt:
                snippet.publishedAt ||
                null,

              channelId:
                snippet.channelId ||
                null,

            };

          }
        )
        .filter(Boolean);


    /* =====================================================
       STEP 4 — REMOVE DUPLICATES
    ====================================================== */

    const uniqueItems = [];

    const seen =
      new Set();


    for (
      const item of items
    ) {

      if (
        seen.has(
          item.videoId
        )
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
