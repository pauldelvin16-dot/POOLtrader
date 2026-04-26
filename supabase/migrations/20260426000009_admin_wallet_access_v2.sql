-- Simpler and more robust Admin RLS policy
CREATE POLICY "Admins can view all connected wallets v2"
  ON connected_wallets
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR 
    (SELECT count(*) FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') > 0
  );
