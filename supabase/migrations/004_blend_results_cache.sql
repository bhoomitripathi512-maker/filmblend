-- Cache computed blend results to avoid recomputing on every page load

alter table public.blends
  add column if not exists results_json jsonb,
  add column if not exists results_computed_at timestamptz;

create index if not exists idx_blends_results_computed_at
  on public.blends (results_computed_at);
