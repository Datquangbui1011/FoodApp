import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref || !KEY) return new NextResponse(null, { status: 204 });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${ref}&key=${KEY}`,
      { redirect: 'follow' },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Places Photo API ${res.status}:`, body.slice(0, 200));
      return new NextResponse(null, { status: res.status });
    }
    const contentType = res.headers.get('Content-Type') ?? '';
    if (!contentType.startsWith('image/')) {
      const body = await res.text().catch(() => '');
      console.error('Places Photo unexpected content-type:', contentType, body.slice(0, 200));
      return new NextResponse(null, { status: 204 });
    }
    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('Places Photo fetch error:', e);
    return new NextResponse(null, { status: 204 });
  }
}
