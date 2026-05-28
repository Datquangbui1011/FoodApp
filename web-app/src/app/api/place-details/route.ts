import { NextRequest, NextResponse } from 'next/server';

const KEY    = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const CSE_ID = process.env.GOOGLE_CSE_ID ?? '';

export interface TikTokVideo {
  videoUrl: string;
  thumbnail: string | null;
  title: string;
  author: string;
  platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube';
}

export interface PlaceDetails {
  photoUrls: string[];
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  hoursToday: string | null;
  address: string | null;
  distance: string | null;
  duration: string | null;
  tiktok: TikTokVideo | null;
  // enriched
  priceLevel: number | null;       // 0 = free, 1 = $, 2 = $$, 3 = $$$, 4 = $$$$
  phone: string | null;
  website: string | null;
  summary: string | null;          // editorial_summary or top review snippet
  topReviews: { text: string; rating: number; author: string }[];  // balanced good + bad
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

  const empty: PlaceDetails = {
    photoUrls: [], rating: null, ratingCount: null,
    openNow: null, hoursToday: null, address: null,
    distance: null, duration: null, tiktok: null,
    priceLevel: null, phone: null, website: null,
    summary: null, topReviews: [], tiktoks: [],
  };
  if (!name || !KEY) return NextResponse.json(empty);

  // Step 1: Text Search → placeId + basic fields
  const place = await textSearch(name, lat, lng);
  if (!place) return NextResponse.json({ ...empty, tiktoks: await getTikToks(name, videoUrl) });

  // Step 2: Place Details + Distance Matrix + TikToks — in parallel
  const [details, distResult, tiktoks] = await Promise.all([
    placeDetails(place.placeId),
    getDistance(userLat, userLng, lat, lng),
    getTikToks(name, videoUrl),
  ]);

  // Photos — combine Text Search + Details, deduplicate, up to 4
  const allRefs = [...(place.photoRefs ?? []), ...(details.photoRefs ?? [])]
    .filter((r, i, a) => a.indexOf(r) === i)
    .slice(0, 4);
  const photoUrls = allRefs.map(ref =>
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${ref}&key=${KEY}`,
  );

  const dayIndex = (new Date().getDay() + 6) % 7;
  const hoursToday = details.weekdayText?.[dayIndex]?.replace(/^[^:]+:\s*/, '') ?? null;

  // Summary: editorial first, then top positive review snippet
  const firstReview = details.topReviews.find(r => r.rating >= 4)?.text ?? details.topReviews[0]?.text;
  const summary = details.summary
    ?? (firstReview ? firstReview.slice(0, 120) + (firstReview.length > 120 ? '…' : '') : null);

  return NextResponse.json({
    photoUrls,
    rating:      place.rating      ?? null,
    ratingCount: place.ratingCount ?? null,
    openNow:     place.openNow     ?? details.openNow ?? null,
    hoursToday,
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
      photoRefs:   (r.photos ?? []).slice(0, 4).map(p => p.photo_reference),
    };
  } catch { return null; }
}

// ── Google Place Details ──────────────────────────────────────────────────────
type Review = { text: string; rating: number; author: string };

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

function fairReviews(raw: { text?: string; rating?: number; author_name?: string }[]): Review[] {
  const valid = raw.filter(r => r.text && r.text.length > 20 && r.rating != null) as
    { text: string; rating: number; author_name?: string }[];
  const positive = valid.filter(r => r.rating >= 4);
  const negative = valid.filter(r => r.rating <= 3);
  // Take up to 2 positive + 2 negative for a balanced view
  const mixed = [
    ...positive.slice(0, 2),
    ...negative.slice(0, 2),
  ].slice(0, 4);
  return mixed.map(r => ({ text: r.text, rating: r.rating, author: r.author_name ?? 'Anonymous' }));
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
        reviews?: { text?: string; rating?: number; author_name?: string }[];
      };
    };
    const r = data.result;
    return {
      photoRefs:   (r?.photos ?? []).slice(0, 4).map(p => p.photo_reference),
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

// Fetch up to `num` videos for a restaurant from one social platform via CSE
async function cseVideos(name: string, site: string, num: number): Promise<TikTokVideo[]> {
  if (!KEY || !CSE_ID) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${KEY}&cx=${CSE_ID}` +
      `&q=${encodeURIComponent(name + ' food')}&siteSearch=${site}&num=${num}`,
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

async function getTikToks(name: string, knownUrl: string): Promise<TikTokVideo[]> {
  const seen  = new Set<string>();
  const out: TikTokVideo[] = [];

  function add(v: TikTokVideo) {
    if (out.length < 3 && !seen.has(v.videoUrl)) { seen.add(v.videoUrl); out.push(v); }
  }

  // 1. Known URL from the processed video — put it first
  if (knownUrl) {
    const p = urlPlatform(knownUrl);
    if (p === 'tiktok') {
      const v = await tiktokOEmbed(knownUrl);
      if (v) add(v);
    } else if (p) {
      add({ videoUrl: knownUrl, thumbnail: null, title: '', author: '', platform: p });
    }
  }

  if (out.length >= 3) return out;

  // 2. Search TikTok, Instagram, Facebook in parallel — take 1 from each for variety
  const [tt, ig, fb] = await Promise.all([
    cseVideos(name, 'tiktok.com',   3),
    cseVideos(name, 'instagram.com', 3),
    cseVideos(name, 'facebook.com',  3),
  ]);

  // Round-robin: TikTok → Instagram → Facebook → TikTok …
  const pool = [tt, ig, fb];
  let i = 0;
  while (out.length < 3) {
    let added = false;
    for (const bucket of pool) {
      if (out.length >= 3) break;
      const v = bucket[i];
      if (!v) continue;
      if (v.platform === 'tiktok' && !v.thumbnail) {
        const enriched = await tiktokOEmbed(v.videoUrl);
        if (enriched) { add(enriched); added = true; }
      } else {
        add(v); added = true;
      }
    }
    i++;
    if (!added) break;
  }

  return out;
}
