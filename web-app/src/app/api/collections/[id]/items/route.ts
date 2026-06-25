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

// GET /api/collections/[id]/items — list items in a collection
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership
  const { data: col } = await supabase.from('collections').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await supabase
    .from('collection_items')
    .select('*')
    .eq('collection_id', id)
    .order('added_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

// POST /api/collections/[id]/items — add a restaurant to the collection
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: col } = await supabase.from('collections').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as {
    place_id: string; restaurant_name: string; lat: number; lng: number;
    address?: string; cuisine_type?: string; photo_url?: string; rating?: number;
  };

  const { data, error } = await supabase
    .from('collection_items')
    .upsert({ collection_id: id, ...body }, { onConflict: 'collection_id,place_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/collections/[id]/items?placeId=xxx — remove from collection
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const placeId = req.nextUrl.searchParams.get('placeId');
  if (!placeId) return NextResponse.json({ error: 'placeId required' }, { status: 400 });

  await supabase.from('collection_items').delete().eq('collection_id', id).eq('place_id', placeId);
  return NextResponse.json({ ok: true });
}
