-- These two functions only run as triggers; nobody should be able to call them over the API.
revoke execute on function public.notify_songs_published() from public, anon, authenticated;
revoke execute on function public.playback_commands_tidy() from public, anon, authenticated;
