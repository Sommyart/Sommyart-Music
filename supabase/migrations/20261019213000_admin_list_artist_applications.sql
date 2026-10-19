-- Lets the Studio admin see who applied (usernames live in profiles, which admins cannot read directly).
create or replace function public.admin_list_artist_applications()
returns table (
  id uuid, user_id uuid, username text, artist_name text, genre text, description text, image_url text,
  status text, admin_note text, artist_id uuid, created_at timestamptz, reviewed_at timestamptz, song_count integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  return query
    select p.id, p.user_id, pr.username, p.artist_name, p.genre, p.description, p.image_url,
           p.status, p.admin_note, p.artist_id, p.created_at, p.reviewed_at,
           (select count(*)::int from public.songs s where s.artist_id = p.artist_id and p.artist_id is not null)
    from public.artist_applications p
    left join public.profiles pr on pr.user_id = p.user_id
    order by case p.status when 'pending' then 0 else 1 end, p.created_at desc;
end $$;
revoke all on function public.admin_list_artist_applications() from public, anon;
grant execute on function public.admin_list_artist_applications() to authenticated;
