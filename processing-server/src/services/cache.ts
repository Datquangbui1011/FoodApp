import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

// Strip query params so the same video with different tracking params hits the cache
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().split('?')[0];
  }
}

export async function getCached(url: string): Promise<any | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const { data } = await client
      .from('video_cache')
      .select('result')
      .eq('url_key', normalizeUrl(url))
      .single();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

export async function setCache(url: string, result: any): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.from('video_cache').upsert(
      { url_key: normalizeUrl(url), result },
      { onConflict: 'url_key' }
    );
  } catch (e) {
    console.error('[cache] Failed to store result:', e);
  }
}
