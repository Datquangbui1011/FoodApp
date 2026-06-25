import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function makeClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}

// GET /api/collections?placeId=xxx  — list user collections, with item count + whether placeId is in each
export async function GET(req: NextRequest) {
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const placeId = req.nextUrl.searchParams.get('placeId') ?? '';

  const { data: collections } = await supabase
    .from('collections')
    .select('id, name, emoji, created_at, collection_items(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!collections) return NextResponse.json([]);

  let savedSet = new Set<string>();
  if (placeId) {
    const { data: items } = await supabase
      .from('collection_items')
      .select('collection_id')
      .eq('place_id', placeId)
      .in('collection_id', collections.map(c => c.id));
    if (items) savedSet = new Set(items.map(i => i.collection_id));
  }

  return NextResponse.json(collections.map(c => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    count: (c.collection_items as unknown as { count: number }[])?.[0]?.count ?? 0,
    hasCurrent: savedSet.has(c.id),
  })));
}

// POST /api/collections  — create a new collection
export async function POST(req: NextRequest) {
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, emoji, cover_photo_url, target_date } = await req.json() as { name: string; emoji?: string; cover_photo_url?: string | null; target_date?: string | null };
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: user.id, name: name.trim(), emoji: emoji ?? '📍', cover_photo_url: cover_photo_url ?? null, target_date: target_date ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
