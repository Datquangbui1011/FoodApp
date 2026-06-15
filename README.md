# Foody

Paste a TikTok, YouTube Short, or Instagram video of a restaurant — Foody identifies the restaurant using AI, geocodes it, and pins it on an interactive map.

**Live app:** https://foody-4zs7zt2yg-datquangbui1011s-projects.vercel.app

---

## How it works

```
Video URL (TikTok / YouTube / Instagram)
        ↓
   yt-dlp download
        ↓
   ffmpeg → frames + audio
        ↓
   EasyOCR (local) → text from frames
   Groq Whisper     → transcript from audio
        ↓
   Groq LLaMA 3.3 70B → restaurant name + city
        ↓
   Nominatim (OpenStreetMap) → geocode → lat/lng
        ↓
   Pin on Google Maps
```

Videos with multiple restaurants (e.g. "Top 3 coffee shops") return all locations as separate pins.

---

## Project structure

```
FoodApp/
├── web-app/              # Next.js 15 frontend (deployed on Vercel)
├── processing-server/    # Express.js pipeline (deployed on Google Cloud Run)
├── marketing/            # Marketing landing page (Next.js, on Vercel)
├── supabase/             # DB migrations (PostgreSQL via Supabase)
└── foody-intro/          # Remotion video intro animation
```

---

## Tech stack

### Frontend (`web-app`)
| | |
|---|---|
| Framework | Next.js 15 / React 19 |
| Map | `@vis.gl/react-google-maps` (Google Maps) |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |

### Backend (`processing-server`)
| | |
|---|---|
| Runtime | Node.js + Express + TypeScript |
| Video download | yt-dlp |
| Frame/audio extraction | ffmpeg |
| OCR | EasyOCR (local Python, zero API cost) |
| Transcription | Groq Whisper (`whisper-large-v3-turbo`) |
| Restaurant inference | Groq LLaMA 3.3 70B (`llama-3.3-70b-versatile`) |
| Geocoding | Nominatim (OpenStreetMap, free) |
| Deployment | Google Cloud Run (Docker) |

---

## Local development

### Prerequisites
- Node.js 20+
- Python 3 + `pip install easyocr`
- ffmpeg (`brew install ffmpeg`)
- yt-dlp (`brew install yt-dlp`)
- Supabase CLI

### 1. Frontend

```bash
cd web-app
cp .env.local.example .env.local   # fill in keys
npm install
npm run dev                        # http://localhost:3000
```

**Required env vars (`web-app/.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
GOOGLE_CSE_ID=
PROCESSING_SERVER_URL=http://localhost:3001
PROCESSING_SERVER_API_KEY=
```

### 2. Processing server

```bash
cd processing-server
cp .env.example .env   # fill in keys
npm install
npm run dev            # http://localhost:3001
```

**Required env vars (`processing-server/.env`):**
```
PORT=3001
API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
FOURSQUARE_API_KEY=
```

### 3. Database

```bash
supabase login
supabase db push
```

---

## Deployment

### Frontend → Vercel
```bash
cd web-app
vercel --prod
```

Set all `web-app/.env.local` keys as Vercel environment variables, with `PROCESSING_SERVER_URL` pointing to the Cloud Run URL.

### Backend → Google Cloud Run

The backend ships as a Docker container. Build and deploy automatically triggers on every push to `main` via Cloud Build.

**Dockerfile location:** `processing-server/Dockerfile`

The image installs ffmpeg, yt-dlp, Python, and EasyOCR (with model pre-baked) so there's no runtime download on cold start.

**Cloud Run settings:**
- Memory: 2 GiB (PyTorch requires it)
- Timeout: 300 seconds
- Min instances: 0 (scales to zero when idle)
- Authentication: public

**Required Cloud Run env vars:**
```
API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
FOURSQUARE_API_KEY=
```

---

## API

### `POST /api/process` (Next.js → processing server)

**Request:**
```json
{ "url": "https://www.tiktok.com/@user/video/123" }
```

**Response:**
```json
{
  "status": "success",
  "places": [
    {
      "name": "Mr. West Cafe",
      "address": "2685 NE Village Lane, Seattle, WA",
      "lat": 47.662,
      "lng": -122.298,
      "placeId": "2462325442",
      "types": ["cafe"]
    }
  ],
  "allPlaces": [ ... ],
  "inference": { ... }
}
```

### `GET /health`
Returns `{ "status": "ok" }` — used to verify the server is running.

---

## Supported video platforms
- TikTok
- YouTube Shorts
- Instagram Reels

---

## Key design decisions

**EasyOCR over cloud vision APIs** — Restaurant names appear as text overlays in food videos. Running EasyOCR locally costs $0 regardless of usage, vs ~50k tokens per video with Groq vision (which hits daily quota limits fast).

**Nominatim over Google Places** — Geocoding is free with OpenStreetMap. Google Places is used only for supplementary data.

**React StrictMode compatibility** — The frontend uses a `consumeSession()` helper with a 3-second module-scope cache to safely read sessionStorage under StrictMode's double-mount behavior.
