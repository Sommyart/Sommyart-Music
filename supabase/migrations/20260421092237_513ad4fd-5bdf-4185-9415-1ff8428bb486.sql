-- Recovery codes for PIN reset
CREATE TABLE public.recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_recovery_codes_user_id ON public.recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_hash ON public.recovery_codes(code_hash);

ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;

-- No client-side access; only the edge function (service role) reads/writes.
-- Users can view (but not modify) their own codes for transparency.
CREATE POLICY "Users can view their own recovery codes"
ON public.recovery_codes
FOR SELECT
USING (auth.uid() = user_id);