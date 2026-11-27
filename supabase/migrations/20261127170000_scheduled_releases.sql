-- Scheduled releases: songs and albums uploaded now, published automatically at a chosen time.
-- The files are already on R2; at release time a cron job inserts the album and songs in one go,
-- so the usual notification and push triggers fire exactly as for a normal publish.

create extension if not exists pg_cron;

create table if not exists public.scheduled_releases (
  id uuid primary key default gen_random_uuid(),
  release_at timestamptz not null,
  artist_id uuid not null references public.artists(id) on delete cascade,
  artist_name text not null,
  album jsonb,             -- {title, cover_art_url, description, genre} for an album, null for a single
  songs jsonb not null,    -- [{title, audio_url, cover_art_url, genre, description, track_number}]
  collab_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','released','cancelled','failed')),
  error text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists scheduled_releases_due_idx on public.scheduled_releases (release_at) where status = 'pending';
alter table public.scheduled_releases enable row level security;

drop policy if exists "See own schedules" on public.scheduled_releases;
create policy "See own schedules" on public.scheduled_releases for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_artist_owner(artist_id));

drop policy if exists "Create schedules" on public.scheduled_releases;
create policy "Create schedules" on public.scheduled_releases for insert to authenticated
  with check (
    status = 'pending'
    and release_at > now()
    and jsonb_typeof(songs) = 'array' and jsonb_array_length(songs) between 1 and 15
    and (public.has_role(auth.uid(), 'admin')
         or (public.is_artist_owner(artist_id)
             and artist_name = (select a.name from public.artists a where a.id = scheduled_releases.artist_id)))
  );

drop policy if exists "Cancel own schedules" on public.scheduled_releases;
create policy "Cancel own schedules" on public.scheduled_releases for update to authenticated
  using (status = 'pending' and (public.has_role(auth.uid(), 'admin') or public.is_artist_owner(artist_id)))
  with check (status in ('pending','cancelled') and (public.has_role(auth.uid(), 'admin') or public.is_artist_owner(artist_id)));

create schema if not exists private;

create or replace function private.release_due_schedules() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  r record;
  new_album uuid;
  done integer := 0;
begin
  for r in
    select * from public.scheduled_releases
    where status = 'pending' and release_at <= now()
    order by release_at
    for update skip locked
  loop
    begin
      new_album := null;
      if r.album is not null then
        insert into public.albums (title, artist_name, artist_id, cover_art_url, description, genre, released_at)
        values (r.album->>'title', r.artist_name, r.artist_id, r.album->>'cover_art_url',
                nullif(r.album->>'description',''), nullif(r.album->>'genre',''), now())
        returning id into new_album;
      end if;

      -- One statement for all songs: one notification and one push per release.
      with ins as (
        insert into public.songs (title, artist, artist_id, album_id, track_number, genre, description,
                                  audio_url, cover_art_url, uploaded_at)
        select s->>'title', r.artist_name, r.artist_id, new_album, nullif(s->>'track_number','')::int,
               nullif(s->>'genre',''), nullif(s->>'description',''), s->>'audio_url', nullif(s->>'cover_art_url',''), now()
        from jsonb_array_elements(r.songs) s
        returning id
      )
      insert into public.song_artists (song_id, artist_id)
      select ins.id, c from ins, unnest(r.collab_ids) c where c <> r.artist_id
      on conflict do nothing;

      update public.scheduled_releases set status = 'released', released_at = now(), error = null where id = r.id;
      done := done + 1;
    exception when others then
      update public.scheduled_releases set status = 'failed', error = sqlerrm where id = r.id;
    end;
  end loop;
  return done;
end $$;

revoke all on function private.release_due_schedules() from public, anon, authenticated;

-- Check every minute.
do $$ begin
  perform cron.unschedule('release-scheduled-music') where exists (select 1 from cron.job where jobname = 'release-scheduled-music');
  perform cron.schedule('release-scheduled-music', '* * * * *', 'select private.release_due_schedules()');
end $$;
