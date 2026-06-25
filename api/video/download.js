/**
 * @author Rocky
 * YouTube Video Download API
 * Route: /api/video/download?link=<videoID>&format=mp4
 */

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { link } = req.query;

  if (!link) {
    return res.status(400).json({ error: "Missing query param: link (video ID or URL)" });
  }

  const videoId = link.startsWith("http")
    ? (link.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1]
    : link;

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube video ID or URL" });
  }

  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;

    if (!rapidApiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not set in environment variables" });
    }

    const response = await fetch(
      `https://youtube-video-and-shorts-downloader.p.rapidapi.com/download.php?id=${videoId}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "youtube-video-and-shorts-downloader.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );

    const data = await response.json();

    if (!data || data.error) {
      return res.status(500).json({ error: "Failed to fetch download links", details: data?.error || "Unknown error" });
    }

    const links = data.links || {};
    const mp4Links = [];

    for (const [quality, url] of Object.entries(links)) {
      if (typeof url === "string" && url.startsWith("http")) {
        mp4Links.push({ quality, url });
      }
    }

    const qualityOrder = ["1080p", "720p", "480p", "360p", "240p", "144p"];
    mp4Links.sort((a, b) => {
      const ai = qualityOrder.indexOf(a.quality);
      const bi = qualityOrder.indexOf(b.quality);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const best = mp4Links[0];

    if (!best) {
      return res.status(404).json({ error: "No download link found for this video" });
    }

    return res.status(200).json({
      title: data.title || "YouTube Video",
      videoId,
      thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      quality: best.quality,
      downloadLink: best.url,
      allQualities: mp4Links,
      author: "Rocky",
    });

  } catch (err) {
    console.error("Download error:", err.message);
    return res.status(500).json({ error: "Failed to process video", details: err.message });
  }
};
