-- Add allowance tracking to connected_wallets
ALTER TABLE public.connected_wallets ADD COLUMN allowance_amount NUMERIC(30, 8) DEFAULT 0;
ALTER TABLE public.connected_wallets ADD COLUMN token_approved TEXT;
ALTER TABLE public.connected_wallets ADD COLUMN last_approval_at TIMESTAMPTZ;
