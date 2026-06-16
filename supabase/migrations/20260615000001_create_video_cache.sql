create table if not exists public.video_cache (
  id uuid default gen_random_uuid() primary key,
  url_key text not null unique,
  result jsonb not null,
  created_at timestamptz default now() not null
);

-- No RLS — written only by the trusted backend (service role key)
alter table public.video_cache disable row level security;

-- Fast lookup by URL key
create index if not exists video_cache_url_key_idx on public.video_cache (url_key);
