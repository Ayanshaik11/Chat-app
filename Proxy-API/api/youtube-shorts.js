/*
 * KING X — YOUTUBE VERCEL PROXY
 *
 * API KEY:
 * YOUTUBE_API_KEY is stored ONLY in Vercel Environment Variables.
 *
 * HOW THE FEED WORKS
 * ------------------
 * Before: all topics were joined into ONE search ("a | b | c"), and YouTube
 * answered with whichever topic ranked best -> the whole feed was one topic.
 *
 * Now: every topic is searched SEPARATELY and the results are kept in a shared
 * "pool" (stored in Firestore: config/shortsPool, refreshed every POOL_TTL_MS).
 * Each app session gets a different seeded MIX from that pool, taking a few
 * videos from every topic in turn. This also keeps the YouTube quota low:
 * about 11 searches per refresh no matter how many people open the app.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ----- your keywords: add / remove topics here -----
const TOPICS = [
  'instagram trending reels',
  'Hindi dark memes',
  'hindi songs',
  'bollywood comedy',
  'hindi anime edits like goku x vegeta x bulma',
  'eren x Mikasa love Hindi edits',
  'Naruto and madara and itachi',
  'gojo x sukuna',
];

const POOL_TTL_MS = 6 * 60 * 60 * 1000; // how often topics are searched again (quota: ~1,100 units per refresh)
const RETRY_PARTIAL_MS = 30 * 60 * 1000; // if some topics failed, try again after this long
const MEMORY_TTL_MS = 5 * 60 * 1000; // how long one server instance reuses the pool it loaded
const RESULTS_PER_TOPIC = 50; // one search = 100 quota units whatever this is, so ask for the max
const PER_TOPIC_PER_PAGE = 4; // videos taken from EACH topic for one page of the feed
const POOL_DOC_PATH = 'config/shortsPool';

/* ---------------- helpers ---------------- */

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function callYouTube(key, endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries({ ...params, key }).forEach(([k, v]) => v !== undefined && v !== '' && url.searchParams.set(k, v));

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || `YouTube ${endpoint} failed`);
    error.status = response.status;
    throw error;
  }

  return data;
}

// One search + a details lookup, keeping only videos that can play embedded.
async function searchPlayable(key, { q, order, publishedAfter, pageToken, maxResults }) {
  const searchData = await callYouTube(key, 'search', {
    part: 'snippet',
    type: 'video',
    regionCode: 'IN',
    relevanceLanguage: 'hi',
    order,
    videoDuration: 'short', // under 4 minutes, not a guarantee of a real Short
    videoEmbeddable: 'true',
    safeSearch: 'moderate',
    q,
    maxResults: String(maxResults),
    publishedAfter,
    pageToken,
  });

  const ids = (searchData.items || []).map((i) => i?.id?.videoId).filter(Boolean);
  const nextPageToken = searchData.nextPageToken || null;

  if (!ids.length) return { items: [], nextPageToken };

  const detail = await callYouTube(key, 'videos', {
    part: 'snippet,contentDetails,status',
    id: ids.join(','),
  });

  const items = (detail.items || [])
    .filter((v) => {
      const status = v.status || {};
      const details = v.contentDetails || {};
      if (status.embeddable === false) return false;
      if (status.privacyStatus && status.privacyStatus !== 'public') return false;
      if (details.contentRating?.ytRating === 'ytAgeRestricted') return false;
      const region = details.regionRestriction;
      if (region?.blocked?.includes('IN')) return false;
      if (region?.allowed && !region.allowed.includes('IN')) return false;
      return true;
    })
    .map((video) => {
      const snippet = video.snippet || {};
      const thumbnail =
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

      return {
        videoId: video.id,
        title: snippet.title || 'YouTube Video',
        description: String(snippet.description || '').slice(0, 160),
        thumbnail,
        thumbnailUrl: thumbnail,
        authorName: snippet.channelTitle || 'YouTube',
        channelTitle: snippet.channelTitle || 'YouTube',
        youtubeUrl: `https://www.youtube.com/shorts/${video.id}`,
        publishedAt: snippet.publishedAt || null,
        channelId: snippet.channelId || null,
      };
    });

  return { items, nextPageToken };
}

/* ---------------- Firestore (shared pool storage) ---------------- */

let adminApp = null;

function getAdminDb() {
  const admin = require('firebase-admin');

  if (!adminApp) {
    adminApp = admin.apps.length ? admin.app() : null;
  }

  if (!adminApp) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');
    adminApp = admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }

  return adminApp.firestore();
}

/* ---------------- the pool ---------------- */

async function refreshPool(key, previous) {
  const random = makeRandom(Date.now());
  const topics = {};
  let failed = 0;
  let lastError = null;

  await Promise.all(
    TOPICS.map(async (topic) => {
      // each topic gets its own sort order and time window, so every refresh is different
      const roll = random();
      const order = roll < 0.5 ? 'relevance' : roll < 0.8 ? 'viewCount' : 'date';
      const daysBack = 14 + Math.floor(random() * 350);
      const publishedAfter = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS - daysBack * DAY_MS).toISOString();
      const q = `#shorts ${topic}`;

      try {
        let { items } = await searchPlayable(key, { q, order, publishedAfter, maxResults: RESULTS_PER_TOPIC });

        // too little in that window? search again without the date limit
        if (items.length < 10) {
          ({ items } = await searchPlayable(key, { q, order, maxResults: RESULTS_PER_TOPIC }));
        }

        topics[topic] = items;
      } catch (error) {
        failed += 1;
        lastError = error;
        console.error(`Topic search failed (${topic}):`, error?.message);
        // keep what we had for this topic
        if (previous?.topics?.[topic]) topics[topic] = previous.topics[topic];
      }
    })
  );

  const usable = Object.values(topics).filter((list) => list.length).length;

  if (!usable) {
    throw lastError || new Error('No videos found for any topic.');
  }

  return {
    // if some topics failed (e.g. quota), look again sooner than the normal TTL
    updatedAt: failed ? Date.now() - POOL_TTL_MS + RETRY_PARTIAL_MS : Date.now(),
    topics,
  };
}

let memoryPool = null; // { updatedAt, topics, loadedAt }
let loading = null;

async function getPool(key) {
  const now = Date.now();

  if (memoryPool && now - memoryPool.loadedAt < MEMORY_TTL_MS && now - memoryPool.updatedAt < POOL_TTL_MS) {
    return memoryPool;
  }

  if (loading) return loading;

  loading = (async () => {
    let pool = null;

    try {
      const snap = await getAdminDb().doc(POOL_DOC_PATH).get();
      if (snap.exists) {
        const data = snap.data();
        pool = { updatedAt: Number(data.updatedAt) || 0, topics: JSON.parse(data.topicsJson || '{}') };
      }
    } catch (error) {
      console.warn('Could not read the shared pool:', error?.message);
    }

    pool = pool || memoryPool;

    if (!pool || Date.now() - pool.updatedAt >= POOL_TTL_MS) {
      try {
        const fresh = await refreshPool(key, pool);
        pool = fresh;

        try {
          getAdminDb()
            .doc(POOL_DOC_PATH)
            .set({ updatedAt: fresh.updatedAt, topicsJson: JSON.stringify(fresh.topics) })
            .catch((error) => console.warn('Could not save the shared pool:', error?.message));
        } catch (error) {
          console.warn('Could not save the shared pool:', error?.message);
        }
      } catch (error) {
        if (!pool) throw error; // nothing older to fall back on
        console.warn('Refresh failed, using the older pool:', error?.message);
      }
    }

    memoryPool = { ...pool, loadedAt: Date.now() };
    return memoryPool;
  })().finally(() => {
    loading = null;
  });

  return loading;
}

/* ---------------- one page of the mixed feed ---------------- */

function buildMixedPage(pool, seed, page) {
  const random = makeRandom(seed);

  // every topic in a seed-specific order, each topic's videos shuffled separately
  const names = shuffle(Object.keys(pool.topics).filter((t) => pool.topics[t]?.length), random);
  const lists = names.map((name) => shuffle(pool.topics[name], makeRandom(seed ^ hashString(name))));

  const start = page * PER_TOPIC_PER_PAGE;
  const items = [];
  const used = new Set();

  // round-robin: one video from topic 1, one from topic 2, ... then the next round
  for (let i = 0; i < PER_TOPIC_PER_PAGE; i += 1) {
    for (const list of lists) {
      const video = list[start + i];
      if (video && !used.has(video.videoId)) {
        used.add(video.videoId);
        items.push(video);
      }
    }
  }

  const hasMore = lists.some((list) => list.length > start + PER_TOPIC_PER_PAGE);

  return { items, nextPageToken: hasMore ? `p:${page + 1}` : null, topicCount: lists.length };
}

/* ---------------- request handler ---------------- */

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: 'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const userQuery = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const pageToken = typeof req.query?.pageToken === 'string' ? req.query.pageToken : '';

  try {
    /* ----- the user typed a search: plain YouTube search ----- */
    if (userQuery) {
      const { items, nextPageToken } = await searchPlayable(key, {
        q: `#shorts ${userQuery}`,
        order: 'relevance',
        pageToken: pageToken && !pageToken.startsWith('p:') ? pageToken : undefined,
        maxResults: 25,
      });

      const seen = new Set();
      const unique = items.filter((v) => v.videoId && !seen.has(v.videoId) && seen.add(v.videoId));

      return res.status(200).json({
        items: unique,
        nextPageToken,
        regionCode: 'IN',
        language: 'hi',
        query: userQuery,
        count: unique.length,
      });
    }

    /* ----- default feed: a mix of every topic ----- */
    const seedRaw = parseInt(req.query?.seed, 10);
    const seed = Number.isFinite(seedRaw) ? seedRaw >>> 0 : Date.now() >>> 0;

    const match = /^p:(\d+)$/.exec(pageToken); // older app versions send other tokens -> start at page 0
    const page = match ? parseInt(match[1], 10) : 0;

    const pool = await getPool(key);
    const result = buildMixedPage(pool, seed, page);

    return res.status(200).json({
      items: result.items,
      nextPageToken: result.nextPageToken,
      regionCode: 'IN',
      language: 'hi',
      query: `mixed (${result.topicCount} topics)`,
      count: result.items.length,
    });
  } catch (error) {
    console.error('YouTube proxy error:', error);

    return res.status(error?.status || 500).json({
      error: error?.message || 'Failed to load YouTube videos',
    });
  }
};
