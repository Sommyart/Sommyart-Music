-- 1) A real notifications list: new songs, new albums, and announcements posted from Studio.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('song','album','announcement')),
  title text not null,
  body text not null default '',
  route text,
  artist_id uuid,
  album_id uuid,
  song_id uuid,
  track_count integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists app_notifications_created_idx on public.app_notifications (created_at desc);
alter table public.app_notifications enable row level security;

drop policy if exists "Anyone signed in can read notifications" on public.app_notifications;
create policy "Anyone signed in can read notifications" on public.app_notifications
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage notifications" on public.app_notifications;
create policy "Admins manage notifications" on public.app_notifications
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2) When songs are published, add one notification per single or album, naming the artist.
create or replace function public.notify_songs_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g record;
  existing_id uuid;
  album_title text;
  clean_artist text;
begin
  begin
    for g in
      select artist_id, album_id,
             min(artist) as artist,
             count(*) as cnt,
             (array_agg(id order by title))[1] as first_id,
             (array_agg(title order by title))[1] as first_title
      from new_rows
      where uploaded_at > now() - interval '15 minutes'
      group by artist_id, album_id, case when album_id is null then id else null end
    loop
      clean_artist := btrim(regexp_replace(coalesce(g.artist, 'An artist'), '\s+(feat\.?|ft\.?|featuring)\s.*$', '', 'i'));
      if g.album_id is not null then
        select title into album_title from public.albums where id = g.album_id;
        -- Tracks of one album arrive in pieces; keep them as a single notification.
        select id into existing_id from public.app_notifications
          where album_id = g.album_id and created_at > now() - interval '30 minutes' limit 1;
        if existing_id is not null then
          update public.app_notifications
             set kind = 'album',
                 track_count = track_count + g.cnt,
                 title = clean_artist || ' just dropped a new album',
                 body = coalesce(album_title, g.first_title) || ' · ' || (track_count + g.cnt) || ' tracks',
                 route = '/album/' || g.album_id
           where id = existing_id;
          continue;
        end if;
      end if;
      if g.album_id is not null and g.cnt > 1 then
        insert into public.app_notifications (kind, title, body, route, artist_id, album_id, song_id, track_count)
        values ('album', clean_artist || ' just dropped a new album',
                coalesce(album_title, g.first_title) || ' · ' || g.cnt || ' tracks',
                '/album/' || g.album_id, g.artist_id, g.album_id, g.first_id, g.cnt);
      else
        insert into public.app_notifications (kind, title, body, route, artist_id, album_id, song_id, track_count)
        values ('song', clean_artist || ' just dropped a new song', g.first_title,
                '/song/' || g.first_id, g.artist_id, g.album_id, g.first_id, 1);
      end if;
    end loop;
  exception when others then
    -- A notification problem must never block publishing a song.
    null;
  end;
  return null;
end $$;

drop trigger if exists songs_notify_list on public.songs;
create trigger songs_notify_list after insert on public.songs
  referencing new table as new_rows
  for each statement execute function public.notify_songs_published();

-- 3) Remote control: a phone tells the device that is playing what to do (pause, next, seek...).
create table if not exists public.playback_commands (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_device_id uuid not null,
  from_device_id uuid,
  action text not null check (action in ('play','pause','next','prev','seek','shuffle','repeat')),
  value text,
  created_at timestamptz not null default now()
);
create index if not exists playback_commands_user_idx on public.playback_commands (user_id, created_at desc);
alter table public.playback_commands enable row level security;

drop policy if exists "Own commands read" on public.playback_commands;
create policy "Own commands read" on public.playback_commands for select to authenticated using (user_id = auth.uid());
drop policy if exists "Own commands write" on public.playback_commands;
create policy "Own commands write" on public.playback_commands for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Own commands delete" on public.playback_commands;
create policy "Own commands delete" on public.playback_commands for delete to authenticated using (user_id = auth.uid());

create or replace function public.playback_commands_tidy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.playback_commands where created_at < now() - interval '2 minutes';
  return null;
end $$;
drop trigger if exists playback_commands_tidy on public.playback_commands;
create trigger playback_commands_tidy after insert on public.playback_commands
  for each statement execute function public.playback_commands_tidy();

do $$ begin
  begin alter publication supabase_realtime add table public.app_notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.playback_commands; exception when duplicate_object then null; end;
end $$;
