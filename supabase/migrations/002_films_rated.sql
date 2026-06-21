-- Add rated films to participant sync data
alter table public.blend_participants
  add column if not exists films_rated jsonb not null default '[]'::jsonb;
