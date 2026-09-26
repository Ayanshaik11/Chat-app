/*
 * =========================================================
 * KING X — YOUTUBE SERVICE
 * =========================================================
 */

import {
  PROXY_API_URL,
} from '../config/proxy';


const API_URL =
  `${PROXY_API_URL}/api/youtube-shorts`;


/* =========================================================
   FETCH YOUTUBE SHORTS
========================================================= */

export async function fetchShorts(
  pageToken = null
) {
  const url =
    new URL(API_URL);


  if (pageToken) {
    url.searchParams.set(
      'pageToken',
      pageToken
    );
  }


  const response =
    await fetch(
      url.toString()
    );


  let data;

  try {

    data =
      await response.json();

  } catch (e) {

    throw new Error(
      'Invalid response from YouTube server.'
    );

  }


  if (!response.ok) {

    throw new Error(
      data?.error ||
      data?.message ||
      'YouTube request failed.'
    );

  }


  /*
   * Support both the current proxy
   * and older response formats.
   */

  const rawItems =
    Array.isArray(data)
      ? data
      : (
          data?.items ||
          data?.videos ||
          data?.results ||
          []
        );


  const items =
    rawItems
      .map(
        (item, index) => {

          /*
           * Get YouTube video ID.
           */

          const videoId =
            item?.videoId ||
            item?.id?.videoId ||
            (
              typeof item?.id === 'string'
                ? item.id
                : null
            );


          if (!videoId) {
            return null;
          }


          const snippet =
            item?.snippet ||
            item;


          /*
           * Thumbnail fallback.
           */

          const thumbnail =
            item?.thumbnail ||
            item?.thumbnailUrl ||
            snippet?.thumbnails?.maxres?.url ||
            snippet?.thumbnails?.high?.url ||
            snippet?.thumbnails?.medium?.url ||
            snippet?.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;


          /*
           * Return the format expected
           * by ReelsScreen.
           */

          return {

            id:
              `youtube-${videoId}-${index}`,

            videoId,

            isExternal:
              true,


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
   * Remove duplicate YouTube videos.
   */

  const unique = [];

  const seen =
    new Set();


  for (const item of items) {

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


    unique.push(
      item
    );

  }


  return {

    items:
      unique,

    nextPageToken:
      data?.nextPageToken ||
      null,

  };
}
