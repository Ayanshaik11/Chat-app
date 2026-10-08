// src/services/youtube.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import PROXY_API_URL from '../config/proxy';

const SEEN_KEY = 'king_x_seen_shorts';
const SEEN_LIMIT = 500;

async function getSeen() {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// Remember a video was watched so it isn't shown again next time
export async function markShortSeen(videoId) {
  if (!videoId) return;
  try {
    const list = await getSeen();
    if (list.includes(videoId)) return;
    const next = [...list, videoId].slice(-SEEN_LIMIT);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch (e) {}
}

const API_URL =
  `${PROXY_API_URL}/api/youtube-shorts`;


/* =======================================================
   FETCH YOUTUBE VIDEOS
======================================================= */

export async function fetchShorts(
  pageToken = null,
  searchQuery = '',
  seed = null
) {
  const params =
    new URLSearchParams();

  if (pageToken) {
    params.set(
      'pageToken',
      pageToken
    );
  }

  if (
    searchQuery &&
    searchQuery.trim()
  ) {
    params.set(
      'q',
      searchQuery.trim()
    );
  }

  if (seed) {
    params.set('seed', String(seed));
  }

  const queryString =
    params.toString();

  const url =
    queryString
      ? `${API_URL}?${queryString}`
      : API_URL;

  console.log(
    'YouTube proxy URL:',
    url
  );

  const response =
    await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });

  let data;

  try {
    data =
      await response.json();
  } catch (error) {
    throw new Error(
      'YouTube proxy returned an invalid response.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `YouTube proxy error: ${response.status}`
    );
  }

  const rawItems =
    Array.isArray(data)
      ? data
      : data?.items ||
        data?.videos ||
        data?.results ||
        [];

  const items =
    rawItems
      .map(
        (item, index) => {
          const videoId =
            item?.videoId ||
            item?.id?.videoId ||
            (
              typeof item?.id ===
              'string'
                ? item.id
                : null
            );

          if (!videoId) {
            return null;
          }

          const snippet =
            item?.snippet ||
            item;

          const thumbnail =
            item?.thumbnail ||
            item?.thumbnailUrl ||
            snippet?.thumbnails?.maxres?.url ||
            snippet?.thumbnails?.high?.url ||
            snippet?.thumbnails?.medium?.url ||
            snippet?.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          return {
            id:
              `youtube-${videoId}-${index}`,

            videoId,

            isExternal: true,

            title:
              item?.title ||
              snippet?.title ||
              'YouTube Video',

            caption:
              item?.caption ||
              item?.title ||
              snippet?.title ||
              '',

            description:
              item?.description ||
              snippet?.description ||
              '',

            thumbnail,

            thumbnailUrl:
              thumbnail,

            authorName:
              item?.authorName ||
              item?.channelTitle ||
              snippet?.channelTitle ||
              'YouTube',

            channelTitle:
              item?.channelTitle ||
              snippet?.channelTitle ||
              'YouTube',

            youtubeUrl:
              item?.youtubeUrl ||
              `https://www.youtube.com/shorts/${videoId}`,

            likes: [],
          };
        }
      )
      .filter(Boolean);

  /*
   * Remove duplicate videos.
   */
  const seen =
    new Set();

  const uniqueItems =
    items.filter(
      (item) => {
        if (
          seen.has(
            item.videoId
          )
        ) {
          return false;
        }

        seen.add(
          item.videoId
        );

        return true;
      }
    );

  // hide videos the person already watched (default feed only)
  let finalItems = uniqueItems;

  if (!searchQuery || !searchQuery.trim()) {
    const seenList = new Set(await getSeen());
    const fresh = uniqueItems.filter((item) => !seenList.has(item.videoId));
    if (fresh.length) {
      finalItems = fresh;
    }
  }

  return {
    items: finalItems,

    nextPageToken:
      data?.nextPageToken ||
      null,

    query:
      data?.query ||
      searchQuery ||
      '',
  };
}