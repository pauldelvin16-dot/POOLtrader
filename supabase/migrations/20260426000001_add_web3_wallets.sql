-- Create connected_wallets table for storing user wallet connections
CREATE TABLE connected_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_address VARCHAR(255) NOT NULL,
  wallet_type VARCHAR(50) NOT NULL, -- 'metamask', 'trust-wallet', 'walletconnect', 'phantom', 'exodus', 'safepal', 'halo', 'defi-wallet'
  chain_id INTEGER NOT NULL, -- 1 for Ethereum, 56 for BSC, 137 for Polygon, etc.
  is_primary BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  signature VARCHAR(1024), -- For wallet verification signature
  message_signed TEXT, -- The message that was signed for verification
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}', -- Store wallet-specific metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, wallet_address, chain_id)
);

-- Create wallet_transactions table for tracking Web3 transactions
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES connected_wallets(id) ON DELETE CASCADE,
  tx_hash VARCHAR(255) NOT NULL UNIQUE,
  tx_type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'transfer', 'stake'
  amount NUMERIC(20, 8) NOT NULL,
  currency VARCHAR(50) NOT NULL, -- 'ETH', 'USDT', 'USDC', etc.
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  chain_id INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  confirmation_count INTEGER DEFAULT 0,
  gas_price NUMERIC(20, 8),
  gas_used NUMERIC(20, 8),
  fee NUMERIC(20, 8),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wallet_assets table for tracking user token balances
CREATE TABLE wallet_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES connected_wallets(id) ON DELETE CASCADE,
  contract_address VARCHAR(255) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  token_name VARCHAR(255),
  decimals INTEGER DEFAULT 18,
  balance NUMERIC(30, 8) DEFAULT 0,
  balance_usd NUMERIC(20, 2) DEFAULT 0,
  chain_id INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_id, contract_address, chain_id)
);

-- Enable RLS on connected_wallets
ALTER TABLE connected_wallets ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only view their own connected wallets
CREATE POLICY "Users can view their own connected wallets"
  ON connected_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policy: Users can insert their own connected wallets
CREATE POLICY "Users can insert their own connected wallets"
  ON connected_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS policy: Users can update their own connected wallets
CREATE POLICY "Users can update their own connected wallets"
  ON connected_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policy: Users can delete their own connected wallets
CREATE POLICY "Users can delete their own connected wallets"
  ON connected_wallets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on wallet_transactions
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view their own wallet transactions
CREATE POLICY "Users can view their own wallet transactions"
  ON wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policy: Users can insert their own wallet transactions
CREATE POLICY "Users can insert their own wallet transactions"
  ON wallet_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable RLS on wallet_assets
ALTER TABLE wallet_assets ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view their own wallet assets
CREATE POLICY "Users can view their own wallet assets"
  ON wallet_assets
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policy: Users can insert their own wallet assets
CREATE POLICY "Users can insert their own wallet assets"
  ON wallet_assets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS policy: Users can update their own wallet assets
CREATE POLICY "Users can update their own wallet assets"
  ON wallet_assets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add indexes for better query performance
CREATE INDEX idx_connected_wallets_user_id ON connected_wallets(user_id);
CREATE INDEX idx_connected_wallets_wallet_address ON connected_wallets(wallet_address);
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_tx_hash ON wallet_transactions(tx_hash);
CREATE INDEX idx_wallet_assets_user_id ON wallet_assets(user_id);
CREATE INDEX idx_wallet_assets_wallet_id ON wallet_assets(wallet_id);

-- Add column to profiles table to track if wallet connection is mandatory
ALTER TABLE profiles ADD COLUMN wallet_required BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN primary_wallet_id UUID REFERENCES connected_wallets(id) ON DELETE SET NULL;

-- Update trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_connected_wallets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connected_wallets_timestamp_trigger
BEFORE UPDATE ON connected_wallets
FOR EACH ROW
EXECUTE FUNCTION update_connected_wallets_timestamp();

CREATE OR REPLACE FUNCTION update_wallet_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wallet_transactions_timestamp_trigger
BEFORE UPDATE ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_transactions_timestamp();
