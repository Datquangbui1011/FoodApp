-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create table public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  username   text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────
-- recent_searches
-- ─────────────────────────────────────────────
create table public.recent_searches (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  restaurant_name text not null,
  confidence      integer,
  searched_at     timestamptz default now() not null
);

alter table public.recent_searches enable row level security;

create policy "Users own their searches"
  on public.recent_searches for all
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- saved_restaurants
-- ─────────────────────────────────────────────
create table public.saved_restaurants (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  restaurant_name text not null,
  cuisine_type    text,
  address         text,
  lat             double precision,
  lng             double precision,
  saved_at        timestamptz default now() not null,
  unique (user_id, restaurant_name)
);

alter table public.saved_restaurants enable row level security;

create policy "Users own their saved restaurants"
  on public.saved_restaurants for all
  using (auth.uid() = user_id);

-- Migration: adds video_url and rating columns (run in Supabase SQL Editor if table already exists)
alter table public.saved_restaurants
  add column if not exists video_url text,
  add column if not exists rating double precision;
