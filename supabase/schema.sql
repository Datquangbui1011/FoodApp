-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

-- ─────────────────────────────────────────────
-- profiles  (secure customer information store)
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text,
  email       text,
  username    text,
  avatar_url  text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Row Level Security — users can only access their own row
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Migration: if profiles table already exists, add missing columns
alter table public.profiles
  add column if not exists full_name  text,
  add column if not exists email      text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz default now() not null;


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


-- ─────────────────────────────────────────────
-- place_reviews  (in-app reviews written by users)
-- ─────────────────────────────────────────────
create table public.place_reviews (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  place_key       text not null,            -- google placeId, else 'name@lat,lng'
  restaurant_name text not null,
  rating          int  not null check (rating between 1 and 5),
  body            text,
  created_at      timestamptz default now() not null,
  unique (user_id, place_key)
);

alter table public.place_reviews enable row level security;

-- Reviews are public to read, but each user only writes their own.
create policy "Anyone can read reviews"
  on public.place_reviews for select
  using (true);

create policy "Users write own reviews"
  on public.place_reviews for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
