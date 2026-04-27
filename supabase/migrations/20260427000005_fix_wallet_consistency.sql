-- Align wallet ownership with auth.users and make admin access consistent.

ALTER TABLE public.connected_wallets
  DROP CONSTRAINT IF EXISTS connected_wallets_user_id_fkey;

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

ALTER TABLE public.wallet_assets
  DROP CONSTRAINT IF EXISTS wallet_assets_user_id_fkey;

ALTER TABLE public.connected_wallets
  ADD CONSTRAINT connected_wallets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.wallet_assets
  ADD CONSTRAINT wallet_assets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_connected_wallets_user_active
  ON public.connected_wallets(user_id, is_active, connected_at DESC);

CREATE INDEX IF NOT EXISTS idx_connected_wallets_user_address_chain
  ON public.connected_wallets(user_id, wallet_address, chain_id);

CREATE INDEX IF NOT EXISTS idx_wallet_assets_user_wallet
  ON public.wallet_assets(user_id, wallet_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_wallet
  ON public.wallet_transactions(user_id, wallet_id, created_at DESC);

DROP POLICY IF EXISTS "Users can view their own connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Users can insert their own connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Users can update their own connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Users can delete their own connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Admins can update all connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Admins can delete all connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Admins can delete connections" ON public.connected_wallets;
DROP POLICY IF EXISTS "Admins can view all connected wallets v3" ON public.connected_wallets;

CREATE POLICY "Users can view their own connected wallets"
  ON public.connected_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connected wallets"
  ON public.connected_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connected wallets"
  ON public.connected_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connected wallets"
  ON public.connected_wallets
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all connected wallets"
  ON public.connected_wallets
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all connected wallets"
  ON public.connected_wallets
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete all connected wallets"
  ON public.connected_wallets
  FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can insert their own wallet transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view their own wallet transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet transactions"
  ON public.wallet_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallet transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own wallet assets" ON public.wallet_assets;
DROP POLICY IF EXISTS "Users can insert their own wallet assets" ON public.wallet_assets;
DROP POLICY IF EXISTS "Users can update their own wallet assets" ON public.wallet_assets;

CREATE POLICY "Users can view their own wallet assets"
  ON public.wallet_assets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet assets"
  ON public.wallet_assets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet assets"
  ON public.wallet_assets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallet assets"
  ON public.wallet_assets
  FOR SELECT
  USING (public.is_admin());
