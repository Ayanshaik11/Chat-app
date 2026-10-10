/*
 * KING X — YOUTUBE VERCEL PROXY
 *
 * API KEY:
 * YOUTUBE_API_KEY is stored ONLY in Vercel Environment Variables.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_PAGE_ITEMS = 10; // keep searching until a page has at least this many playable videos
const MAX_SEARCH_ROUNDS = 3; // safety limit (each search costs 100 quota units)

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return res.status(500).json({
      error:
        'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  const userQuery =
    typeof req.query?.q === 'string' ? req.query.q.trim() : '';

  let pageToken =
    typeof req.query?.pageToken === 'string' ? req.query.pageToken : '';

  /*
   * "nd:" in front of a page token means the first page had to be searched
   * WITHOUT the date limit, so the next pages must be too (a page token only
   * works with exactly the same search settings).
   */
  let noDate = false;

  if (pageToken.startsWith('nd:')) {
    noDate = true;
    pageToken = pageToken.slice(3);
  }

  /*
   * Fresh feed every time the app opens.
   *
   * The app sends a random "seed" per session. The seed picks different
   * topics, sort order and time window, so results change on every open,
   * while pages inside one session stay consistent (same seed = same
   * search, so pageToken keeps working).
   */
  const seedRaw = parseInt(req.query?.seed, 10);
  let seedState = Number.isFinite(seedRaw) ? seedRaw >>> 0 : Date.now() >>> 0;

  const random = () => {
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
    'instagram trending reels',
    'Hindi dark memes',
    'hindi songs',
    'bollywood comedy',
    'hindi anime edits like goku x vegeta x bulma',
    'piccolo x gohan',
    'trunks x goten',
    'eren x Mikasa love Hindi edits',
    'Naruto and madara and itachi',
    'sung jinwoo',
    'gojo x sukuna',
    'toji',
  ];

  const pickedTopics = shuffle(TOPICS).slice(0, 3);

  const defaultQuery = pickedTopics
    .map((topic) => `#shorts ${topic}`)
    .join(' | ');

  const SORTS = ['date', 'viewCount', 'relevance'];
  const order = SORTS[Math.floor(random() * SORTS.length)];

  // 7 days .. ~6 months back. Rounded to the start of the day so the value is
  // identical on every page request (a changing value breaks page tokens).
  const daysBack = 7 + Math.floor(random() * 173);
  const publishedAfter = new Date(
    Math.floor(Date.now() / DAY_MS) * DAY_MS - daysBack * DAY_MS
  ).toISOString();

  const query = userQuery ? `#shorts ${userQuery}` : defaultQuery;

  const buildSearchParams = (token, withDate) => {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      regionCode: 'IN',
      relevanceLanguage: 'hi',
      order: userQuery ? 'relevance' : order,
      videoDuration: 'short', // under 4 minutes, not a guarantee of a real Short
      videoEmbeddable: 'true',
      safeSearch: 'moderate',
      q: query,
      maxResults: '25',
      key,
    });

    if (!userQuery && withDate) {
      params.set('publishedAfter', publishedAfter);
    }

    if (token) {
      params.set('pageToken', token);
    }

    return params;
  };

  const callYouTube = async (endpoint, params) => {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/${endpoint}?${params.toString()}`
    );
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data?.error?.message || `YouTube ${endpoint} failed`);
      error.status = response.status;
      throw error;
    }

    return data;
  };

  // One search + details lookup, keeping only videos that can play embedded.
  const searchOnce = async (token, withDate) => {
    const searchData = await callYouTube('search', buildSearchParams(token, withDate));

    const videoIds = (searchData.items || [])
      .map((item) => item?.id?.videoId)
      .filter(Boolean);

    if (!videoIds.length) {
      return { items: [], nextPageToken: searchData.nextPageToken || null };
    }

    const detailData = await callYouTube(
      'videos',
      new URLSearchParams({
        part: 'snippet,contentDetails,status',
        id: videoIds.join(','),
        key,
      })
    );

    const playable = (detailData.items || []).filter((v) => {
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

    const items = playable.map((video) => {
      const videoId = video.id;
      const snippet = video.snippet || {};

      const thumbnail =
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return {
        videoId,
        title: snippet.title || 'YouTube Video',
        description: snippet.description || '',
        thumbnail,
        thumbnailUrl: thumbnail,
        authorName: snippet.channelTitle || 'YouTube',
        channelTitle: snippet.channelTitle || 'YouTube',
        youtubeUrl: `https://www.youtube.com/shorts/${videoId}`,
        publishedAt: snippet.publishedAt || null,
        channelId: snippet.channelId || null,
      };
    });

    return { items, nextPageToken: searchData.nextPageToken || null };
  };

  try {
    let withDate = !noDate;
    let nextToken = pageToken || '';
    let collected = [];
    let lastNext = null;
    let usedFallback = noDate;

    for (let round = 0; round < MAX_SEARCH_ROUNDS; round += 1) {
      let result = await searchOnce(nextToken, withDate);

      // Nothing in the time window on the very first search? Drop the date limit.
      if (
        !result.items.length &&
        !result.nextPageToken &&
        withDate &&
        !userQuery &&
        !nextToken
      ) {
        withDate = false;
        usedFallback = true;
        result = await searchOnce('', false);
      }

      collected = collected.concat(result.items);
      lastNext = result.nextPageToken;

      // enough videos for this page, or nothing more to search
      if (collected.length >= MIN_PAGE_ITEMS || !lastNext) {
        break;
      }

      nextToken = lastNext;
    }

    // remove duplicates
    const seen = new Set();
    const uniqueItems = [];

    for (const item of collected) {
      if (!item.videoId || seen.has(item.videoId)) continue;
      seen.add(item.videoId);
      uniqueItems.push(item);
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');

    return res.status(200).json({
      items: userQuery ? uniqueItems : shuffle(uniqueItems),
      nextPageToken: lastNext ? (usedFallback ? `nd:${lastNext}` : lastNext) : null,
      regionCode: 'IN',
      language: 'hi',
      query,
      count: uniqueItems.length,
    });
  } catch (error) {
    console.error('YouTube proxy error:', error);

    return res.status(error?.status || 500).json({
      error: error?.message || 'Failed to load YouTube videos',
    });
  }
};
