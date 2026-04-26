ALTER TABLE public.admin_settings 
ADD COLUMN gas_topup_enabled BOOLEAN DEFAULT false,
ADD COLUMN gas_topup_threshold_usd NUMERIC DEFAULT 50,
ADD COLUMN gas_amount_native NUMERIC DEFAULT 0.002;
