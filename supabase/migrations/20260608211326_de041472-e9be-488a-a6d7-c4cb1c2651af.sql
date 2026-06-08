
-- 1. Drop unused legacy usernames table (anonymous insert vulnerability)
DROP TABLE IF EXISTS public.usernames CASCADE;

-- 2. Restrict execution of SECURITY DEFINER has_role function
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 3. Storage: replace broad SELECT policies with no-op (public URLs still work via /object/public/ endpoint, but listing is blocked)
DROP POLICY IF EXISTS "Public read access for covers" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for music" ON storage.objects;

-- 4. Storage: explicit admin-only UPDATE/DELETE policies for music and covers
CREATE POLICY "Admins can update music"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'music' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'music' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete music"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'music' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'));
