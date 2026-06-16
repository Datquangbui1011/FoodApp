import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface OpenNearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating: number | null;
  cuisineType: string;
  videoUrl: null;
  placeId: string;
  openNow: true;
}

function resolvePlaceType(cuisine: string): { type: string; keyword?: string } {
  const c = cuisine.toLowerCase();
  if (/cafe|coffee|café|latte|espresso|boba|bubble tea|tea/.test(c)) return { type: 'cafe' };
  if (/bar|pub|beer|brewery|cocktail/.test(c))                        return { type: 'bar' };
  if (/bakery|pastry|bread|cake|dessert/.test(c))                     return { type: 'bakery' };
  if (/pizza/.test(c))      return { type: 'restaurant', keyword: 'pizza' };
  if (/sushi|japanese/.test(c)) return { type: 'restaurant', keyword: 'sushi' };
  if (/ramen|noodle/.test(c))   return { type: 'restaurant', keyword: 'ramen' };
  if (/burger/.test(c))         return { type: 'restaurant', keyword: 'burger' };
  if (/mexican|taco/.test(c))   return { type: 'restaurant', keyword: 'mexican' };
  if (/chinese/.test(c))        return { type: 'restaurant', keyword: 'chinese' };
  if (/thai/.test(c))           return { type: 'restaurant', keyword: 'thai' };
  if (/indian/.test(c))         return { type: 'restaurant', keyword: 'indian' };
  if (/korean/.test(c))         return { type: 'restaurant', keyword: 'korean' };
  if (/vietnamese|pho/.test(c)) return { type: 'restaurant', keyword: 'vietnamese' };
  if (/italian/.test(c))        return { type: 'restaurant', keyword: 'italian' };
  return { type: 'restaurant' };
}

export async function GET(req: NextRequest): Promise<NextResponse<OpenNearbyPlace[]>> {
  const p       = req.nextUrl.searchParams;
  const lat     = p.get('lat')     ?? '';
  const lng     = p.get('lng')     ?? '';
  const cuisine = p.get('cuisine') ?? '';

  if (!lat || !lng || !KEY) return NextResponse.json([]);

  const { type, keyword } = resolvePlaceType(cuisine);
  const kwParam = keyword ? `&keyword=${encodeURIComponent(keyword)}` : '';

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&radius=1500&type=${type}&opennow=true${kwParam}&key=${KEY}`,
      { next: { revalidate: 300 } },
    );
    const data = await res.json() as {
      results?: {
        place_id: string;
        name: string;
        geometry: { location: { lat: number; lng: number } };
        vicinity?: string;
        rating?: number;
        types?: string[];
      }[];
    };

    const SKIP = new Set(['point_of_interest', 'establishment', 'food', 'restaurant', 'store', 'cafe']);
    const fallback = cuisine || 'Restaurant';
    const places: OpenNearbyPlace[] = (data.results ?? []).slice(0, 6).map(r => {
      const derivedType = r.types?.find(t => !SKIP.has(t))?.replace(/_/g, ' ');
      return {
        id:          `open-${r.place_id}`,
        name:        r.name,
        lat:         r.geometry.location.lat,
        lng:         r.geometry.location.lng,
        address:     r.vicinity ?? '',
        rating:      r.rating ?? null,
        cuisineType: derivedType ?? fallback,
        videoUrl:    null,
        placeId:     r.place_id,
        openNow:     true,
      };
    });

    return NextResponse.json(places);
  } catch {
    return NextResponse.json([]);
  }
}
