-- Persist resolved TMDB IDs per participant for exclusion + debug visibility

alter table public.blend_participants
  add column if not exists seen_tmdb_ids integer[] not null default '{}';
