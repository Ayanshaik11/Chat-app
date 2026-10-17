// src/services/giphy.js
// GIF search powered by GIPHY (https://developers.giphy.com).
// The client key is embedded at build time from EXPO_PUBLIC_GIPHY_API_KEY (.env).

const API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';
const BASE = 'https://api.giphy.com/v1/gifs';

export const hasGiphyKey = () => !!String(API_KEY).trim();

// fixed_width keeps the animated GIF small enough for chat but still sharp.
const pickImage = (g) =>
  g?.images?.fixed_width || g?.images?.downsized_medium || g?.images?.original || null;

const normalize = (data) =>
  (Array.isArray(data) ? data : [])
    .map((g) => {
      const img = pickImage(g);
      if (!img?.url) return null;
      return {
        id: String(g.id || img.url),
        url: img.url,
        w: Number(img.width) || 0,
        h: Number(img.height) || 0,
        title: g?.title || '',
      };
    })
    .filter(Boolean);

async function giphyFetch(path, params = {}) {
  if (!hasGiphyKey()) return { noKey: true, items: [] };

  const qs = Object.entries({ api_key: API_KEY, rating: 'g', limit: 24, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const res = await fetch(`${BASE}/${path}?${qs}`);
  if (!res.ok) throw new Error(`Giphy request failed (${res.status})`);
  const json = await res.json();
  return { noKey: false, items: normalize(json?.data) };
}

export const trendingGifs = (limit = 24) => giphyFetch('trending', { limit });

export const searchGifs = (query, limit = 24) => {
  const q = String(query || '').trim();
  if (!q) return trendingGifs(limit);
  return giphyFetch('search', { q, limit });
};
