-- Allow API routes to write via anon key (shareable blend links)
create policy "Anyone can insert blends"
  on public.blends for insert
  with check (true);

create policy "Anyone can update blends"
  on public.blends for update
  using (true);

create policy "Anyone can insert participants"
  on public.blend_participants for insert
  with check (true);

create policy "Anyone can update participants"
  on public.blend_participants for update
  using (true);

create policy "Anyone can insert film cache"
  on public.film_cache for insert
  with check (true);

create policy "Anyone can update film cache"
  on public.film_cache for update
  using (true);
