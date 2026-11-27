-- Publish a scheduled release straight away (Studio "Publish now" button).
create or replace function public.release_schedule_now(p_id uuid) returns text
language plpgsql security definer set search_path = public, private as $$
declare a uuid; st text; e text;
begin
  select artist_id into a from public.scheduled_releases where id = p_id and status = 'pending';
  if a is null then raise exception 'This release is no longer waiting'; end if;
  if not (public.has_role(auth.uid(), 'admin') or public.is_artist_owner(a)) then raise exception 'Not allowed'; end if;
  update public.scheduled_releases set release_at = now() where id = p_id;
  perform private.release_due_schedules();
  select status, error into st, e from public.scheduled_releases where id = p_id;
  if st = 'failed' then raise exception 'Publish failed: %', e; end if;
  return st;
end $$;
revoke all on function public.release_schedule_now(uuid) from public, anon;
grant execute on function public.release_schedule_now(uuid) to authenticated;
