-- Create usernames table for anonymous device-based username registration
CREATE TABLE public.usernames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.usernames ENABLE ROW LEVEL SECURITY;

-- Public app: anyone can read (to check uniqueness) and insert (to claim a username)
CREATE POLICY "Anyone can view usernames"
ON public.usernames FOR SELECT
USING (true);

CREATE POLICY "Anyone can claim a username"
ON public.usernames FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_usernames_device_id ON public.usernames(device_id);
CREATE INDEX idx_usernames_username_lower ON public.usernames(LOWER(username));