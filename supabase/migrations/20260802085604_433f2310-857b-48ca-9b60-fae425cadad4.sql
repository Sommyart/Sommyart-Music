CREATE TABLE public.artists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  bio text,
  image_url text,
  origin text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artists TO authenticated;
GRANT ALL ON public.artists TO service_role;

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artists" ON public.artists FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert artists" ON public.artists FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update artists" ON public.artists FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete artists" ON public.artists FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.albums (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  artist_name text NOT NULL,
  cover_art_url text,
  description text,
  genre text,
  released_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.albums TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT ALL ON public.albums TO service_role;

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view albums" ON public.albums FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert albums" ON public.albums FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update albums" ON public.albums FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete albums" ON public.albums FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.songs
  ADD COLUMN album_id uuid REFERENCES public.albums(id) ON DELETE SET NULL,
  ADD COLUMN track_number integer,
  ADD COLUMN artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL;

CREATE INDEX idx_songs_album_id ON public.songs(album_id);
CREATE INDEX idx_songs_artist_id ON public.songs(artist_id);
CREATE INDEX idx_albums_artist_id ON public.albums(artist_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON public.artists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();