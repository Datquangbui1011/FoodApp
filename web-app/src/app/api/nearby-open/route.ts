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

export async function GET(req: NextRequest): Promise<NextResponse<OpenNearbyPlace[]>> {
  const p   = req.nextUrl.searchParams;
  const lat = p.get('lat') ?? '';
  const lng = p.get('lng') ?? '';

  if (!lat || !lng || !KEY) return NextResponse.json([]);

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&radius=1500&type=restaurant&opennow=true&key=${KEY}`,
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

    const SKIP = new Set(['point_of_interest', 'establishment', 'food', 'restaurant', 'store']);
    const places: OpenNearbyPlace[] = (data.results ?? []).slice(0, 6).map(r => ({
      id:          `open-${r.place_id}`,
      name:        r.name,
      lat:         r.geometry.location.lat,
      lng:         r.geometry.location.lng,
      address:     r.vicinity ?? '',
      rating:      r.rating ?? null,
      cuisineType: r.types?.find(t => !SKIP.has(t))?.replace(/_/g, ' ') ?? 'Restaurant',
      videoUrl:    null,
      placeId:     r.place_id,
      openNow:     true,
    }));

    return NextResponse.json(places);
  } catch {
    return NextResponse.json([]);
  }
}
