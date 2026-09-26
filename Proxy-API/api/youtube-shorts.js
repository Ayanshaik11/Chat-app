// Vercel serverless function — the real YouTube API key lives only here,
// as a Vercel Environment Variable, never inside the app itself.
module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing YOUTUBE_API_KEY. Add it in Vercel → Settings → Environment Variables.' });
    return;
  }

  const pageToken = req.query.pageToken || '';
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoDuration: 'short',
    q: '#shorts',
    maxResults: '10',
    key,
  });
  if (pageToken) params.set('pageToken', pageToken);

  try {
    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const data = await ytRes.json();
    if (!ytRes.ok) {
      res.status(ytRes.status).json({ error: data?.error?.message || 'YouTube request failed' });
      return;
    }
    res.status(200).json({ items: data.items || [], nextPageToken: data.nextPageToken || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
