-- Drop activity left behind by deleted accounts, and keep it clean from now on.
delete from public.daily_activity a where not exists (select 1 from auth.users u where u.id = a.user_id);
alter table public.daily_activity drop constraint if exists daily_activity_user_fk;
alter table public.daily_activity add constraint daily_activity_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
