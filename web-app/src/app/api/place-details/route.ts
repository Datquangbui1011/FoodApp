import { NextRequest, NextResponse } from 'next/server';

const KEY    = process.env.GOOGLE_PLACES_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const CSE_ID = process.env.GOOGLE_CSE_ID ?? '';

export interface TikTokVideo {
  videoUrl: string;
  thumbnail: string | null;
  title: string;
  author: string;
  platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube';
}

export interface PlaceDetails {
  placeId: string | null;          // Google place_id — stable key for in-app reviews
  photoUrls: string[];
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  hoursToday: string | null;
  hours: string[] | null;          // full weekday_text, one line per day
  address: string | null;
  distance: string | null;
  duration: string | null;
  tiktok: TikTokVideo | null;
  // enriched
  priceLevel: number | null;       // 0 = free, 1 = $, 2 = $$, 3 = $$$, 4 = $$$$
  phone: string | null;
  website: string | null;
  summary: string | null;          // editorial_summary or top review snippet
  topReviews: { text: string; rating: number; author: string; photoUrl: string | null; timeAgo: string | null }[];
  tiktoks: TikTokVideo[];          // up to 3 videos
}

export async function GET(req: NextRequest): Promise<NextResponse<PlaceDetails>> {
  const p        = req.nextUrl.searchParams;
  const name     = p.get('name')     ?? '';
  const lat      = p.get('lat')      ?? '';
  const lng      = p.get('lng')      ?? '';
  const userLat  = p.get('userLat')  ?? '';
  const userLng  = p.get('userLng')  ?? '';
  const videoUrl = p.get('videoUrl') ?? '';
  const address  = p.get('address')  ?? '';
  const location = cityFromAddress(address);

  const empty: PlaceDetails = {
    placeId: null,
    photoUrls: [], rating: null, ratingCount: null,
    openNow: null, hoursToday: null, hours: null, address: null,
    distance: null, duration: null, tiktok: null,
    priceLevel: null, phone: null, website: null,
    summary: null, topReviews: [], tiktoks: [],
  };
  if (!name || !KEY) return NextResponse.json(empty);

  // Step 1: Text Search → placeId + basic fields
  const place = await textSearch(name, lat, lng);
  if (!place) return NextResponse.json({ ...empty, tiktoks: await getTikToks(name, videoUrl, location) });

  // Step 2: Place Details + Distance Matrix + TikToks — in parallel
  const [details, distResult, tiktoks] = await Promise.all([
    placeDetails(place.placeId),
    getDistance(userLat, userLng, lat, lng),
    getTikToks(name, videoUrl, location),
  ]);

  // Photos — combine Text Search + Details, deduplicate, up to 10 (Google's max)
  const allRefs = [...(place.photoRefs ?? []), ...(details.photoRefs ?? [])]
    .filter((r, i, a) => a.indexOf(r) === i)
    .slice(0, 10);
  const photoUrls = allRefs.map(ref => `/api/photo?ref=${encodeURIComponent(ref)}`);

  const dayIndex = (new Date().getDay() + 6) % 7;
  const hoursToday = details.weekdayText?.[dayIndex]?.replace(/^[^:]+:\s*/, '') ?? null;

  // Summary: editorial first, then top positive review snippet
  const firstReview = details.topReviews.find(r => r.rating >= 4)?.text ?? details.topReviews[0]?.text;
  const summary = details.summary
    ?? (firstReview ? firstReview.slice(0, 120) + (firstReview.length > 120 ? '…' : '') : null);

  return NextResponse.json({
    placeId:     place.placeId,
    photoUrls,
    rating:      place.rating      ?? null,
    ratingCount: place.ratingCount ?? null,
    openNow:     place.openNow     ?? details.openNow ?? null,
    hoursToday,
    hours:       details.weekdayText ?? null,
    address:     details.address   ?? null,
    distance:    distResult.distance,
    duration:    distResult.duration,
    tiktok:      tiktoks[0] ?? null,
    priceLevel:  place.priceLevel  ?? details.priceLevel ?? null,
    phone:       details.phone     ?? null,
    website:     details.website   ?? null,
    summary,
    topReviews:  details.topReviews,
    tiktoks,
  });
}

// ── Google Places Text Search ─────────────────────────────────────────────────
interface TextResult {
  placeId: string;
  rating?: number;
  ratingCount?: number;
  openNow?: boolean;
  priceLevel?: number;
  photoRefs: string[];
}

async function textSearch(name: string, lat: string, lng: string): Promise<TextResult | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(name)}&location=${lat},${lng}&radius=1000&key=${KEY}`,
      { next: { revalidate: 86400 } },
    );
    const data = await res.json() as {
      results?: {
        place_id: string;
        rating?: number;
        user_ratings_total?: number;
        price_level?: number;
        opening_hours?: { open_now?: boolean };
        photos?: { photo_reference: string }[];
      }[];
    };
    const r = data.results?.[0];
    if (!r) return null;
    return {
      placeId:     r.place_id,
      rating:      r.rating,
      ratingCount: r.user_ratings_total,
      openNow:     r.opening_hours?.open_now,
      priceLevel:  r.price_level,
      photoRefs:   (r.photos ?? []).slice(0, 10).map(p => p.photo_reference),
    };
  } catch { return null; }
}

// ── Google Place Details ──────────────────────────────────────────────────────
type Review = { text: string; rating: number; author: string; photoUrl: string | null; timeAgo: string | null };

interface DetailsResult {
  photoRefs: string[];
  weekdayText: string[] | null;
  openNow: boolean | null;
  address: string | null;
  priceLevel: number | null;
  phone: string | null;
  website: string | null;
  summary: string | null;
  topReviews: Review[];
}

function fairReviews(raw: { text?: string; rating?: number; author_name?: string; profile_photo_url?: string; relative_time_description?: string }[]): Review[] {
  const valid = raw.filter(r => r.text && r.text.length > 20 && r.rating != null) as
    { text: string; rating: number; author_name?: string; profile_photo_url?: string; relative_time_description?: string }[];
  return valid.slice(0, 5).map(r => ({
    text:     r.text,
    rating:   r.rating,
    author:   r.author_name ?? 'Anonymous',
    photoUrl: r.profile_photo_url ?? null,
    timeAgo:  r.relative_time_description ?? null,
  }));
}

async function placeDetails(placeId: string): Promise<DetailsResult> {
  try {
    const fields = 'opening_hours,formatted_address,photos,price_level,formatted_phone_number,website,editorial_summary,reviews';
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${KEY}`,
      { next: { revalidate: 3600 } },
    );
    const data = await res.json() as {
      result?: {
        opening_hours?: { open_now?: boolean; weekday_text?: string[] };
        formatted_address?: string;
        photos?: { photo_reference: string }[];
        price_level?: number;
        formatted_phone_number?: string;
        website?: string;
        editorial_summary?: { overview?: string };
        reviews?: { text?: string; rating?: number; author_name?: string; profile_photo_url?: string; relative_time_description?: string }[];
      };
    };
    const r = data.result;
    return {
      photoRefs:   (r?.photos ?? []).slice(0, 10).map(p => p.photo_reference),
      weekdayText: r?.opening_hours?.weekday_text ?? null,
      openNow:     r?.opening_hours?.open_now ?? null,
      address:     r?.formatted_address ?? null,
      priceLevel:  r?.price_level ?? null,
      phone:       r?.formatted_phone_number ?? null,
      website:     r?.website ?? null,
      summary:     r?.editorial_summary?.overview ?? null,
      topReviews:  fairReviews(r?.reviews ?? []),
    };
  } catch {
    return { photoRefs: [], weekdayText: null, openNow: null, address: null, priceLevel: null, phone: null, website: null, summary: null, topReviews: [] };
  }
}

// ── Google Distance Matrix ────────────────────────────────────────────────────
async function getDistance(
  userLat: string, userLng: string,
  destLat: string, destLng: string,
): Promise<{ distance: string | null; duration: string | null }> {
  if (!userLat || !userLng) return { distance: null, duration: null };
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${userLat},${userLng}&destinations=${destLat},${destLng}&mode=driving&key=${KEY}`,
      { next: { revalidate: 300 } },
    );
    const data = await res.json() as {
      rows?: { elements?: { distance?: { text: string }; duration?: { text: string }; status: string }[] }[];
    };
    const el = data.rows?.[0]?.elements?.[0];
    if (el?.status !== 'OK') return { distance: null, duration: null };
    return { distance: el.distance?.text ?? null, duration: el.duration?.text ?? null };
  } catch { return { distance: null, duration: null }; }
}

// ── Video reviews (TikTok · Instagram · Facebook) ────────────────────────────

type Platform = 'tiktok' | 'instagram' | 'facebook' | 'youtube';

function urlPlatform(url: string): Platform | null {
  if (url.includes('tiktok.com'))  return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('youtube.com')  || url.includes('youtu.be')) return 'youtube';
  return null;
}

// Pull a city/locality out of a formatted address for the video search query.
// Handles "street, City, ST 12345, Country", "City, ST", and bare "City".
function cityFromAddress(address: string): string {
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 4) return parts[parts.length - 3]; // street, CITY, state zip, country
  if (parts.length >= 2) return parts[parts.length - 2]; // street/CITY, state
  return parts[0] ?? '';
}

// Significant words from the restaurant name, used to validate a video matches it.
function nameTokens(name: string): string[] {
  const stop = new Set(['the', 'and', 'restaurant', 'cafe', 'bar', 'grill', 'kitchen', 'house', 'co', 'llc', 'inc', 'food', 'spirits']);
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t.length >= 3 && !stop.has(t));
}

// A video is "the correct one" if its title mentions a significant name token.
function titleMatchesName(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const t = title.toLowerCase();
  return tokens.some(tok => t.includes(tok));
}

// Fetch up to `num` videos from one social platform via CSE for a free-text query.
async function cseVideos(query: string, site: string, num: number): Promise<TikTokVideo[]> {
  if (!KEY || !CSE_ID) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${KEY}&cx=${CSE_ID}` +
      `&q=${encodeURIComponent(query)}&siteSearch=${site}&num=${num}`,
      { next: { revalidate: 3600 } },
    );
    const data = await res.json() as {
      items?: { link: string; title?: string; pagemap?: { cse_thumbnail?: { src: string }[] } }[];
    };
    return (data.items ?? [])
      .filter(i => i.link.includes(site))
      .map(i => ({
        videoUrl:  i.link,
        thumbnail: i.pagemap?.cse_thumbnail?.[0]?.src ?? null,
        title:     i.title ?? '',
        author:    '',
        platform:  urlPlatform(i.link) ?? 'tiktok',
      }));
  } catch { return []; }
}

// Enrich a TikTok URL with real thumbnail + author via oEmbed
async function tiktokOEmbed(url: string): Promise<TikTokVideo | null> {
  let resolved = url;
  if (!url.includes('/video/')) {
    try { resolved = (await fetch(url, { method: 'HEAD', redirect: 'follow' })).url; }
    catch { /* keep original */ }
  }
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolved)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const o = await res.json() as { thumbnail_url?: string; title?: string; author_name?: string };
    return { videoUrl: resolved, thumbnail: o.thumbnail_url ?? null, title: o.title ?? '', author: o.author_name ?? '', platform: 'tiktok' };
  } catch { return null; }
}

async function getTikToks(name: string, knownUrl: string, location: string): Promise<TikTokVideo[]> {
  const seen = new Set<string>();
  const out: TikTokVideo[] = [];
  const tokens = nameTokens(name);
  const query  = location ? `${name} ${location}` : name;

  function add(v: TikTokVideo) {
    if (out.length < 3 && v.videoUrl && !seen.has(v.videoUrl)) { seen.add(v.videoUrl); out.push(v); }
  }

  // 1. Known URL from the processed video — most relevant, goes first.
  if (knownUrl) {
    const p = urlPlatform(knownUrl);
    if (p === 'tiktok') {
      const v = await tiktokOEmbed(knownUrl);
      if (v) add(v);
    } else if (p) {
      add({ videoUrl: knownUrl, thumbnail: null, title: '', author: '', platform: p });
    }
  }

  // 2. Search TikTok for "<name> <city>", then keep only videos whose title
  //    matches the restaurant name. Fall back to the raw results if the strict
  //    filter leaves nothing (the query itself already constrains relevance).
  const rawTT   = await cseVideos(query, 'tiktok.com', 8);
  const matched = rawTT.filter(v => titleMatchesName(v.title, tokens));
  const pool    = matched.length ? matched : rawTT;

  for (const v of pool) {
    if (out.length >= 3) break;
    // Enrich to a canonical /video/<id> URL + real thumbnail/author (needed to embed).
    const needsEnrich = !v.thumbnail || !v.videoUrl.includes('/video/');
    const enriched = needsEnrich ? await tiktokOEmbed(v.videoUrl) : null;
    add(enriched ?? v);
  }

  // 3. Only if no TikToks were found at all, fall back to IG/FB so the section
  //    isn't empty (these link out rather than embed).
  if (out.length === 0) {
    const [ig, fb] = await Promise.all([
      cseVideos(query, 'instagram.com', 3),
      cseVideos(query, 'facebook.com', 3),
    ]);
    [...ig, ...fb].filter(v => titleMatchesName(v.title, tokens)).forEach(add);
  }

  return out;
}
