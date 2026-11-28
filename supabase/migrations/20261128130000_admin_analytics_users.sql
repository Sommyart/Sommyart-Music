-- Studio analytics: also list who was active (admin only, same function).

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
    'active_users', (
      select coalesce(jsonb_agg(u), '[]'::jsonb) from (
        select coalesce(p.username, 'unknown') as username, p.display_name,
               max(a.day) as last_active, count(*) as days_active, bool_or(a.day = today) as active_today
        from public.daily_activity a
        left join public.profiles p on p.user_id = a.user_id
        where a.day > today - n
        group by a.user_id, p.username, p.display_name
        order by max(a.day) desc, count(*) desc, p.username
        limit 200
      ) u
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
