import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const serverUrl = process.env.PROCESSING_SERVER_URL;
  const apiKey = process.env.PROCESSING_SERVER_API_KEY;

  if (!serverUrl || !apiKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`${serverUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Processing server unreachable' }, { status: 503 });
  }
}
