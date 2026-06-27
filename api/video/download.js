/**
 * @author Rocky Chowdhury
 * YouTube Video Download - Direct scrape approach
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

  // Try methods in order
  const methods = [
    () => tryNoEmbed(videoId),
    () => tryInvidiousList(videoId),
    () => tryPipedAPI(videoId),
  ];

  for (const fn of methods) {
    try {
      const r = await fn();
      if (r?.downloadLink) {
        return res.status(200).json({ ...r, author: "Rocky Chowdhury" });
      }
    } catch (e) {
      console.error("Method failed:", e.message);
    }
  }

  return res.status(500).json({ error: "Download failed. Please try again later." });
};

// ── Method 1: noembed for title + Invidious for stream ─────────────────────
async function tryNoEmbed(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Get title from noembed (very reliable)
  let title = "YouTube Video";
  try {
    const ne = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
    const nd = await ne.json();
    if (nd?.title) title = nd.title;
  } catch (_) {}

  // Try multiple invidious instances for stream URL
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.privacyredirect.com",
    "https://iv.datura.network",
    "https://invidious.nerdvpn.de",
    "https://yt.cdaut.de",
    "https://invidious.io.lol",
    "https://vid.puffyan.us",
    "https://invidious.projectsegfau.lt",
  ];

  for (const base of instances) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(`${base}/api/v1/videos/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!r.ok) continue;
      const d = await r.json();

      // Get formatStreams (video+audio combined)
      const streams = (d.formatStreams || [])
        .filter(f => f.container === "mp4")
        .sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));

      if (streams.length > 0) {
        const best = streams[0];
        return {
          title: d.title || title,
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          quality: best.qualityLabel || best.resolution || "360p",
          downloadLink: best.url,
          source: base.replace("https://", ""),
        };
      }
    } catch (_) { continue; }
  }
  throw new Error("Invidious all failed");
}

// ── Method 2: Piped API ─────────────────────────────────────────────────────
async function tryPipedAPI(videoId) {
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.syncpundit.io",
    "https://pipedapi.moomoo.me",
  ];

  for (const base of pipedInstances) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${base}/streams/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: ctrl.signal,
      });
      if (!r.ok) continue;
      const d = await r.json();

      const streams = (d.videoStreams || [])
        .filter(s => s.mimeType?.includes("video/mp4") && !s.videoOnly && s.url)
        .sort((a, b) => (b.quality || 0) - (a.quality || 0));

      if (streams.length > 0) {
        return {
          title: d.title || "YouTube Video",
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          quality: streams[0].qualityLabel || "360p",
          downloadLink: streams[0].url,
          source: "piped",
        };
      }
    } catch (_) { continue; }
  }
  throw new Error("Piped all failed");
}

// ── Method 3: Invidious list (redundant but different instances) ────────────
async function tryInvidiousList(videoId) {
  const instances = [
    "https://invidious.lunar.icu",
    "https://invidious.sethforprivacy.com",
    "https://invidious.tiekoetter.com",
    "https://invidious.slipfox.xyz",
    "https://invidious.weblibre.org",
  ];

  for (const base of instances) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(`${base}/api/v1/videos/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: ctrl.signal,
      });
      if (!r.ok) continue;
      const d = await r.json();
      const streams = (d.formatStreams || [])
        .filter(f => f.container === "mp4")
        .sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));
      if (streams.length > 0) {
        return {
          title: d.title || "YouTube Video",
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          quality: streams[0].qualityLabel || "360p",
          downloadLink: streams[0].url,
          source: base.replace("https://", ""),
        };
      }
    } catch (_) { continue; }
  }
  throw new Error("All failed");
}
