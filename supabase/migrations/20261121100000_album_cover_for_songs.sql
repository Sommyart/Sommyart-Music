-- A song inside an album always shows the album's cover, once the album has one.
-- Enforced in the database, so it holds for every upload path (Studio, artist portal, edits).

-- Keep the covers being replaced, so they can be restored if ever needed.
insert into public.url_backup_20261115 (table_name, row_id, column_name, old_value)
select 'songs_album_cover', s.id, 'cover_art_url', coalesce(s.cover_art_url, '')
from public.songs s join public.albums a on a.id = s.album_id
where coalesce(a.cover_art_url, '') <> '' and s.cover_art_url is distinct from a.cover_art_url;

-- New or moved songs take their album's cover.
create or replace function public.song_uses_album_cover()
returns trigger language plpgsql security definer set search_path = '' as $$
declare album_cover text;
begin
  if new.album_id is not null then
    select a.cover_art_url into album_cover from public.albums a where a.id = new.album_id;
    if coalesce(album_cover, '') <> '' then
      new.cover_art_url := album_cover;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists songs_use_album_cover on public.songs;
create trigger songs_use_album_cover
  before insert or update of album_id, cover_art_url on public.songs
  for each row execute function public.song_uses_album_cover();

-- When an album gets or changes its cover, all its songs follow.
create or replace function public.album_cover_to_songs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.cover_art_url, '') <> '' and new.cover_art_url is distinct from old.cover_art_url then
    update public.songs s set cover_art_url = new.cover_art_url
    where s.album_id = new.id and s.cover_art_url is distinct from new.cover_art_url;
  end if;
  return new;
end $$;

drop trigger if exists albums_cover_to_songs on public.albums;
create trigger albums_cover_to_songs
  after update of cover_art_url on public.albums
  for each row execute function public.album_cover_to_songs();

revoke execute on function public.song_uses_album_cover() from public, anon, authenticated;
revoke execute on function public.album_cover_to_songs() from public, anon, authenticated;

-- Bring existing songs in line now.
update public.songs s set cover_art_url = a.cover_art_url
from public.albums a
where a.id = s.album_id and coalesce(a.cover_art_url, '') <> '' and s.cover_art_url is distinct from a.cover_art_url;
