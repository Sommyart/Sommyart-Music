-- Studio analytics: who was active on which day, plus one admin-only report function.

create table if not exists public.daily_activity (
  user_id uuid not null,
  day date not null,
  primary key (user_id, day)
);
create index if not exists daily_activity_day_idx on public.daily_activity (day);

-- Nobody reads this table directly; the report function below is the only way in.
alter table public.daily_activity enable row level security;

-- Days are counted in Nigerian time so "today" matches the owner's day.
create or replace function public.log_daily_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t timestamptz;
begin
  if tg_table_name = 'devices' then t := new.last_seen_at; else t := new.played_at; end if;
  if new.user_id is not null and t is not null then
    insert into public.daily_activity (user_id, day)
    values (new.user_id, (t at time zone 'Africa/Lagos')::date)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists devices_log_activity on public.devices;
create trigger devices_log_activity after insert or update of last_seen_at on public.devices
  for each row execute function public.log_daily_activity();

drop trigger if exists plays_log_activity on public.recently_played;
create trigger plays_log_activity after insert or update of played_at on public.recently_played
  for each row execute function public.log_daily_activity();

-- Backfill from what already exists.
insert into public.daily_activity (user_id, day)
select user_id, (played_at at time zone 'Africa/Lagos')::date from public.recently_played
where user_id is not null and played_at is not null
union
select user_id, (last_seen_at at time zone 'Africa/Lagos')::date from public.devices
where user_id is not null and last_seen_at is not null
on conflict do nothing;

create or replace function public.admin_analytics(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  n int := greatest(7, least(coalesce(p_days, 30), 90));
  out jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admins only';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'dau', (select count(distinct user_id) from public.daily_activity where day = today),
    'wau', (select count(distinct user_id) from public.daily_activity where day > today - 7),
    'mau', (select count(distinct user_id) from public.daily_activity where day > today - 30),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'tracked_since', (select min(day) from public.daily_activity),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'active', (select count(*) from public.daily_activity a where a.day = d.day),
        'signups', (select count(*) from public.profiles p where (p.created_at at time zone 'Africa/Lagos')::date = d.day)
      ) order by d.day), '[]'::jsonb)
      from (select generate_series(today - (n - 1), today, interval '1 day')::date as day) d
    ),
    'top_songs', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select s.title, s.artist, count(*) as plays, count(distinct r.user_id) as listeners
        from public.recently_played r join public.songs s on s.id = r.song_id
        where r.played_at > now() - make_interval(days => n)
        group by s.id, s.title, s.artist order by plays desc, s.title limit 10
      ) t
    )
  ) into out;
  return out;
end $$;

revoke all on function public.admin_analytics(int) from public, anon;
grant execute on function public.admin_analytics(int) to authenticated;
