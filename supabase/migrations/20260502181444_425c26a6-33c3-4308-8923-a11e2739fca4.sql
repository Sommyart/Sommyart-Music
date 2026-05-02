ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics jsonb;

CREATE POLICY "Admins can update songs"
ON public.songs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));