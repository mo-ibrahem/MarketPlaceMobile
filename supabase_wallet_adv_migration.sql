ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS payout_schedule TEXT DEFAULT 'daily';
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS use_spendable_funds BOOLEAN DEFAULT true;
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS express_payout_enabled BOOLEAN DEFAULT true;
