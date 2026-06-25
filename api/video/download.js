/**
 * @author Rocky
 * YouTube Video Download API
 * Route: /api/video/download?link=<videoID>&format=mp4
 */

const ytdl = require("@distube/ytdl-core");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { link, format = "mp4" } = req.query;

  if (!link) {
    return res.status(400).json({ error: "Missing query param: link (video ID or URL)" });
  }

  const videoUrl = link.startsWith("http")
    ? link
    : `https://www.youtube.com/watch?v=${link}`;

  try {
    const info = await ytdl.getInfo(videoUrl);
    const title = info.videoDetails.title;
    const lengthSeconds = parseInt(info.videoDetails.lengthSeconds);

    // Pick best mp4 format with both video+audio
    let selectedFormat;

    if (format === "mp4") {
      // Try combined formats first (video + audio in one)
      const combinedFormats = ytdl.filterFormats(info.formats, "videoandaudio")
        .filter(f => f.container === "mp4")
        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

      if (combinedFormats.length > 0) {
        selectedFormat = combinedFormats[0];
      } else {
        // Fallback to any mp4 video format
        const videoFormats = info.formats
          .filter(f => f.container === "mp4" && f.hasVideo)
          .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
        selectedFormat = videoFormats[0];
      }
    } else {
      // Audio only (mp3 via webm)
      const audioFormats = ytdl.filterFormats(info.formats, "audioonly")
        .sort((a, b) => (parseInt(b.audioBitrate) || 0) - (parseInt(a.audioBitrate) || 0));
      selectedFormat = audioFormats[0];
    }

    if (!selectedFormat) {
      return res.status(404).json({ error: "No suitable format found" });
    }

    const quality = selectedFormat.qualityLabel || selectedFormat.audioBitrate + "kbps" || "unknown";

    return res.status(200).json({
      title,
      videoId: info.videoDetails.videoId,
      url: `https://www.youtube.com/watch?v=${info.videoDetails.videoId}`,
      thumbnail: info.videoDetails.thumbnails.slice(-1)[0]?.url || "",
      duration: lengthSeconds,
      quality,
      format: selectedFormat.container,
      downloadLink: selectedFormat.url,
      author: info.videoDetails.author.name,
    });

  } catch (err) {
    console.error("Download error:", err.message);
    return res.status(500).json({ error: "Failed to process video", details: err.message });
  }
};
