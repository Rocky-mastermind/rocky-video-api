/**
 * @author Rocky
 * YouTube Video Download API
 * Uses RapidAPI - YouTube MP4 Downloader
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
  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not set" });
  }

  // Try multiple RapidAPI YouTube download endpoints
  const apis = [
    () => tryYtStream(videoId, RAPIDAPI_KEY),
    () => tryYoutubeDownloader(videoId, RAPIDAPI_KEY),
    () => tryYtMp4(videoId, RAPIDAPI_KEY),
  ];

  for (const api of apis) {
    try {
      const result = await api();
      if (result && result.downloadLink) {
        return res.status(200).json({ ...result, author: "Rocky" });
      }
    } catch (e) {
      console.error("API failed:", e.message);
    }
  }

  return res.status(500).json({ error: "All download methods failed" });
};

// ── API 1: yt-stream ────────────────────────────────────────────────────────
async function tryYtStream(videoId, key) {
  const r = await fetch(
    `https://yt-stream.p.rapidapi.com/api/get?url=https://www.youtube.com/watch?v=${videoId}&quality=720&type=mp4`,
    {
      headers: {
        "x-rapidapi-host": "yt-stream.p.rapidapi.com",
        "x-rapidapi-key": key,
      },
    }
  );
  const data = await r.json();
  if (!data || !data.url) throw new Error("yt-stream failed");
  return {
    title: data.title || "YouTube Video",
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    quality: "720p",
    downloadLink: data.url,
    source: "yt-stream",
  };
}

// ── API 2: youtube-downloader10 ─────────────────────────────────────────────
async function tryYoutubeDownloader(videoId, key) {
  const r = await fetch(
    `https://youtube-downloader10.p.rapidapi.com/download?id=${videoId}`,
    {
      headers: {
        "x-rapidapi-host": "youtube-downloader10.p.rapidapi.com",
        "x-rapidapi-key": key,
      },
    }
  );
  const data = await r.json();
  if (!data || !data.link) throw new Error("youtube-downloader10 failed");
  return {
    title: data.title || "YouTube Video",
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    quality: data.quality || "720p",
    downloadLink: data.link,
    source: "youtube-downloader10",
  };
}

// ── API 3: ytmp3-youtube-mp3-and-mp4-downloader ─────────────────────────────
async function tryYtMp4(videoId, key) {
  const r = await fetch(
    `https://ytmp3-youtube-mp3-and-mp4-downloader.p.rapidapi.com/api/ytmp4.php?url=https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "x-rapidapi-host": "ytmp3-youtube-mp3-and-mp4-downloader.p.rapidapi.com",
        "x-rapidapi-key": key,
      },
    }
  );
  const data = await r.json();
  if (!data || !data.dlink) throw new Error("ytmp3 failed");
  return {
    title: data.title || "YouTube Video",
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    quality: "720p",
    downloadLink: data.dlink,
    source: "ytmp3",
  };
}
