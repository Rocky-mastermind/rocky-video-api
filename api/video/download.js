/**
 * @author Rocky
 * YouTube Video Download API
 * Uses yt-dlp-api (self-hosted style via public endpoints)
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

  try {
    // Use savefrom.net API - works from server side
    const result = await trySavefrom(videoId);
    if (result && result.downloadLink) {
      return res.status(200).json({ ...result, author: "Rocky" });
    }
  } catch (e) {
    console.error("savefrom failed:", e.message);
  }

  try {
    const result = await trySSYoutube(videoId);
    if (result && result.downloadLink) {
      return res.status(200).json({ ...result, author: "Rocky" });
    }
  } catch (e) {
    console.error("ssyoutube failed:", e.message);
  }

  try {
    const result = await tryInvidiousPublic(videoId);
    if (result && result.downloadLink) {
      return res.status(200).json({ ...result, author: "Rocky" });
    }
  } catch (e) {
    console.error("invidious failed:", e.message);
  }

  return res.status(500).json({
    error: "All download methods failed",
    videoId,
    tip: "Try updating the API or use a different video",
  });
};

// ── Method 1: SaveFrom ──────────────────────────────────────────────────────
async function trySavefrom(videoId) {
  const url = `https://worker.sf-tools.com/savefrom.php`;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10000);

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://en.savefrom.net",
      "Referer": "https://en.savefrom.net/",
    },
    body: `sf_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}&country=us`,
    signal: controller.signal,
  });

  const data = await r.json();
  if (!data || data.error) throw new Error("SaveFrom error");

  const links = data.url || [];
  const mp4Links = links
    .filter(l => l.ext === "mp4" && l.url)
    .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

  if (!mp4Links.length) throw new Error("No mp4 links");

  const best = mp4Links[0];
  return {
    title: data.meta?.title || "YouTube Video",
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    quality: best.quality + "p" || "360p",
    downloadLink: best.url,
    source: "savefrom",
  };
}

// ── Method 2: SSYoutube ─────────────────────────────────────────────────────
async function trySSYoutube(videoId) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10000);

  // Get video info first
  const infoRes = await fetch(
    `https://ssyoutube.com/api/convert?url=https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://ssyoutube.com/",
      },
      signal: controller.signal,
    }
  );

  const data = await infoRes.json();
  if (!data || !data.links) throw new Error("SSYoutube no links");

  const mp4 = (data.links["mp4"] || [])
    .filter(l => l.url)
    .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

  if (!mp4.length) throw new Error("No mp4");

  return {
    title: data.title || "YouTube Video",
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    quality: mp4[0].quality || "360p",
    downloadLink: mp4[0].url,
    source: "ssyoutube",
  };
}

// ── Method 3: Invidious public instances ───────────────────────────────────
async function tryInvidiousPublic(videoId) {
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.privacyredirect.com",
    "https://iv.datura.network",
    "https://invidious.nerdvpn.de",
    "https://yt.cdaut.de",
    "https://invidious.io.lol",
  ];

  for (const base of instances) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 7000);

      const r = await fetch(`${base}/api/v1/videos/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });

      if (!r.ok) continue;
      const data = await r.json();

      const streams = (data.formatStreams || [])
        .filter(f => f.container === "mp4")
        .sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));

      if (streams.length > 0) {
        return {
          title: data.title || "YouTube Video",
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          quality: streams[0].qualityLabel || "360p",
          downloadLink: streams[0].url,
          source: `invidious`,
        };
      }
    } catch (_) { continue; }
  }
  throw new Error("All Invidious failed");
}
