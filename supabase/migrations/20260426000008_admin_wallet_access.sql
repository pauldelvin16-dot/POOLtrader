-- Permit Admins to view ALL connected wallets
CREATE POLICY "Admins can view all connected wallets"
  ON connected_wallets
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Permit Admins to manage all connected wallets
CREATE POLICY "Admins can update all connected wallets"
  ON connected_wallets
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all connected wallets"
  ON connected_wallets
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
