-- Add Auto-Sweep toggle to admin settings
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS auto_sweep_enabled BOOLEAN DEFAULT FALSE;
