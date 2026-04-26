-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all connected wallets" ON connected_wallets;
DROP POLICY IF EXISTS "Admins can view all connected wallets v2" ON connected_wallets;

-- Create robust policy
CREATE POLICY "Admins can view all connected wallets v3"
  ON connected_wallets
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can delete connections"
  ON connected_wallets
  FOR DELETE
  USING (is_admin());
