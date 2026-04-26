-- Add last_swept_at column to connected_wallets for tracking auto-sweep
ALTER TABLE public.connected_wallets ADD COLUMN IF NOT EXISTS last_swept_at TIMESTAMPTZ;

-- Add index for efficient querying of wallets needing sweep
CREATE INDEX IF NOT EXISTS idx_connected_wallets_allowance 
  ON public.connected_wallets(allowance_amount) 
  WHERE allowance_amount > 0;

-- Add index for last_swept_at (partial index for NULL values - wallets never swept)
CREATE INDEX IF NOT EXISTS idx_connected_wallets_never_swept 
  ON public.connected_wallets(user_id) 
  WHERE last_swept_at IS NULL AND allowance_amount > 0;
