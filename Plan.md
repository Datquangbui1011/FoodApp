# FoodMap AI — Webapp Build Plan

> AI-powered app that converts TikTok, Instagram, and Facebook food videos into real restaurant discoveries on a map.

---

## Stack Overview

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + TypeScript |
| Backend API | Next.js API routes |
| Processing server | Node.js on Railway / Hetzner VPS |
| Database + Auth | Supabase (Postgres + Auth + Storage) |
| AI | OpenAI Whisper + GPT-4o Vision |
| Maps | Google Maps JS SDK |
| Places | Google Places API |
| Video download | yt-dlp + FFmpeg |
| Hosting | Vercel (frontend), Railway (processing server) |

---

## Timeline Summary

| Phase | Focus | Duration |
|---|---|---|
| 1 | AI pipeline + processing server | Weeks 1–3 |
| 2 | Core web UI (no auth) | Weeks 4–6 |
| 3 | Auth + user features | Weeks 7–9 |
| 4 | Discovery features | Weeks 10–13 |
| 5 | Social + scale | Weeks 14+ |

---

## Phase 1 — AI Pipeline + Processing Server

> Goal: get the full extraction pipeline returning clean JSON from a video URL. Don't touch the frontend until this works reliably on 30+ real videos.

### 1.1 Processing server setup

**Feature: VPS provisioning**
- Set up Node.js server on Railway or Hetzner
- Expose a `POST /process` endpoint that accepts a video URL
- Tasks:
  - Install yt-dlp, FFmpeg, Node.js on server
  - Basic Express API with `/process` route
  - Health check endpoint at `/health`
  - Env-based API key auth to protect the route

**Feature: Video downloader**
- Use yt-dlp to download TikTok, Instagram Reels, Facebook video to a temp directory
- Handle failures gracefully with structured error responses
- Tasks:
  - yt-dlp shell exec wrapper in Node
  - Support TikTok, IG, FB URL formats
  - Temp file cleanup after processing
  - Error handling for private/deleted videos
  - Return failure reason as structured JSON: `{ error: 'private_video' | 'unsupported_url' | 'download_failed' }`

**Feature: Frame extraction**
- Use FFmpeg to extract frames every 1–2 seconds
- Return array of base64-encoded frame images for AI analysis
- Tasks:
  - FFmpeg frame extraction command
  - Limit to max 20 frames to control AI cost
  - Resize frames to 512px before encoding
  - Output: `[{ timestamp: number, base64: string }]`

**Feature: Audio extraction**
- Extract MP3 audio track from video using FFmpeg for speech-to-text
- Tasks:
  - FFmpeg audio strip command
  - Output 16kHz mono MP3 (optimal for Whisper)
  - Save to temp file, delete after transcription

---

### 1.2 AI extraction

**Feature: Speech-to-text (Whisper)**
- Send extracted audio to OpenAI Whisper API
- Get full transcript with timestamps
- Tasks:
  - Call `whisper-1` model via OpenAI SDK
  - Store transcript text in job result
  - Handle long audio (>25MB): chunk + stitch segments

**Feature: Visual OCR + context (GPT-4o Vision)**
- Send sampled frames to GPT-4o Vision with a structured prompt
- Extract restaurant name, menu items, location hints, and visual context
- Tasks:
  - Prompt: extract name, city, street, menu items, cuisine type
  - Send 5–8 key frames (not all 20) to control cost
  - Return structured JSON: `{ name, city, menuItems[], cuisineType, confidence }`
  - Test and tune prompt on 20+ real TikTok food videos before moving on

**Feature: Restaurant inference engine**
- Merge transcript + vision outputs into a single best-guess
- Score confidence, output top 1–3 candidates
- Tasks:
  - Combine OCR name + transcript mentions
  - Resolve conflicts between sources
  - Confidence scoring: exact name match = high, generic mention = low
  - Output: `{ candidates: [{ name, city, confidence }], topPick }`

---

### 1.3 Places resolution

**Feature: Google Places lookup**
- Take the inferred restaurant name + city and query Google Places Text Search
- Return full business details
- Tasks:
  - Google Places Text Search API call
  - Parse: name, address, lat/lng, placeId, rating, hours, photos
  - Cache results in SQLite to avoid repeat API calls
  - Handle zero results gracefully

**Feature: Multi-candidate resolution**
- When confidence is low, return top 3 Google Places candidates instead of one
- Tasks:
  - If `confidence < 0.6`: return top 3 Places results
  - Rank by string similarity to inferred name
  - Response schema: `{ type: 'single' | 'multi', results: [] }`

**Feature: End-to-end job test (CLI)**
- Run the full pipeline on 30+ real food videos. Measure accuracy before touching frontend.
- Tasks:
  - Build CLI test runner: `node test.js <url>`
  - Log: input URL → inferred name → Places result → correct? (y/n)
  - Target: >70% correct top-1 result before moving to Phase 2
  - Document failure patterns to improve the AI prompt

---

## Phase 2 — Core Web UI (No Auth)

> Goal: a single-page web app where anyone can paste a URL and see a restaurant on a map. No login required.

**Stack additions:** Next.js 14 App Router, Tailwind CSS, Google Maps JS SDK, Vercel

### 2.1 Project setup

**Feature: Next.js project scaffold**
- Tasks:
  - `npx create-next-app` with TypeScript + Tailwind
  - Set `PROCESSING_SERVER_URL` in `.env`
  - Vercel project + auto-deploy from `main` branch
  - Basic layout: nav + main content area

---

### 2.2 URL input + processing flow

**Feature: URL input form**
- Single prominent input on the homepage
- Accepts TikTok, IG, FB URLs with basic validation before submit
- Tasks:
  - Validate URL format client-side (regex)
  - Detect platform from URL (`tiktok.com` / `instagram.com` / `facebook.com`)
  - Show platform icon next to input
  - Disable submit if invalid URL

**Feature: Processing state UI**
- Show live step-by-step progress while the server processes the video
- Tasks:
  - Steps: Downloading → Extracting frames → Transcribing → Analyzing → Finding location
  - Poll `/api/job/:id` every 2s for status
  - Animated step indicators (pending / active / done)
  - Show estimated time remaining

**Feature: Error states**
- Handle all failure modes with clear messaging and retry options
- Tasks:
  - Private/deleted video error
  - URL not supported error
  - AI couldn't identify restaurant error
  - Network timeout error
  - Each error has a distinct message + retry CTA

---

### 2.3 Results display

**Feature: Interactive map**
- Google Maps embed with a pin at the detected restaurant
- Tasks:
  - `@googlemaps/js-api-loader` in Next.js
  - Drop pin at lat/lng from Places result
  - Custom pin icon styled to match app
  - Click pin: show name + address tooltip
  - "Open in Google Maps" external link

**Feature: Restaurant card**
- Card showing full restaurant details pulled from Google Places
- Tasks:
  - Name, cuisine type, address
  - Rating (stars) + review count
  - Opening hours with open now / closed indicator
  - Phone + website links
  - Google Places photos carousel (3–5 photos)
  - AI confidence badge (e.g. "92% confident")

**Feature: Multi-candidate picker**
- When AI returns low-confidence results, show 3 candidates for user to choose
- Tasks:
  - Show 3 cards side by side with name + address
  - "This is it" button on each card
  - On select: load full restaurant card + map pin
  - Track which candidate users most often pick (for future ML improvement)

**Feature: Popular dishes section**
- Show AI-extracted menu items from the video as tags
- Tasks:
  - Parse `menuItems[]` from AI response
  - Render as pill tags: "Pho Bo", "Spring Rolls"
  - Empty state if no items detected

---

## Phase 3 — Auth + User Features

> Goal: users can create accounts, save restaurants, and revisit their history.

**Stack additions:** Supabase Auth, Supabase Postgres, Supabase Storage

### 3.1 Authentication

**Feature: Google OAuth login**
- Tasks:
  - Supabase project setup + env keys in Vercel
  - `next-supabase-ssr` package for cookie-based sessions
  - Google OAuth provider configured in Supabase dashboard
  - Login modal / dedicated page
  - Redirect after login back to previous URL

**Feature: Email + password login**
- Tasks:
  - Signup form: email, password, username
  - Email confirmation flow
  - Password reset via email link
  - Show user avatar/initials in nav when logged in

---

### 3.2 Database schema

**Feature: Core tables**

```sql
-- Users (extends Supabase auth.users)
users (
  id uuid primary key references auth.users,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
)

-- Videos
videos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  platform text, -- 'tiktok' | 'instagram' | 'facebook'
  status text,   -- 'pending' | 'processing' | 'done' | 'failed'
  created_at timestamptz default now()
)

-- Restaurants
restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat float,
  lng float,
  google_place_id text unique,
  cuisine_type text,
  rating float,
  phone text,
  website text,
  created_at timestamptz default now()
)

-- Video results
video_results (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos,
  restaurant_id uuid references restaurants,
  confidence_score float,
  menu_items text[],
  created_at timestamptz default now()
)

-- Saved restaurants
saved_restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users,
  restaurant_id uuid references restaurants,
  note text,
  saved_at timestamptz default now(),
  unique(user_id, restaurant_id)
)

-- Search history
search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users,
  video_id uuid references videos,
  viewed_at timestamptz default now()
)
```

- Tasks:
  - Run migrations via Supabase CLI
  - Row-level security (RLS) policies on all user-scoped tables
  - Enable PostGIS extension for geo queries (needed in Phase 4)

---

### 3.3 User features

**Feature: Save restaurant**
- Logged-in users can bookmark any restaurant result
- Tasks:
  - Heart button on restaurant card (optimistic UI toggle)
  - `POST /api/saved` → insert to `saved_restaurants`
  - Unauthenticated: show login prompt modal
  - Visual toggle: saved / unsaved state persists on reload

**Feature: Saved restaurants page (`/saved`)**
- Tasks:
  - Fetch `saved_restaurants` joined with `restaurants` for current user
  - Card grid: photo, name, cuisine, rating
  - Unsave button on each card
  - Empty state with CTA to search a video

**Feature: Search history (`/history`)**
- Tasks:
  - Log every processed video to `search_history` on job completion
  - History page: video URL + detected restaurant + timestamp
  - Click a row to re-open the result
  - Delete individual entries
  - "Clear all history" button

**Feature: User profile page (`/profile`)**
- Tasks:
  - Avatar upload to Supabase Storage
  - Username edit (unique check)
  - Stats: total searches, restaurants saved
  - Delete account option (cascade deletes user data)

---

## Phase 4 — Discovery Features

> Goal: the app becomes a destination, not just a tool. Users browse trending spots and explore food categories.

**Stack additions:** Supabase Realtime, Geolocation API, PostGIS

### 4.1 Collections

**Feature: Create + manage collections**
- Users can organize saved restaurants into named collections
- Tasks:
  - `collections` table: `id, user_id, title, description, is_public`
  - `collection_restaurants` table: `collection_id, restaurant_id`
  - Create collection modal from saved page
  - Add/remove restaurants from any collection
  - Edit title, description, visibility (public/private)

**Feature: Collection detail page (`/collections/:id`)**
- Tasks:
  - Multi-pin map showing all restaurants in the collection
  - Restaurant list below map
  - Share button: copy public link to clipboard
  - RLS enforces private collections are only visible to owner

---

### 4.2 Discovery feed

**Feature: Trending restaurants feed**
- Homepage feed showing restaurants recently detected across all users
- Tasks:
  - Query: restaurants ordered by count of `video_results` in last 7 days
  - Feed card: photo, name, cuisine, times detected, city
  - Paginated with infinite scroll
  - Filter by city / cuisine type
  - Seed manually with 20+ restaurants at launch

**Feature: Nearby viral spots**
- Show trending restaurants near the user's location
- Tasks:
  - Browser Geolocation API with permission prompt
  - Query restaurants within N km using PostGIS `ST_DWithin`
  - "Near me" toggle on the feed
  - Fallback: prompt user to enter city if location is denied

**Feature: Smart search**
- Search bar that queries the restaurants table. Instant results.
- Tasks:
  - Debounced search input (300ms delay)
  - Postgres full-text search on `name + cuisine_type + address`
  - Result list: name, address, rating, photo
  - Click result: open restaurant detail page

**Feature: Food category browse**
- Browse restaurants by cuisine type
- Tasks:
  - Category pills: Ramen, Pho, BBQ, Cafes, Desserts, Street Food
  - Filter feed by `cuisine_type`
  - Each category has a cover image + restaurant count

---

## Phase 5 — Social + Scale

> Goal: community features, performance improvements, and admin tools.

**Stack additions:** Resend (email), Redis via Upstash (caching + queues), Cloudflare R2 (media storage)

### 5.1 Social features

**Feature: User notes on restaurants**
- Private notes on any saved restaurant
- Tasks:
  - `note` column on `saved_restaurants`
  - Inline edit note on restaurant card
  - Notes visible only to the owner (enforced by RLS)

**Feature: Community corrections**
- Users can flag incorrect restaurant detections
- Tasks:
  - "Wrong restaurant?" button on result
  - Correction form: submit correct name + Google Place
  - Store in `corrections` table
  - Manual review queue in admin dashboard

**Feature: Sharing**
- Share a restaurant result or collection as a public link with Open Graph previews
- Tasks:
  - Public result page at `/r/:restaurantId`
  - OG meta tags: restaurant photo, name, cuisine, rating
  - Copy link button
  - Share to Twitter/X shortcut

---

### 5.2 Performance + scale

**Feature: API response caching**
- Avoid redundant API calls for repeated videos and places
- Tasks:
  - If video URL already processed: return cached `video_results` immediately
  - Cache Places lookup by `google_place_id` (TTL: 24h) via Upstash Redis
  - Estimated API cost savings: ~60% on Places, ~40% on AI calls

**Feature: Processing queue**
- Handle concurrent video processing jobs without overloading the VPS
- Tasks:
  - Bull queue (Redis-backed) on the processing server
  - Max 3 concurrent jobs
  - Job status: `queued / processing / done / failed`
  - Estimated wait time shown in UI when queue is backed up

**Feature: Admin dashboard (`/admin`)**
- Internal page to monitor jobs, flag bad results, manage restaurants
- Tasks:
  - Protected `/admin` route (role check via RLS `is_admin` column)
  - Table of recent jobs with status + accuracy flag
  - Manual override: correct a restaurant match
  - Basic usage stats: jobs/day, top cities, top cuisines

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Processing server host | Railway (start) → Hetzner (scale) | Railway is instant to deploy; switch when you need more RAM |
| Maps | Google Maps JS SDK | Already using Google Places — one billing account |
| Database | Supabase Postgres | Auth + storage + PostGIS + RLS all in one |
| Queue | Bull + Upstash Redis | Lightweight, hosted Redis, no extra infra |
| Mobile strategy | Responsive web first, Capacitor wrapper later | Reuses 100% of the codebase |

## What to Cut Until You Have Users

The following features from the original spec are deferred — they need a user base to be useful:

- Follow system + social feed
- Personalized recommendations (ML model)
- Trending alerts / push notifications
- Restaurant analytics dashboard
- Creator partnerships
- AR discovery
- AI travel food planner
- Restaurant match score