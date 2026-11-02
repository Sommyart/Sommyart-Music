-- playback_state.song_id is a uuid, so songs bundled with the app (ids like "k2") could not be shared
-- between devices: the other device was told the position but not which song. track_id keeps any id.
alter table public.playback_state add column if not exists track_id text;
