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
    // Use mp4 format instead of mp3
    const r = await fetch(
      `https://youtube-info-download-api.p.rapidapi.com/ajax/download.php?format=mp4&add_info=0&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}&audio_quality=128&allow_extended_duration=false&no_merge=false&audio_language=en`,
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

    // Extract download link from response
    let downloadLink = null;
    let title = "YouTube Video";
    let quality = "360p";

    if (data.url) {
      downloadLink = data.url;
    } else if (data.link) {
      downloadLink = data.link;
    } else if (data.content) {
      // Parse content field which may contain the URL
      const match = data.content.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/);
      if (match) downloadLink = match[0];
    } else if (data.progress_url) {
      // Some APIs return a progress URL to poll
      downloadLink = data.progress_url;
    }

    if (data.title) title = data.title;
    if (data.quality) quality = data.quality;

    if (!downloadLink) {
      // Try to get info endpoint instead
      const infoR = await fetch(
        `https://youtube-info-download-api.p.rapidapi.com/ajax/info.php?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}`,
        {
          headers: {
            "x-rapidapi-host": "youtube-info-download-api.p.rapidapi.com",
            "x-rapidapi-key": RAPIDAPI_KEY,
          },
        }
      );
      const infoData = await infoR.json();

      // Find mp4 format from info
      const formats = infoData.formats || infoData.links || [];
      const mp4Formats = Array.isArray(formats)
        ? formats.filter(f => (f.ext || f.format || "").includes("mp4") && f.url)
        : Object.entries(formats)
            .filter(([k]) => k.includes("mp4"))
            .map(([k, v]) => ({ quality: k, url: v }));

      if (mp4Formats.length > 0) {
        const best = mp4Formats[0];
        downloadLink = best.url;
        quality = best.quality || best.qualityLabel || "360p";
        title = infoData.title || title;
      }

      if (!downloadLink) {
        return res.status(500).json({
          error: "Could not find mp4 download link",
          debug: { downloadData: data, infoData },
        });
      }
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
