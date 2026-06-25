/**
 * @author Rocky
 * YouTube Video Download API
 * Uses: youtube-info-download-api.p.rapidapi.com
 */

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { link } = req.query;
  if (!link) return res.status(400).json({ error: "Missing param: link" });

  const videoId = link.startsWith("http")
    ? (link.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1]
    : link;

  if (!videoId) return res.status(400).json({ error: "Invalid video ID" });

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) return res.status(500).json({ error: "RAPIDAPI_KEY not set" });

  try {
    const r = await fetch(
      `https://youtube-info-download-api.p.rapidapi.com/ajax/download.php?format=mp3&add_info=0&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}&audio_quality=128&allow_extended_duration=false&no_merge=false&audio_language=en`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "youtube-info-download-api.p.rapidapi.com",
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
      }
    );

    const data = await r.json();
    console.log("API response:", JSON.stringify(data).slice(0, 300));

    if (!data) throw new Error("No response");

    // Find best mp4 link
    let downloadLink = null;
    let title = "YouTube Video";
    let quality = "720p";

    if (data.link) {
      downloadLink = data.link;
    } else if (data.url) {
      downloadLink = data.url;
    } else if (data.links) {
      const mp4 = Object.entries(data.links)
        .filter(([k, v]) => typeof v === "string" && v.includes("http"))
        .map(([k, v]) => ({ quality: k, url: v }));
      if (mp4.length > 0) {
        downloadLink = mp4[0].url;
        quality = mp4[0].quality;
      }
    } else if (Array.isArray(data)) {
      const mp4 = data.find(d => d.ext === "mp4" || d.format?.includes("mp4"));
      if (mp4) downloadLink = mp4.url || mp4.link;
    }

    if (data.title) title = data.title;
    if (data.quality) quality = data.quality;

    if (!downloadLink) {
      return res.status(500).json({ 
        error: "No download link in response",
        raw: data 
      });
    }

    return res.status(200).json({
      title,
      videoId,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      quality,
      downloadLink,
      author: "Rocky",
    });

  } catch (err) {
    console.error("Download error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
