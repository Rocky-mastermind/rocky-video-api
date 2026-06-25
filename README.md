# 🎬 Rocky Video API

YouTube Video Search & Download API — by **Rocky**

---

## 📡 Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api` | API status & info |
| GET | `/api/video/search?songName=<query>` | Search YouTube videos |
| GET | `/api/video/download?link=<videoID>&format=mp4` | Get download link |

### Example Requests

```
GET /api/video/search?songName=lofi+hip+hop
GET /api/video/download?link=JGwWNGJdvx8&format=mp4
```

---

## 🚀 Deploy on Vercel (Step by Step)

### Step 1 — Upload to GitHub

1. Go to [github.com](https://github.com) → **New Repository**
2. Name it: `rocky-video-api`
3. Set to **Public**
4. Click **Create Repository**
5. Upload all these project files

### Step 2 — Get YouTube API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Go to **Credentials** → **Create API Key**
5. Copy the key

### Step 3 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo `rocky-video-api`
3. Go to **Environment Variables** and add:
   - Key: `YOUTUBE_API_KEY`
   - Value: your YouTube API key
4. Click **Deploy**

### Step 4 — Use in Your Bot

Replace the old `baseApiUrl` with your Vercel URL:

```js
const apiUrl = "https://your-project.vercel.app";

// Search
const searchRes = await axios.get(`${apiUrl}/api/video/search?songName=${encodeURIComponent(keyWord)}`);

// Download
const res = await axios.get(`${apiUrl}/api/video/download?link=${videoID}&format=mp4`);
```

---

## 🤖 Updated Bot Command (video.js)

The bot command works exactly the same as before — just update the `apiUrl` to point to your new Vercel deployment.

---

**Author:** Rocky  
**Version:** 1.0.0
