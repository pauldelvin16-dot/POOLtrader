-- Add is_sweep_target column to crypto_addresses
ALTER TABLE crypto_addresses ADD COLUMN is_sweep_target BOOLEAN DEFAULT FALSE;

-- Ensure only one address can be the sweep target at a time per network (optional, but good for logic)
-- Actually, let's just keep it simple and let the code pick the one with is_sweep_target = true
