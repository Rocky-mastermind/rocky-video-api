/**
 * @author Rocky
 * YouTube Video Search API
 * Route: /api/video/search?songName=<query>
 * Uses YouTube Data API v3
 */

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { songName } = req.query;
  if (!songName) {
    return res.status(400).json({ error: "Missing query param: songName" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "YOUTUBE_API_KEY not set in environment variables" });
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(songName)}&maxResults=10&type=video&key=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json();

    if (data.error) {
      return res.status(500).json({ error: "YouTube API error", details: data.error.message });
    }

    const results = data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: "Failed to search videos", details: err.message });
  }
};
