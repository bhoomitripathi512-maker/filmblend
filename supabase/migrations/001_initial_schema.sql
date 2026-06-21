-- Filmblend: Letterboxd blend app schema

create extension if not exists "pgcrypto";

create table public.blends (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  status text not null default 'waiting' check (status in ('waiting', 'partial', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blend_participants (
  id uuid primary key default gen_random_uuid(),
  blend_id uuid not null references public.blends(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  letterboxd_username text not null,
  display_name text,
  avatar_url text,
  films_watched jsonb not null default '[]'::jsonb,
  films_watchlist jsonb not null default '[]'::jsonb,
  films_rated jsonb not null default '[]'::jsonb,
  genre_stats jsonb not null default '{}'::jsonb,
  director_stats jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (blend_id, slot),
  unique (blend_id, letterboxd_username)
);

create index idx_blends_slug on public.blends(slug);
create index idx_blend_participants_blend_id on public.blend_participants(blend_id);

create table public.film_cache (
  letterboxd_slug text primary key,
  title text,
  year smallint,
  tmdb_id integer,
  poster_path text,
  genres text[] default '{}',
  directors text[] default '{}',
  runtime smallint,
  updated_at timestamptz not null default now()
);

alter table public.blends enable row level security;
alter table public.blend_participants enable row level security;
alter table public.film_cache enable row level security;

-- Public read access for blends (shareable links)
create policy "Anyone can read blends"
  on public.blends for select
  using (true);

create policy "Anyone can read participants"
  on public.blend_participants for select
  using (true);

create policy "Anyone can read film cache"
  on public.film_cache for select
  using (true);

-- Writes go through service role in API routes only

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger blends_updated_at
  before update on public.blends
  for each row execute function public.set_updated_at();
