-- Create pool_addresses table for the automated sweep feature
CREATE TABLE public.pool_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  network TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETH',
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network) -- Only one active pool receiver per network for simplicity
);

ALTER TABLE public.pool_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pool addresses" 
  ON public.pool_addresses FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Admins can manage pool addresses" 
  ON public.pool_addresses FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pool_addresses_updated_at 
  BEFORE UPDATE ON public.pool_addresses 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
