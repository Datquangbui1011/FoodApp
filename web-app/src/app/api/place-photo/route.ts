import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const name = p.get('name') ?? '';
  const lat  = p.get('lat')  ?? '';
  const lng  = p.get('lng')  ?? '';

  if (!name || !KEY) return new NextResponse(null, { status: 204 });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(name)}&location=${lat},${lng}&radius=500&key=${KEY}`,
      { next: { revalidate: 86400 } },
    );
    const data = await res.json() as {
      results?: { photos?: { photo_reference: string }[] }[];
    };
    const ref = data.results?.[0]?.photos?.[0]?.photo_reference;
    if (!ref) return new NextResponse(null, { status: 204 });

    // Proxy the image so the API key stays server-side
    const img = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${KEY}`,
    );
    const blob = await img.arrayBuffer();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
