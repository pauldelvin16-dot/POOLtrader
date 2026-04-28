-- Sweep Functionality Enhancements and Fixes
-- Adds proper sweep tracking, eligibility checking, and error handling

-- Enhance sweep_notifications table
ALTER TABLE sweep_notifications
ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES connected_wallets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN DEFAULT false;

-- Create sweep_eligibility table for tracking sweep status
CREATE TABLE IF NOT EXISTS sweep_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES connected_wallets(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE SET NULL,
  is_eligible BOOLEAN DEFAULT false,
  reasons TEXT[],
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  eligible_amount NUMERIC(20, 6) DEFAULT 0,
  
  CONSTRAINT unique_sweep_eligibility UNIQUE(user_id, wallet_id, pool_id)
);

CREATE INDEX IF NOT EXISTS idx_sweep_eligibility_user ON sweep_eligibility(user_id, is_eligible);
CREATE INDEX IF NOT EXISTS idx_sweep_eligibility_wallet ON sweep_eligibility(wallet_id, is_eligible);

-- Create sweep_history table for comprehensive tracking
CREATE TABLE IF NOT EXISTS sweep_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES connected_wallets(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE SET NULL,
  sweep_type VARCHAR(50) DEFAULT 'manual' CHECK (sweep_type IN ('manual', 'auto', 'scheduled')),
  sweep_status VARCHAR(20) DEFAULT 'pending' CHECK (sweep_status IN ('pending', 'initiated', 'processing', 'success', 'failed', 'cancelled')),
  amount_swept NUMERIC(20, 6),
  currency VARCHAR(10),
  token_address VARCHAR(255),
  chain_id INTEGER,
  transaction_hash VARCHAR(255),
  error_message TEXT,
  gas_used NUMERIC(20, 6),
  gas_price NUMERIC(20, 6),
  total_cost NUMERIC(20, 6),
  pool_joined BOOLEAN DEFAULT false,
  pool_contribution NUMERIC(20, 6),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT fk_sweep_history_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sweep_history_user ON sweep_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sweep_history_wallet ON sweep_history(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sweep_history_status ON sweep_history(sweep_status);
CREATE INDEX IF NOT EXISTS idx_sweep_history_pool ON sweep_history(pool_id);
CREATE INDEX IF NOT EXISTS idx_sweep_history_tx_hash ON sweep_history(transaction_hash) WHERE transaction_hash IS NOT NULL;

-- Enable RLS
ALTER TABLE sweep_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE sweep_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sweep eligibility"
ON sweep_eligibility FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sweep history"
ON sweep_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sweep data"
ON sweep_eligibility FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can view all sweep history"
ON sweep_history FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');

-- Function to check sweep eligibility
CREATE OR REPLACE FUNCTION check_sweep_eligibility(
  p_user_id UUID,
  p_wallet_id UUID,
  p_pool_id UUID DEFAULT NULL
)
RETURNS TABLE(
  is_eligible BOOLEAN,
  eligible_amount NUMERIC,
  reasons TEXT[],
  required_balance NUMERIC,
  current_balance NUMERIC,
  current_allowance NUMERIC
) AS $$
DECLARE
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_is_eligible BOOLEAN := true;
  v_wallet RECORD;
  v_pool RECORD;
BEGIN
  -- Get wallet data
  SELECT * INTO v_wallet FROM connected_wallets 
  WHERE id = p_wallet_id AND user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, ARRAY['Wallet not found']::TEXT[], 
      0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Check wallet status
  IF NOT v_wallet.verified THEN
    v_reasons := array_append(v_reasons, 'Wallet not verified');
    v_is_eligible := false;
  END IF;
  
  IF NOT v_wallet.is_active THEN
    v_reasons := array_append(v_reasons, 'Wallet is inactive');
    v_is_eligible := false;
  END IF;
  
  -- Check allowance
  IF COALESCE(v_wallet.allowance_amount::numeric, 0) <= 0 THEN
    v_reasons := array_append(v_reasons, 'No token allowance granted');
    v_is_eligible := false;
  END IF;
  
  -- Get pool data if provided
  IF p_pool_id IS NOT NULL THEN
    SELECT * INTO v_pool FROM pools WHERE id = p_pool_id;
    
    IF v_pool IS NULL THEN
      v_reasons := array_append(v_reasons, 'Pool not found');
      v_is_eligible := false;
    ELSIF v_pool.status != 'open' THEN
      v_reasons := array_append(v_reasons, 'Pool is not open');
      v_is_eligible := false;
    END IF;
  END IF;
  
  -- Set minimum sweep amount (e.g., $10 worth)
  RETURN QUERY SELECT v_is_eligible,
    COALESCE(v_wallet.allowance_amount::numeric, 0),
    v_reasons,
    10::NUMERIC,
    COALESCE(v_wallet.allowance_amount::numeric, 0),
    COALESCE(v_wallet.allowance_amount::numeric, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update sweep eligibility cache
CREATE OR REPLACE FUNCTION update_sweep_eligibility_cache(p_user_id UUID)
RETURNS TABLE(
  updated_count INTEGER
) AS $$
DECLARE
  v_count INTEGER := 0;
  v_wallet RECORD;
  v_eligibility RECORD;
BEGIN
  -- Clear old eligibility data
  DELETE FROM sweep_eligibility 
  WHERE user_id = p_user_id 
  AND last_checked < NOW() - INTERVAL '1 hour';
  
  -- Update eligibility for all wallets
  FOR v_wallet IN 
    SELECT id FROM connected_wallets 
    WHERE user_id = p_user_id AND is_active = true
  LOOP
    SELECT * INTO v_eligibility FROM check_sweep_eligibility(p_user_id, v_wallet.id);
    
    INSERT INTO sweep_eligibility(user_id, wallet_id, is_eligible, eligible_amount)
    VALUES(p_user_id, v_wallet.id, v_eligibility.is_eligible, v_eligibility.eligible_amount)
    ON CONFLICT (user_id, wallet_id, pool_id) DO UPDATE
    SET is_eligible = EXCLUDED.is_eligible,
        eligible_amount = EXCLUDED.eligible_amount,
        last_checked = NOW();
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log sweep transaction
CREATE OR REPLACE FUNCTION log_sweep_transaction(
  p_user_id UUID,
  p_wallet_id UUID,
  p_pool_id UUID,
  p_amount NUMERIC,
  p_currency VARCHAR,
  p_tx_hash VARCHAR,
  p_chain_id INTEGER,
  p_pool_joined BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  INSERT INTO sweep_history(
    user_id, wallet_id, pool_id, amount_swept, currency,
    transaction_hash, chain_id, sweep_status, pool_joined
  )
  VALUES(
    p_user_id, p_wallet_id, p_pool_id, p_amount, p_currency,
    p_tx_hash, p_chain_id, 'success', p_pool_joined
  );
  
  -- Log activity
  PERFORM log_wallet_activity(
    p_user_id,
    p_wallet_id,
    CASE WHEN p_pool_joined THEN 'sweep_success' ELSE 'sweep_initiated' END,
    p_chain_id,
    p_tx_hash,
    jsonb_build_object(
      'amount', p_amount,
      'currency', p_currency,
      'pool_id', p_pool_id,
      'pool_joined', p_pool_joined
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sweep statistics
CREATE OR REPLACE FUNCTION get_sweep_stats(p_user_id UUID)
RETURNS TABLE(
  total_sweeps BIGINT,
  successful_sweeps BIGINT,
  failed_sweeps BIGINT,
  total_amount_swept NUMERIC,
  pools_joined BIGINT,
  avg_sweep_amount NUMERIC,
  last_sweep TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE sweep_status = 'success')::BIGINT,
    COUNT(*) FILTER (WHERE sweep_status = 'failed')::BIGINT,
    COALESCE(SUM(amount_swept), 0),
    COUNT(*) FILTER (WHERE pool_joined = true)::BIGINT,
    COALESCE(AVG(amount_swept) FILTER (WHERE sweep_status = 'success'), 0),
    MAX(completed_at)
  FROM sweep_history
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_sweep_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION update_sweep_eligibility_cache TO authenticated;
GRANT EXECUTE ON FUNCTION log_sweep_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_sweep_stats TO authenticated;
