// src/services/youtube.js

import PROXY_API_URL from '../config/proxy';

const API_URL =
  `${PROXY_API_URL}/api/youtube-shorts`;


export async function fetchShorts(pageToken = null) {
  let url = API_URL;

  if (pageToken) {
    url += `?pageToken=${encodeURIComponent(pageToken)}`;
  }

  console.log('YouTube proxy URL:', url);

  const response = await fetch(url);

  let data;

  try {
    data = await response.json();
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

  const items = rawItems
    .map((item, index) => {
      const videoId =
        item?.videoId ||
        item?.id?.videoId ||
        (typeof item?.id === 'string'
          ? item.id
          : null);

      if (!videoId) {
        return null;
      }

      const snippet =
        item?.snippet || item;

      const thumbnail =
        item?.thumbnail ||
        item?.thumbnailUrl ||
        snippet?.thumbnails?.maxres?.url ||
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return {
        id: `youtube-${videoId}-${index}`,

        videoId,

        isExternal: true,

        title:
          item?.title ||
          snippet?.title ||
          'YouTube Short',

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

        thumbnailUrl: thumbnail,

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
    })
    .filter(Boolean);

  // Remove duplicate videos
  const seen = new Set();

  const uniqueItems = items.filter((item) => {
    if (seen.has(item.videoId)) {
      return false;
    }

    seen.add(item.videoId);
    return true;
  });

  return {
    items: uniqueItems,

    nextPageToken:
      data?.nextPageToken || null,
  };
}
