/*
 * KING X — MUSIC PROXY (Jamendo)
 *
 * The Jamendo client id lives ONLY in Vercel Environment Variables
 * (JAMENDO_CLIENT_ID), so it is never inside the app.
 *
 * /api/music            -> trending tracks
 * /api/music?q=arijit   -> search
 */

module.exports = async (req, res) => {
  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'Server is missing JAMENDO_CLIENT_ID. Add it in Vercel → Settings → Environment Variables.' });
  }

  const q = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, 60) : '';

  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '30',
    audioformat: 'mp32',
    imagesize: '200',
  });

  if (q) params.set('search', q);
  else params.set('order', 'popularity_week');

  try {
    const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || data?.headers?.status === 'failed') {
      return res.status(502).json({ error: data?.headers?.error_message || 'Music search failed' });
    }

    const items = (data.results || [])
      .filter((t) => t.audio)
      .map((t) => ({
        id: String(t.id),
        name: t.name || 'Untitled',
        artist: t.artist_name || 'Unknown artist',
        image: t.image || t.album_image || '',
        url: t.audio,
        duration: t.duration || 0,
        ccurl: t.license_ccurl || '',
      }));

    // same search again within 5 minutes = no extra Jamendo request
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Music proxy error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to load music' });
  }
};
