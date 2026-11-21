-- Announcements can scroll across the top of the home screen until this time.
alter table public.app_notifications add column if not exists show_until timestamptz;
create index if not exists app_notifications_ticker_idx on public.app_notifications (show_until) where kind = 'announcement';
