-- Personal playlists: each user sees and edits only their own.
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index playlists_user_idx on public.playlists (user_id);
alter table public.playlists enable row level security;

create policy "Users view own playlists" on public.playlists
  for select to authenticated using (auth.uid() = user_id);
create policy "Users create own playlists" on public.playlists
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own playlists" on public.playlists
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own playlists" on public.playlists
  for delete to authenticated using (auth.uid() = user_id);

create table public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  unique (playlist_id, song_id)
);
create index playlist_songs_playlist_idx on public.playlist_songs (playlist_id, position);
alter table public.playlist_songs enable row level security;

create policy "Users view songs in own playlists" on public.playlist_songs
  for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));
create policy "Users add songs to own playlists" on public.playlist_songs
  for insert to authenticated
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));
create policy "Users update songs in own playlists" on public.playlist_songs
  for update to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));
create policy "Users remove songs from own playlists" on public.playlist_songs
  for delete to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));
