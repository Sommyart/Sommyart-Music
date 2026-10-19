-- Push notifications (Firebase Cloud Messaging) for new songs.

-- One row per phone. Nobody reads or writes this table directly; the app uses the two functions below.
create table if not exists public.device_push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  mode text not null default 'all' check (mode in ('all','following','off')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_push_tokens_user_idx on public.device_push_tokens(user_id);
alter table public.device_push_tokens enable row level security;

create or replace function public.register_push_token(p_token text, p_mode text default 'all', p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then raise exception 'Bad token'; end if;
  insert into public.device_push_tokens (token, user_id, mode, platform)
  values (p_token, auth.uid(), case when p_mode in ('all','following','off') then p_mode else 'all' end, left(coalesce(p_platform, 'android'), 20))
  on conflict (token) do update
    set user_id = auth.uid(),
        mode = excluded.mode,
        platform = excluded.platform,
        updated_at = now();
end $$;

-- A phone can always forget its own token (needed when someone signs out). The token is a long secret only that phone knows.
create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.device_push_tokens where token = p_token;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
revoke all on function public.unregister_push_token(text) from public;
grant execute on function public.unregister_push_token(text) to anon, authenticated;

-- Songs already announced, so a retry never sends twice.
create table if not exists public.push_sent_songs (
  song_id uuid primary key,
  sent_at timestamptz not null default now()
);
alter table public.push_sent_songs enable row level security;

-- Secret shared with the sender function. Lives in a schema the API does not expose.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.push_config (key text primary key, value text not null);
revoke all on private.push_config from public, anon, authenticated;

-- One call per insert statement, so an album of 12 songs sends one push, not twelve.
create or replace function private.notify_new_songs() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare ids uuid[]; secret text;
begin
  begin
    select array_agg(id) into ids from new_rows;
    select value into secret from private.push_config where key = 'webhook_secret';
    if ids is not null and secret is not null then
      perform net.http_post(
        url := 'https://biksluembwawllqdalct.supabase.co/functions/v1/send-new-song-push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
        body := jsonb_build_object('song_ids', ids),
        timeout_milliseconds := 20000
      );
    end if;
  exception when others then
    -- Never let a notification problem block publishing a song.
    null;
  end;
  return null;
end $$;

drop trigger if exists songs_push_notify on public.songs;
create trigger songs_push_notify after insert on public.songs
  referencing new table as new_rows
  for each statement execute function private.notify_new_songs();
