-- Allow public (anonymous) read access to songs since app is fully public
DROP POLICY IF EXISTS "Authenticated users can view songs" ON public.songs;

CREATE POLICY "Anyone can view songs"
ON public.songs
FOR SELECT
TO anon, authenticated
USING (true);