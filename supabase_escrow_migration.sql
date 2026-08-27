-- 1. Add Seller Trust Tier and KYC columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(14);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS national_id_front_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS national_id_back_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tier_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;

-- 2. Seller & Buyer Internal Wallets (Pending Escrow vs Available Cleared Funds)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pending_balance NUMERIC(12, 2) DEFAULT 0.00,
  available_balance NUMERIC(12, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'EGP',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Wallet Transactions Ledger (Full financial audit trail)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
  order_id TEXT,
  type VARCHAR(32) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  fee_amount NUMERIC(12, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'completed',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Egyptian Payout Accounts (InstaPay IPA, Vodafone Cash, Bank Accounts)
CREATE TABLE IF NOT EXISTS payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  account_identifier VARCHAR(100) NOT NULL,
  account_holder_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own wallet') THEN
    CREATE POLICY "Users can view their own wallet" ON user_wallets FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own wallet') THEN
    CREATE POLICY "Users can insert their own wallet" ON user_wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own wallet') THEN
    CREATE POLICY "Users can update their own wallet" ON user_wallets FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view transactions') THEN
    CREATE POLICY "Users can view transactions" ON wallet_transactions FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage payout methods') THEN
    CREATE POLICY "Users can manage payout methods" ON payout_methods FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
