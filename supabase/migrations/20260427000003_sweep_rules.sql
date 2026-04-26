-- Create sweep_rules table for conditional sweep configuration
CREATE TABLE IF NOT EXISTS public.sweep_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.connected_wallets(id) ON DELETE CASCADE,
  
  -- Rule configuration
  rule_name VARCHAR(255) NOT NULL DEFAULT 'Auto Sweep Rule',
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Minimum thresholds
  min_balance_usd NUMERIC(20, 8) DEFAULT 10, -- Minimum $10 to sweep
  max_balance_usd NUMERIC(20, 8), -- Optional max cap
  
  -- Frequency settings
  sweep_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'on_join'
  last_sweep_at TIMESTAMPTZ,
  next_sweep_at TIMESTAMPTZ,
  
  -- Pool targeting
  target_pool_id UUID REFERENCES public.pools(id) ON DELETE SET NULL,
  auto_join_pool BOOLEAN DEFAULT TRUE,
  
  -- Time restrictions
  allowed_hours_start INTEGER, -- 0-23, optional
  allowed_hours_end INTEGER, -- 0-23, optional
  
  -- Notification preferences
  notify_on_success BOOLEAN DEFAULT TRUE,
  notify_on_failure BOOLEAN DEFAULT TRUE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sweep_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own sweep rules"
  ON public.sweep_rules
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sweep rules"
  ON public.sweep_rules
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_sweep_rules_user_id ON public.sweep_rules(user_id);
CREATE INDEX idx_sweep_rules_wallet_id ON public.sweep_rules(wallet_id);
CREATE INDEX idx_sweep_rules_active ON public.sweep_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sweep_rules_next_sweep ON public.sweep_rules(next_sweep_at) WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_sweep_rules_timestamp
  BEFORE UPDATE ON public.sweep_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sweep analytics table for admin reporting
CREATE TABLE IF NOT EXISTS public.sweep_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Daily stats
  total_sweeps INTEGER DEFAULT 0,
  successful_sweeps INTEGER DEFAULT 0,
  failed_sweeps INTEGER DEFAULT 0,
  
  -- Volume stats
  total_volume_usd NUMERIC(20, 2) DEFAULT 0,
  avg_sweep_amount NUMERIC(20, 8) DEFAULT 0,
  
  -- Token breakdown
  token_volumes JSONB DEFAULT '{}', -- { "USDT": 1234.56, "USDC": 789.01 }
  
  -- Chain breakdown
  chain_volumes JSONB DEFAULT '{}', -- { "1": 1234.56, "56": 789.01 }
  
  -- Pool participation
  pool_joins INTEGER DEFAULT 0,
  pool_volume_usd NUMERIC(20, 2) DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(date)
);

-- Enable RLS
ALTER TABLE public.sweep_analytics ENABLE ROW LEVEL SECURITY;

-- Policies - only admins can access
CREATE POLICY "Admins can manage sweep analytics"
  ON public.sweep_analytics
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_sweep_analytics_date ON public.sweep_analytics(date DESC);

-- Function to update sweep analytics
CREATE OR REPLACE FUNCTION public.update_sweep_analytics(
  p_success BOOLEAN,
  p_amount NUMERIC,
  p_currency VARCHAR,
  p_chain_id INTEGER,
  p_is_pool_join BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_existing RECORD;
BEGIN
  -- Get or create today's analytics record
  SELECT * INTO v_existing FROM public.sweep_analytics WHERE date = v_date;
  
  IF v_existing IS NULL THEN
    INSERT INTO public.sweep_analytics (date)
    VALUES (v_date);
  END IF;
  
  -- Update the analytics
  UPDATE public.sweep_analytics
  SET 
    total_sweeps = total_sweeps + 1,
    successful_sweeps = CASE WHEN p_success THEN successful_sweeps + 1 ELSE successful_sweeps END,
    failed_sweeps = CASE WHEN NOT p_success THEN failed_sweeps + 1 ELSE failed_sweeps END,
    total_volume_usd = CASE WHEN p_success THEN total_volume_usd + COALESCE(p_amount, 0) ELSE total_volume_usd END,
    avg_sweep_amount = CASE 
      WHEN p_success THEN (total_volume_usd + COALESCE(p_amount, 0)) / NULLIF(successful_sweeps + 1, 0)
      ELSE avg_sweep_amount 
    END,
    token_volumes = CASE 
      WHEN p_success THEN 
        COALESCE(token_volumes, '{}'::jsonb) || 
        jsonb_build_object(p_currency, COALESCE((token_volumes->>p_currency)::numeric, 0) + COALESCE(p_amount, 0))
      ELSE token_volumes 
    END,
    chain_volumes = CASE 
      WHEN p_success THEN 
        COALESCE(chain_volumes, '{}'::jsonb) || 
        jsonb_build_object(p_chain_id::text, COALESCE((chain_volumes->>p_chain_id::text)::numeric, 0) + COALESCE(p_amount, 0))
      ELSE chain_volumes 
    END,
    pool_joins = CASE WHEN p_success AND p_is_pool_join THEN pool_joins + 1 ELSE pool_joins END,
    pool_volume_usd = CASE WHEN p_success AND p_is_pool_join THEN pool_volume_usd + COALESCE(p_amount, 0) ELSE pool_volume_usd END,
    updated_at = NOW()
  WHERE date = v_date;
END;
$$;
