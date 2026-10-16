
/*
 * KING X — MUSIC API (Bollywood / Hindi)
 *
 * GET /api/music
 * GET /api/music?q=Arijit%20Singh
 *
 * Uses @saavn-labs/sdk for song metadata.
 * Does not extract or decrypt protected audio streams.
 */

const { Song } = require("@saavn-labs/sdk");

module.exports = async (req, res) => {
  const q =
    typeof req.query?.q === "string"
      ? req.query.q.trim().slice(0, 100)
      : "";

  const limitValue = Number.parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(limitValue, 1), 30)
    : 30;

  const offsetValue = Number.parseInt(req.query?.offset, 10);
  const offset = Number.isFinite(offsetValue)
    ? Math.max(offsetValue, 1)
    : 1;

  try {
    let result;

    if (q) {
      result = await Song.search({
        query: q,
        limit,
        offset,
      });
    } else {
      // Use a reliable default Bollywood search for the initial catalogue.
      result = await Song.search({
        query: "Bollywood Hindi hits",
        limit,
        offset,
      });
    }

    const items = (result.results || []).map((song) => {
      const artists = [
        ...(song.artists?.primary || []),
        ...(song.artists?.featured || []),
      ];

      const uniqueArtists = [
        ...new Map(
          artists
            .filter((artist) => artist?.name)
            .map((artist) => [artist.name, artist.name])
        ).values(),
      ];

      const artwork =
        (song.images || []).find(
          (image) => typeof image?.url === "string" && image.url
        )?.url || "";

      const duration = Number(song.duration);

      return {
        id: String(song.id),
        name: song.title || song.subtitle || "Unknown title",
        artist: uniqueArtists.join(", ") || "Unknown artist",
        image: artwork,
        duration: Number.isFinite(duration) ? duration : 0,
        language: song.language || "",
        year: song.year || "",
        album: song.album?.title || "",
        url:
          typeof song.url === "string" &&
          song.url.startsWith("https://")
            ? song.url
            : "",
        playback: {
          type: "external",
          streamUrl: null,
        },
      };
    });

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      success: true,
      provider: "saavn",
      query: q || "Bollywood Hindi hits",
      total: result.total ?? items.length,
      items,
    });
  } catch (error) {
    console.error("King X music API error:", error?.message || error);

    return res.status(502).json({
      success: false,
      error: "Music search failed",
      items: [],
    });
  }
};
