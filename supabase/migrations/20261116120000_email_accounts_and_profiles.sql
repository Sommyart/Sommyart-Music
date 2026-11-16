-- Profiles gain a display name and a photo, and people who sign up with an
-- email address get a profile row the same way username-and-PIN accounts do.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles
  add constraint profiles_display_name_len
  check (display_name is null or char_length(display_name) between 1 and 40);

-- Photos are only ever stored in the avatars folder of the music storage.
alter table public.profiles drop constraint if exists profiles_avatar_url_shape;
alter table public.profiles
  add constraint profiles_avatar_url_shape
  check (avatar_url is null or avatar_url ~ '^https://[^[:space:]]+/avatars/[^[:space:]]+$');

-- Returns the caller's profile, creating it first when it is missing.
-- Email accounts have no username of their own, so one is made from the part
-- of the address before the @ plus a few random characters (the suffix keeps
-- plain usernames free for username-and-PIN sign-ups).
create or replace function public.ensure_my_profile(p_display_name text default null)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_email text;
  v_meta_name text;
  clean_name text;
  base text;
  candidate text;
  result public.profiles;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select u.email, u.raw_user_meta_data ->> 'display_name'
    into v_email, v_meta_name
    from auth.users u where u.id = uid;

  clean_name := nullif(left(btrim(coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), v_meta_name, '')), 40), '');

  select * into result from public.profiles p where p.user_id = uid;
  if found then
    if result.display_name is null and clean_name is not null then
      update public.profiles p set display_name = clean_name where p.user_id = uid returning * into result;
    end if;
    return result;
  end if;

  base := left(regexp_replace(lower(split_part(coalesce(v_email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g'), 12);
  if char_length(base) < 3 then
    base := 'user';
  end if;

  for i in 1..8 loop
    candidate := base || '_' || substr(md5(gen_random_uuid()::text), 1, 5);
    begin
      insert into public.profiles (user_id, username, display_name)
        values (uid, candidate, clean_name)
        returning * into result;
      exit;
    exception when unique_violation then
      -- Either the username is taken (try another) or the profile was made a moment ago elsewhere.
      select * into result from public.profiles p where p.user_id = uid;
      if found then
        exit;
      end if;
    end;
  end loop;

  if result.user_id is null then
    raise exception 'Could not create the profile';
  end if;

  insert into public.user_roles (user_id, role) values (uid, 'user')
    on conflict (user_id, role) do nothing;

  return result;
end;
$$;

revoke execute on function public.ensure_my_profile(text) from public, anon;
grant execute on function public.ensure_my_profile(text) to authenticated;
