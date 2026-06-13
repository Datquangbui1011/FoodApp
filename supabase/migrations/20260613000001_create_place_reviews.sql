create table if not exists public.place_reviews (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  place_key       text not null,
  restaurant_name text not null,
  rating          int  not null check (rating between 1 and 5),
  body            text,
  created_at      timestamptz default now() not null,
  unique (user_id, place_key)
);

alter table public.place_reviews enable row level security;

create policy "Anyone can read reviews"
  on public.place_reviews for select
  using (true);

create policy "Users write own reviews"
  on public.place_reviews for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
