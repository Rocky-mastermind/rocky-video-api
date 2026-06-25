/**
 * @author Rocky
 * YouTube Video Download API
 * Route: /api/video/download?link=<videoID>&format=mp4
 * No API key needed - uses free public endpoints
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

  if (!videoId || videoId.length !== 11) {
    return res.status(400).json({ error: "Invalid YouTube video ID" });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Try multiple free download services in order
  const strategies = [
    () => tryY2Mate(videoId),
    () => tryInvidious(videoId),
    () => tryCobalt(videoUrl),
  ];

  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result && result.downloadLink) {
        return res.status(200).json({ ...result, author: "Rocky" });
      }
    } catch (e) {
      // try next
    }
  }

  return res.status(500).json({ error: "All download methods failed. Try again later." });
};

// ── Strategy 1: Y2Mate ──────────────────────────────────────────────────────
async function tryY2Mate(videoId) {
  // Step 1: analyse
  const analyzeRes = await fetch("https://www.y2mate.com/mates/analyzeV2/ajax", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      k_query: `https://www.youtube.com/watch?v=${videoId}`,
      k_page: "home",
      hl: "en",
      q_auto: "0",
    }),
  });

  const analyzeData = await analyzeRes.json();
  if (!analyzeData || analyzeData.status !== "ok") throw new Error("Y2Mate analyse failed");

  const title = analyzeData.title;
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // Pick best mp4 quality key
  const links = analyzeData.links?.mp4 || {};
  const qualityOrder = ["1080p", "720p", "480p", "360p", "240p", "144p"];
  let bestKey = null;
  let bestQuality = null;

  for (const q of qualityOrder) {
    const found = Object.values(links).find(
      (v) => v.q === q && v.f === "mp4"
    );
    if (found) {
      bestKey = found.k;
      bestQuality = q;
      break;
    }
  }

  if (!bestKey) throw new Error("No mp4 quality found");

  // Step 2: convert
  const convertRes = await fetch("https://www.y2mate.com/mates/convertV2/index", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      vid: videoId,
      k: bestKey,
    }),
  });

  const convertData = await convertRes.json();
  if (!convertData || convertData.status !== "ok") throw new Error("Y2Mate convert failed");

  return {
    title,
    videoId,
    thumbnail,
    quality: bestQuality,
    downloadLink: convertData.dlink,
    source: "y2mate",
  };
}

// ── Strategy 2: Invidious (open source YouTube frontend) ───────────────────
async function tryInvidious() {
  // Public Invidious instances — pick a working one
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.privacyredirect.com",
  ];

  for (const base of instances) {
    try {
      const r = await fetch(`${base}/api/v1/videos/${arguments[0]}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });

      if (!r.ok) continue;
      const data = await r.json();

      const formats = (data.formatStreams || [])
        .filter((f) => f.container === "mp4")
        .sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));

      if (!formats.length) continue;
      const best = formats[0];

      return {
        title: data.title,
        videoId: data.videoId,
        thumbnail: `https://img.youtube.com/vi/${data.videoId}/hqdefault.jpg`,
        quality: best.qualityLabel || best.resolution,
        downloadLink: best.url,
        source: "invidious",
      };
    } catch (_) {
      // try next instance
    }
  }
  throw new Error("All Invidious instances failed");
}

// ── Strategy 3: Cobalt ─────────────────────────────────────────────────────
async function tryCobalt(videoUrl) {
  const r = await fetch("https://api.cobalt.tools/api/json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      url: videoUrl,
      vCodec: "h264",
      vQuality: "720",
      aFormat: "mp3",
      isAudioOnly: false,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await r.json();
  if (!data || data.status === "error") throw new Error("Cobalt failed");

  const downloadLink = data.url || (data.picker && data.picker[0]?.url);
  if (!downloadLink) throw new Error("No cobalt URL");

  return {
    title: "YouTube Video",
    videoId: videoUrl.match(/v=([\w-]{11})/)?.[1] || "",
    thumbnail: "",
    quality: "720p",
    downloadLink,
    source: "cobalt",
  };
}
