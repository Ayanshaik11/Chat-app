// src/services/youtube.js

const API_URL =
  'https://chat-app-api-ten-alpha.vercel.app/api/youtube-shorts';

/**
 * Fetch YouTube Shorts through our Vercel proxy.
 *
 * The YouTube API key stays on Vercel.
 * The React Native app never receives the API key.
 */
export async function fetchShorts(pageToken = null) {
  try {
    const url = new URL(API_URL);

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    // Get response text first so we can show useful errors
    // even if Vercel returns HTML instead of JSON.
    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Vercel returned invalid JSON (${response.status}).`
      );
    }

    // Handle HTTP errors returned by Vercel/API.
    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        `YouTube proxy error: ${response.status}`
      );
    }

    // YouTube/Vercel may return an API-level error inside a 200 response.
    if (data?.error) {
      const message =
        typeof data.error === 'string'
          ? data.error
          : data.error.message || 'YouTube API error';

      throw new Error(message);
    }

    /*
     * Support several possible response formats:
     *
     * 1. {
     *      items: [...]
     *      nextPageToken: "..."
     *    }
     *
     * 2. {
     *      videos: [...]
     *      nextPageToken: "..."
     *    }
     *
     * 3. Raw YouTube API response:
     *      {
     *        items: [...]
     *      }
     */
    const rawItems =
      Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.videos)
          ? data.videos
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
              ? data
              : [];

    const nextPageToken =
      data?.nextPageToken ||
      data?.next_page_token ||
      null;

    /*
     * Convert everything into the format expected by ReelsScreen.
     */
    const items = rawItems
      .map((item, index) => {
        // YouTube API format:
        // item.id.videoId
        //
        // Other possible formats:
        // item.videoId
        // item.id
        const videoId =
          item?.videoId ||
          item?.id?.videoId ||
          (typeof item?.id === 'string' ? item.id : null);

        if (!videoId) {
          return null;
        }

        const snippet = item?.snippet || {};

        const title =
          item?.title ||
          snippet?.title ||
          'YouTube Short';

        const description =
          item?.description ||
          snippet?.description ||
          '';

        const thumbnail =
          item?.thumbnail ||
          item?.thumbnailUrl ||
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.medium?.url ||
          snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        const authorName =
          item?.authorName ||
          item?.channelTitle ||
          snippet?.channelTitle ||
          'YouTube';

        const youtubeUrl =
          item?.youtubeUrl ||
          item?.url ||
          `https://www.youtube.com/shorts/${videoId}`;

        return {
          // Important: ReelsScreen uses this as FlatList key.
          id: `youtube-${videoId}-${index}`,

          // Used by react-native-youtube-iframe.
          videoId,

          // Used by the external reel UI.
          isExternal: true,

          title,
          caption: description,
          description,

          thumbnail,
          thumbnailUrl: thumbnail,

          authorName,
          channelTitle: authorName,

          youtubeUrl,

          // External YouTube reels don't use Firebase likes/comments.
          likes: [],
        };
      })
      .filter(Boolean);

    if (!items.length) {
      console.warn(
        'YouTube proxy returned no usable videos:',
        data
      );
    }

    return {
      items,
      nextPageToken,
    };
  } catch (error) {
    console.error('fetchShorts failed:', error);

    // Make sure ReelsScreen gets a normal Error object.
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Could not load YouTube Shorts.');
  }
}