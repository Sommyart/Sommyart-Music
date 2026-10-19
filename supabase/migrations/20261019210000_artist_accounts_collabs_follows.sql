-- Artist accounts (admin approved), collaborations, follows, realtime new songs.

-- ---------------------------------------------------------------- columns
alter table public.artists add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table public.artists add column if not exists genre text;
create unique index if not exists artists_owner_user_id_key on public.artists(owner_user_id) where owner_user_id is not null;
alter table public.songs add column if not exists description text;

-- ----------------------------------------------------------- applications
create table if not exists public.artist_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  artist_name text not null check (char_length(btrim(artist_name)) between 2 and 60),
  genre text check (genre is null or char_length(genre) <= 80),
  description text check (description is null or char_length(description) <= 1500),
  image_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_note text,
  artist_id uuid references public.artists(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.artist_applications enable row level security;

create policy "Applicants view own application" on public.artist_applications
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins view applications" on public.artist_applications
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Applicants create own application" on public.artist_applications
  for insert to authenticated with check (
    auth.uid() = user_id and status = 'pending'
    and artist_id is null and admin_note is null and reviewed_at is null
  );
create policy "Applicants edit while pending or rejected" on public.artist_applications
  for update to authenticated
  using (auth.uid() = user_id and status in ('pending','rejected'))
  with check (auth.uid() = user_id and status = 'pending');
create policy "Admins update applications" on public.artist_applications
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete applications" on public.artist_applications
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Applicants can never change the review fields themselves.
create or replace function public.guard_application_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.user_id := old.user_id;
    new.admin_note := old.admin_note;
    new.artist_id := old.artist_id;
    new.reviewed_at := old.reviewed_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger artist_applications_guard before update on public.artist_applications
  for each row execute function public.guard_application_update();

-- ---------------------------------------------------------- ownership test
create or replace function public.is_artist_owner(_artist uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.artists a
    join public.artist_applications p on p.user_id = a.owner_user_id and p.status = 'approved'
    where a.id = _artist and a.owner_user_id = auth.uid()
  )
$$;

-- ----------------------------------------------------------- admin actions
create or replace function public.approve_artist_application(p_application uuid, p_existing_artist uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare app public.artist_applications; aid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  select * into app from public.artist_applications where id = p_application for update;
  if not found then raise exception 'Application not found'; end if;

  if p_existing_artist is not null then
    perform 1 from public.artists where id = p_existing_artist and (owner_user_id is null or owner_user_id = app.user_id);
    if not found then raise exception 'That artist profile already belongs to another account'; end if;
    update public.artists set
      owner_user_id = app.user_id,
      bio = coalesce(nullif(bio, ''), app.description),
      image_url = coalesce(image_url, app.image_url),
      genre = coalesce(genre, app.genre),
      updated_at = now()
    where id = p_existing_artist;
    aid := p_existing_artist;
  elsif exists (select 1 from public.artists where owner_user_id = app.user_id) then
    select id into aid from public.artists where owner_user_id = app.user_id;
  else
    if exists (select 1 from public.artists where lower(name) = lower(btrim(app.artist_name))) then
      raise exception 'An artist named "%" already exists. Choose "Use existing profile" or ask them to pick another name.', app.artist_name;
    end if;
    insert into public.artists (name, bio, image_url, genre, owner_user_id)
    values (btrim(app.artist_name), app.description, app.image_url, app.genre, app.user_id)
    returning id into aid;
  end if;

  update public.artist_applications
    set status = 'approved', artist_id = aid, reviewed_at = now(), admin_note = null
    where id = p_application;
  return aid;
end $$;

create or replace function public.reject_artist_application(p_application uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  update public.artist_applications
    set status = 'rejected', admin_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now()
    where id = p_application and status in ('pending','rejected');
  if not found then raise exception 'Only waiting applications can be rejected'; end if;
end $$;

create or replace function public.set_artist_access(p_application uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  update public.artist_applications
    set status = case when p_active then 'approved' else 'suspended' end, reviewed_at = now()
    where id = p_application and status in ('approved','suspended');
  if not found then raise exception 'Only approved artists can be paused or restored'; end if;
end $$;

revoke all on function public.approve_artist_application(uuid, uuid) from public, anon;
revoke all on function public.reject_artist_application(uuid, text) from public, anon;
revoke all on function public.set_artist_access(uuid, boolean) from public, anon;
grant execute on function public.approve_artist_application(uuid, uuid) to authenticated;
grant execute on function public.reject_artist_application(uuid, text) to authenticated;
grant execute on function public.set_artist_access(uuid, boolean) to authenticated;
revoke all on function public.is_artist_owner(uuid) from public, anon;
grant execute on function public.is_artist_owner(uuid) to authenticated;

-- ------------------------------------------------- artists edit own profile
create policy "Approved artists update own profile" on public.artists
  for update to authenticated
  using (owner_user_id = auth.uid() and public.is_artist_owner(id))
  with check (owner_user_id = auth.uid() and public.is_artist_owner(id));

create or replace function public.guard_artist_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.name := old.name;
    new.owner_user_id := old.owner_user_id;
  end if;
  return new;
end $$;
create trigger artists_guard before update on public.artists
  for each row execute function public.guard_artist_update();

-- --------------------------------------- artists publish their own songs
create policy "Approved artists add own songs" on public.songs
  for insert to authenticated with check (
    public.is_artist_owner(artist_id)
    and artist = (select a.name from public.artists a where a.id = songs.artist_id)
    and (album_id is null or exists (select 1 from public.albums al where al.id = songs.album_id and al.artist_id = songs.artist_id))
  );
create policy "Approved artists edit own songs" on public.songs
  for update to authenticated
  using (public.is_artist_owner(artist_id))
  with check (
    public.is_artist_owner(artist_id)
    and artist = (select a.name from public.artists a where a.id = songs.artist_id)
    and (album_id is null or exists (select 1 from public.albums al where al.id = songs.album_id and al.artist_id = songs.artist_id))
  );

create policy "Approved artists add own albums" on public.albums
  for insert to authenticated with check (
    public.is_artist_owner(artist_id)
    and artist_name = (select a.name from public.artists a where a.id = albums.artist_id)
  );
create policy "Approved artists edit own albums" on public.albums
  for update to authenticated
  using (public.is_artist_owner(artist_id))
  with check (
    public.is_artist_owner(artist_id)
    and artist_name = (select a.name from public.artists a where a.id = albums.artist_id)
  );

-- ---------------------------------------------------------- collaborations
create table if not exists public.song_artists (
  song_id uuid not null references public.songs(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (song_id, artist_id)
);
create index if not exists song_artists_artist_idx on public.song_artists(artist_id);
alter table public.song_artists enable row level security;

create policy "Anyone can view collaborations" on public.song_artists
  for select to anon, authenticated using (true);
create policy "Admins manage collaborations" on public.song_artists
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Artists tag collaborators on own songs" on public.song_artists
  for insert to authenticated with check (
    exists (select 1 from public.songs s where s.id = song_artists.song_id and public.is_artist_owner(s.artist_id))
  );
create policy "Artists remove collaborators on own songs" on public.song_artists
  for delete to authenticated using (
    exists (select 1 from public.songs s where s.id = song_artists.song_id and public.is_artist_owner(s.artist_id))
  );

-- ----------------------------------------------------------------- follows
create table if not exists public.artist_follows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index if not exists artist_follows_artist_idx on public.artist_follows(artist_id);
alter table public.artist_follows enable row level security;
create policy "Users see their follows" on public.artist_follows
  for select to authenticated using (auth.uid() = user_id);
create policy "Users follow artists" on public.artist_follows
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users unfollow artists" on public.artist_follows
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.artist_follower_count(p_artist uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.artist_follows where artist_id = p_artist
$$;
grant execute on function public.artist_follower_count(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ storage
update storage.buckets set file_size_limit = 62914560 where id = 'music';
update storage.buckets set file_size_limit = 15728640 where id = 'covers';

-- Counts via a definer function because ordinary users cannot read storage.objects.
create or replace function public.count_application_uploads(_uid uuid) returns integer
language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'covers' and o.name like 'applications/' || _uid::text || '/%'
$$;
revoke all on function public.count_application_uploads(uuid) from public, anon;
grant execute on function public.count_application_uploads(uuid) to authenticated;

create policy "Applicants upload their profile picture" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = 'applications'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.count_application_uploads(auth.uid()) < 8
  );
create policy "Approved artists upload to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('music', 'covers')
    and (storage.foldername(name))[1] = 'artists'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from public.artist_applications p where p.user_id = auth.uid() and p.status = 'approved')
  );

-- ----------------------------------------------------- realtime new songs
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'songs') then
    alter publication supabase_realtime add table public.songs;
  end if;
end $$;
