-- A username-and-PIN account that adds an email keeps its PIN. The PIN is then
-- checked here instead of being the account password, so both ways of signing in work.
create table if not exists public.pin_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pin_credentials enable row level security;
revoke all on table public.pin_credentials from public, anon, authenticated;

create or replace function public.pin_set(p_user uuid, p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be 4 digits'; end if;
  insert into public.pin_credentials (user_id, pin_hash)
    values (p_user, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end $$;

-- Returns ok, wrong, locked (too many wrong tries) or none (this account's PIN is not kept here).
create or replace function public.pin_check(p_user uuid, p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare c public.pin_credentials;
begin
  select * into c from public.pin_credentials where user_id = p_user for update;
  if not found then return 'none'; end if;
  if c.locked_until is not null and c.locked_until > now() then return 'locked'; end if;
  if c.pin_hash = extensions.crypt(coalesce(p_pin, ''), c.pin_hash) then
    update public.pin_credentials set failed_attempts = 0, locked_until = null where user_id = p_user;
    return 'ok';
  end if;
  if c.failed_attempts + 1 >= 5 then
    update public.pin_credentials set failed_attempts = 0, locked_until = now() + interval '15 minutes' where user_id = p_user;
  else
    update public.pin_credentials set failed_attempts = c.failed_attempts + 1 where user_id = p_user;
  end if;
  return 'wrong';
end $$;

revoke execute on function public.pin_set(uuid, text) from public, anon, authenticated;
revoke execute on function public.pin_check(uuid, text) from public, anon, authenticated;
grant execute on function public.pin_set(uuid, text) to service_role;
grant execute on function public.pin_check(uuid, text) to service_role;

-- Lets the app know whether the signed-in person can sign in with a username and PIN.
create or replace function public.has_pin_login()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.pin_credentials c where c.user_id = auth.uid())
    or exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) like '%@sommyart.app')
  );
$$;
revoke execute on function public.has_pin_login() from public, anon;
grant execute on function public.has_pin_login() to authenticated;
