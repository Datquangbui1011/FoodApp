import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface NearbyRestaurant {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  photoUrl: string | null;
  types: string[];
  cuisineHint: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<NearbyRestaurant[]>> {
  const p       = req.nextUrl.searchParams;
  const lat     = p.get('lat') ?? '';
  const lng     = p.get('lng') ?? '';
  const type    = p.get('type') ?? 'restaurant';   // restaurant | cafe | bar
  const keyword = p.get('keyword') ?? '';
  const openNow = p.get('openNow') === 'true';

  if (!lat || !lng || !KEY) return NextResponse.json([]);

  try {
    let url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&radius=2000&type=${type}&key=${KEY}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (openNow) url += `&opennow=true`;

    const res  = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json() as {
      results?: {
        place_id: string;
        name: string;
        vicinity?: string;
        geometry: { location: { lat: number; lng: number } };
        rating?: number;
        user_ratings_total?: number;
        price_level?: number;
        opening_hours?: { open_now?: boolean };
        photos?: { photo_reference: string }[];
        types?: string[];
      }[];
    };

    const CUISINE_KEYWORDS: Record<string, string> = {
      pizza: 'Pizza', italian: 'Italian', mexican: 'Mexican', burger: 'Burgers',
      chinese: 'Chinese', japanese: 'Japanese', sushi: 'Sushi', thai: 'Thai',
      vietnamese: 'Vietnamese', indian: 'Indian', korean: 'Korean', seafood: 'Seafood',
      cafe: 'Café', coffee: 'Coffee', bakery: 'Bakery', bar: 'Bar & Grill',
    };

    function cuisineHint(types: string[]): string {
      for (const t of types) {
        const hit = CUISINE_KEYWORDS[t.toLowerCase()];
        if (hit) return hit;
      }
      return types.includes('cafe') ? 'Café' : 'Restaurant';
    }

    const places: NearbyRestaurant[] = (data.results ?? []).slice(0, 15).map(r => ({
      placeId:     r.place_id,
      name:        r.name,
      address:     r.vicinity ?? '',
      lat:         r.geometry.location.lat,
      lng:         r.geometry.location.lng,
      rating:      r.rating ?? null,
      ratingCount: r.user_ratings_total ?? null,
      priceLevel:  r.price_level ?? null,
      openNow:     r.opening_hours?.open_now ?? null,
      photoUrl:    r.photos?.[0]
        ? `/api/photo?ref=${encodeURIComponent(r.photos[0].photo_reference)}`
        : null,
      types:       r.types ?? [],
      cuisineHint: cuisineHint(r.types ?? []),
    }));

    return NextResponse.json(places);
  } catch {
    return NextResponse.json([]);
  }
}
