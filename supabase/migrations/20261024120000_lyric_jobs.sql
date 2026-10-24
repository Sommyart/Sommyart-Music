-- Automatic lyric timing: an artist pastes the lyrics, a background worker (GitHub Action) works out when
-- each line is sung, and the artist reviews the result before it goes live.

create table public.lyric_jobs (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lyrics_text text not null check (char_length(lyrics_text) between 1 and 20000),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- One running job per song, so a double tap cannot queue the same work twice.
create unique index lyric_jobs_one_active_per_song on public.lyric_jobs (song_id) where status in ('pending', 'processing');
create index lyric_jobs_queue on public.lyric_jobs (status, created_at);
create index lyric_jobs_song on public.lyric_jobs (song_id, created_at desc);

alter table public.lyric_jobs enable row level security;

create policy "See own lyric jobs" on public.lyric_jobs
  for select to authenticated using (requested_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Only the artist who owns the song (or an admin) can ask for timing, and only as a new pending job.
create policy "Request timing for own songs" on public.lyric_jobs
  for insert to authenticated with check (
    requested_by = auth.uid()
    and status = 'pending'
    and result is null
    and (
      public.has_role(auth.uid(), 'admin')
      or exists (select 1 from public.songs s where s.id = song_id and public.is_artist_owner(s.artist_id))
    )
  );

create policy "Remove own lyric jobs" on public.lyric_jobs
  for delete to authenticated using (
    (requested_by = auth.uid() or public.has_role(auth.uid(), 'admin')) and status in ('done', 'failed')
  );

-- The worker updates jobs through the lyrics-worker edge function (service role), never directly.
