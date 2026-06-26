/**
 * @author Rocky Chowdhury
 * YouTube Video Download API
 */

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const { link } = req.query;
  if (!link) return res.status(400).json({ error: "Missing param: link" });

  const videoId = link.startsWith("http")
    ? (link.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1]
    : link;

  if (!videoId) return res.status(400).json({ error: "Invalid video ID" });

  const KEY = process.env.RAPIDAPI_KEY;
  if (!KEY) return res.status(500).json({ error: "RAPIDAPI_KEY not set" });

  // Try APIs one by one
  const tries = [
    () => tryYtMp4(videoId, KEY),
    () => tryYtApi(videoId, KEY),
    () => tryYtDownloader(videoId, KEY),
  ];

  for (const fn of tries) {
    try {
      const r = await fn();
      if (r?.downloadLink) return res.status(200).json({ ...r, author: "Rocky Chowdhury" });
    } catch (e) {
      console.error(e.message);
    }
  }

  return res.status(500).json({ error: "All download methods failed. Try subscribing APIs on RapidAPI." });
};

// API 1 — youtube-mp4 by Opachi (100% uptime, 545ms)
async function tryYtMp4(videoId, key) {
  const r = await fetch(
    `https://youtube-mp4.p.rapidapi.com/?id=${videoId}&quality=720`,
    { headers: { "x-rapidapi-host": "youtube-mp4.p.rapidapi.com", "x-rapidapi-key": key } }
  );
  const d = await r.json();
  if (!d?.url) throw new Error("youtube-mp4: " + JSON.stringify(d).slice(0,80));
  return { title: d.title || "YouTube Video", videoId, thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, quality: d.quality || "720p", downloadLink: d.url, source: "youtube-mp4" };
}

// API 2 — yt-api (fast)
async function tryYtApi(videoId, key) {
  const r = await fetch(
    `https://yt-api.p.rapidapi.com/dl?id=${videoId}`,
    { headers: { "x-rapidapi-host": "yt-api.p.rapidapi.com", "x-rapidapi-key": key } }
  );
  const d = await r.json();
  const formats = d?.adaptiveFormats || d?.formats || [];
  const mp4 = formats.filter(f => f.mimeType?.includes("video/mp4") && f.url).sort((a,b) => parseInt(b.bitrate||0) - parseInt(a.bitrate||0));
  if (!mp4.length) throw new Error("yt-api no mp4");
  return { title: d.title || "YouTube Video", videoId, thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, quality: mp4[0].qualityLabel || "720p", downloadLink: mp4[0].url, source: "yt-api" };
}

// API 3 — youtube-downloader10
async function tryYtDownloader(videoId, key) {
  const r = await fetch(
    `https://youtube-downloader10.p.rapidapi.com/download?id=${videoId}`,
    { headers: { "x-rapidapi-host": "youtube-downloader10.p.rapidapi.com", "x-rapidapi-key": key } }
  );
  const d = await r.json();
  if (!d?.link) throw new Error("downloader10: " + JSON.stringify(d).slice(0,80));
  return { title: d.title || "YouTube Video", videoId, thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, quality: d.quality || "720p", downloadLink: d.link, source: "youtube-downloader10" };
}
