-- Create admin_secrets table for secure storage
CREATE TABLE public.admin_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

-- Only admins can manage secrets
CREATE POLICY "Admins can manage secrets" 
  ON public.admin_secrets FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Note: Select is also restricted to admins only.
