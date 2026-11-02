-- The database, not each phone or PC, now decides the order and the time of every playback update.
-- This removes the "my clock is a few seconds off" and "two devices picked the same version" problems.
create or replace function public.playback_state_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version := coalesce(old.version, 0) + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists playback_state_stamp on public.playback_state;
create trigger playback_state_stamp before insert or update on public.playback_state
for each row execute function public.playback_state_stamp();

-- Lets each device measure how far its own clock is from the server's.
create or replace function public.server_time() returns timestamptz
language sql stable set search_path = public as $$ select clock_timestamp() $$;
grant execute on function public.server_time() to anon, authenticated;
