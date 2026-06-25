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
  if (!link) return res.status(400).json({ error: "Missing param: link" });

  const videoId = link.startsWith("http")
    ? (link.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1]
    : link;

  if (!videoId) return res.status(400).json({ error: "Invalid video ID" });

  // Try all methods one by one
  const methods = [
    () => tryInvidious(videoId),
    () => tryCobalt(`https://www.youtube.com/watch?v=${videoId}`),
    () => tryY2Mate(videoId),
  ];

  for (const method of methods) {
    try {
      const result = await method();
      if (result && result.downloadLink) {
        return res.status(200).json({ ...result, author: "Rocky" });
      }
    } catch (e) {
      console.error("Method failed:", e.message);
    }
  }

  return res.status(500).json({ error: "All download methods failed" });
};

// ── Invidious (best - no bot check) ────────────────────────────────────────
async function tryInvidious(videoId) {
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.privacyredirect.com",
    "https://iv.datura.network",
    "https://invidious.nerdvpn.de",
    "https://yt.cdaut.de",
  ];

  for (const base of instances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const r = await fetch(`${base}/api/v1/videos/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!r.ok) continue;
      const data = await r.json();

      // Try formatStreams (combined video+audio)
      const streams = (data.formatStreams || [])
        .filter(f => f.container === "mp4")
        .sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));

      if (streams.length > 0) {
        const best = streams[0];
        return {
          title: data.title || "YouTube Video",
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          quality: best.qualityLabel || best.resolution || "360p",
          downloadLink: best.url,
          source: `invidious(${base})`,
        };
      }

      // Try adaptiveFormats (video only - fallback)
      const adaptive = (data.adaptiveFormats || [])
        .filter(f => f.container === "mp4" && f.type?.includes("video"))
        .sort((a, b) => parseInt(b.bitrate) - parseInt(a.bitrate));

      if (adaptive.length > 0) {
        const best = adaptive[0];
        return {
          title: data.title || "YouTube Video",
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          quality: best.qualityLabel || "720p",
          downloadLink: best.url,
          source: `invidious-adaptive(${base})`,
        };
      }
    } catch (e) {
      continue;
    }
  }
  throw new Error("All Invidious instances failed");
}

// ── Cobalt ──────────────────────────────────────────────────────────────────
async function tryCobalt(videoUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const r = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: videoUrl,
        videoQuality: "720",
        youtubeVideoCodec: "h264",
        filenameStyle: "basic",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await r.json();
    if (data.status === "error" || data.status === "tunnel" && !data.url) {
      throw new Error("Cobalt no URL");
    }

    const dlUrl = data.url || (data.picker && data.picker[0]?.url);
    if (!dlUrl) throw new Error("No cobalt URL");

    return {
      title: "YouTube Video",
      videoId: videoUrl.match(/v=([\w-]{11})/)?.[1] || "",
      thumbnail: "",
      quality: "720p",
      downloadLink: dlUrl,
      source: "cobalt",
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ── Y2Mate ──────────────────────────────────────────────────────────────────
async function tryY2Mate(videoId) {
  const analyzeRes = await fetch("https://www.y2mate.com/mates/analyzeV2/ajax", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: new URLSearchParams({
      k_query: `https://www.youtube.com/watch?v=${videoId}`,
      k_page: "home",
      hl: "en",
      q_auto: "0",
    }),
  });

  const analyzeData = await analyzeRes.json();
  if (!analyzeData || analyzeData.status !== "ok") throw new Error("Y2Mate analyse failed");

  const links = analyzeData.links?.mp4 || {};
  const qualityOrder = ["720p", "480p", "360p", "240p", "144p", "1080p"];
  let bestKey = null, bestQuality = null;

  for (const q of qualityOrder) {
    const found = Object.values(links).find(v => v.q === q && v.f === "mp4");
    if (found) { bestKey = found.k; bestQuality = q; break; }
  }

  if (!bestKey) throw new Error("No mp4 found in Y2Mate");

  const convertRes = await fetch("https://www.y2mate.com/mates/convertV2/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: new URLSearchParams({ vid: videoId, k: bestKey }),
  });

  const convertData = await convertRes.json();
  if (!convertData || convertData.status !== "ok") throw new Error("Y2Mate convert failed");

  return {
    title: analyzeData.title || "YouTube Video",
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    quality: bestQuality,
    downloadLink: convertData.dlink,
    source: "y2mate",
  };
}
