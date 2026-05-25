import { NextRequest, NextResponse } from 'next/server';

const KEY    = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const CSE_ID = process.env.GOOGLE_CSE_ID ?? '';

export interface TikTokVideo {
  videoUrl: string;
  thumbnail: string | null;
  title: string;
  author: string;
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
  topReviews: string[];            // up to 3 short review snippets
  tiktoks: TikTokVideo[];          // up to 4 videos
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

  // Summary: editorial first, then top review snippet
  const summary = details.summary
    ?? (details.topReviews[0] ? details.topReviews[0].slice(0, 120) + (details.topReviews[0].length > 120 ? '…' : '') : null);

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
interface DetailsResult {
  photoRefs: string[];
  weekdayText: string[] | null;
  openNow: boolean | null;
  address: string | null;
  priceLevel: number | null;
  phone: string | null;
  website: string | null;
  summary: string | null;
  topReviews: string[];
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
        reviews?: { text?: string; rating?: number }[];
      };
    };
    const r = data.result;
    const topReviews = (r?.reviews ?? [])
      .filter(rv => rv.text && rv.text.length > 20)
      .slice(0, 3)
      .map(rv => rv.text!);
    return {
      photoRefs:   (r?.photos ?? []).slice(0, 4).map(p => p.photo_reference),
      weekdayText: r?.opening_hours?.weekday_text ?? null,
      openNow:     r?.opening_hours?.open_now ?? null,
      address:     r?.formatted_address ?? null,
      priceLevel:  r?.price_level ?? null,
      phone:       r?.formatted_phone_number ?? null,
      website:     r?.website ?? null,
      summary:     r?.editorial_summary?.overview ?? null,
      topReviews,
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

// ── TikTok: find up to 4 videos via CSE + oEmbed ─────────────────────────────
async function getTikToks(name: string, knownUrl: string): Promise<TikTokVideo[]> {
  const results: TikTokVideo[] = [];

  // If caller already knows a TikTok URL, resolve it first
  if (knownUrl.includes('tiktok.com')) {
    const v = await resolveOEmbed(knownUrl);
    if (v) results.push(v);
  }

  // Search for more via CSE (up to 4 total)
  if (KEY && CSE_ID && results.length < 4) {
    try {
      const num = 4 - results.length;
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${KEY}&cx=${CSE_ID}` +
        `&q=${encodeURIComponent(name + ' restaurant food')}&siteSearch=tiktok.com&num=${num}`,
        { next: { revalidate: 3600 } },
      );
      const data = await res.json() as { items?: { link: string }[] };
      const links = (data.items ?? []).map(i => i.link).filter(l => l.includes('tiktok.com'));
      for (const link of links) {
        if (results.some(r => r.videoUrl === link)) continue;
        const v = await resolveOEmbed(link);
        if (v) results.push(v);
        if (results.length >= 4) break;
      }
    } catch { /* skip */ }
  }

  return results;
}

async function resolveOEmbed(url: string): Promise<TikTokVideo | null> {
  let resolved = url;
  if (!url.includes('/video/')) {
    try {
      resolved = (await fetch(url, { method: 'HEAD', redirect: 'follow' })).url;
    } catch { /* keep original */ }
  }
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolved)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const o = await res.json() as { thumbnail_url?: string; title?: string; author_name?: string };
    return { videoUrl: resolved, thumbnail: o.thumbnail_url ?? null, title: o.title ?? '', author: o.author_name ?? '' };
  } catch { return null; }
}
