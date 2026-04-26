-- Multi-chain private key support
-- Allows different pool wallets per chain for enhanced security and flexibility

-- Add chain_id column to admin_secrets for chain-specific keys
ALTER TABLE public.admin_secrets 
ADD COLUMN IF NOT EXISTS chain_id INTEGER,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create unique constraint for chain-specific keys
-- This allows: POOL_WALLET_PRIVATE_KEY (default) and POOL_WALLET_PRIVATE_KEY_137 (polygon)
DROP INDEX IF EXISTS idx_admin_secrets_key_name;
CREATE UNIQUE INDEX idx_admin_secrets_key_chain 
ON public.admin_secrets(key_name, COALESCE(chain_id, 0));

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_admin_secrets_chain_lookup 
ON public.admin_secrets(chain_id) 
WHERE chain_id IS NOT NULL;

-- Function to get private key for a specific chain
CREATE OR REPLACE FUNCTION public.get_chain_private_key(p_chain_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_default_key TEXT;
BEGIN
  -- Try to get chain-specific key first
  SELECT key_value INTO v_key
  FROM public.admin_secrets
  WHERE key_name = 'POOL_WALLET_PRIVATE_KEY_' || p_chain_id::text
  LIMIT 1;
  
  -- If no chain-specific key, fall back to default
  IF v_key IS NULL THEN
    SELECT key_value INTO v_default_key
    FROM public.admin_secrets
    WHERE key_name = 'POOL_WALLET_PRIVATE_KEY'
    LIMIT 1;
    
    RETURN v_default_key;
  END IF;
  
  RETURN v_key;
END;
$$;

-- Function to get pool wallet address for a chain
CREATE OR REPLACE FUNCTION public.get_chain_pool_address(p_chain_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_address TEXT;
BEGIN
  -- Get the private key for this chain
  v_key := public.get_chain_private_key(p_chain_id);
  
  IF v_key IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the pool address for this chain (stored in pool_addresses table)
  SELECT address INTO v_address
  FROM public.pool_addresses
  WHERE chain_id = p_chain_id AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_address;
END;
$$;

-- Add policy for admins to manage multi-chain keys
CREATE POLICY "Admins can manage chain-specific keys"
  ON public.admin_secrets
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create view for admin key management
CREATE OR REPLACE VIEW public.admin_chain_keys AS
SELECT 
  key_name,
  chain_id,
  description,
  CASE 
    WHEN key_value IS NOT NULL THEN 'configured'
    ELSE 'missing'
  END as status,
  created_at,
  updated_at
FROM public.admin_secrets
WHERE key_name LIKE 'POOL_WALLET_PRIVATE_KEY%'
ORDER BY 
  CASE WHEN chain_id IS NULL THEN 0 ELSE 1 END,
  COALESCE(chain_id, 0);

-- Grant access to the view
GRANT SELECT ON public.admin_chain_keys TO authenticated;
