/**
 * @author Rocky
 * YouTube Video Search API
 * Route: /api/video/search?songName=<query>
 */

const { google } = require("googleapis");

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

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

  try {
    const searchResponse = await youtube.search.list({
      part: ["snippet"],
      q: songName,
      maxResults: 10,
      type: ["video"],
    });

    const results = searchResponse.data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    return res.status(200).json(results);
  } catch (err) {
    console.error("Search error:", err.message);
    return res.status(500).json({ error: "Failed to search videos", details: err.message });
  }
};
