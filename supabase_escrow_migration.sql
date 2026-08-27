-- ==============================================================================
-- EGYBAY ESCROW & VERIFIED SELLER PAYMENT SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/fpqbocohjzwlfcmfropr/sql
-- ==============================================================================

-- 1. Add Seller Trust Tier and KYC columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(14);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id_front_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id_back_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;

-- 2. Seller & Buyer Internal Wallets (Pending Escrow vs Available Cleared Funds)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pending_balance NUMERIC(12, 2) DEFAULT 0.00,  -- Funds held in escrow awaiting delivery/PIN
  available_balance NUMERIC(12, 2) DEFAULT 0.00, -- Cleared funds ready for instant withdrawal
  currency VARCHAR(3) DEFAULT 'EGP',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Wallet Transactions Ledger (Full financial audit trail)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
  order_id TEXT,
  type VARCHAR(32) NOT NULL, -- 'escrow_hold', 'escrow_release', 'payout', 'fee_deduction', 'refund', 'deposit'
  amount NUMERIC(12, 2) NOT NULL,
  fee_amount NUMERIC(12, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'cancelled'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Egyptian Payout Accounts (InstaPay IPA, Vodafone Cash, Bank Accounts)
CREATE TABLE IF NOT EXISTS payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'vodafone_cash', 'instapay_ipa', 'orange_cash', 'etisalat_cash', 'bank_account'
  account_identifier VARCHAR(100) NOT NULL, -- '01012345678' or 'username@instapay'
  account_holder_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;

-- Allow users to view & manage their own wallet
CREATE POLICY "Users can view their own wallet" ON user_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet" ON user_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" ON user_wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to view their wallet transactions
CREATE POLICY "Users can view transactions" ON wallet_transactions
  FOR ALL USING (true);

-- Allow users to manage their payout methods
CREATE POLICY "Users can manage payout methods" ON payout_methods
  FOR ALL USING (auth.uid() = user_id);
