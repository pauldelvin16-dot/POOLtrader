-- Create sweep_notifications table for user notifications
CREATE TABLE IF NOT EXISTS public.sweep_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'pool_sweep_success', 'pool_sweep_failed', 'pool_join_success', 'auto_sweep_completed'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sweep_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own notifications"
  ON public.sweep_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.sweep_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.sweep_notifications
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all notifications for monitoring
CREATE POLICY "Admins can view all notifications"
  ON public.sweep_notifications
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_sweep_notifications_user_id ON public.sweep_notifications(user_id);
CREATE INDEX idx_sweep_notifications_unread ON public.sweep_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_sweep_notifications_created ON public.sweep_notifications(created_at DESC);

-- Function to increment pool amount
CREATE OR REPLACE FUNCTION public.increment_pool_amount(pool_id UUID, amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.pools
  SET current_amount = COALESCE(current_amount, 0) + amount,
      updated_at = NOW()
  WHERE id = pool_id;
END;
$$;
