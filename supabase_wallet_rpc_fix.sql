-- ============================================================
-- EgyBay Wallet Security Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Remove the unsafe client-side wallet UPDATE policy.
--    Previously any buyer could attempt to update a seller's wallet row.
--    All wallet balance mutations now go through the webhook Edge Function
--    which uses the service_role key (bypasses RLS entirely).
DROP POLICY IF EXISTS "Users can update their own wallet" ON user_wallets;

-- 2. Users can still READ their own wallet (unchanged)
-- Policy "Users can view their own wallet" stays as-is.

-- 3. Users can still INSERT their own wallet row on first load (unchanged)
-- Policy "Users can insert their own wallet" stays as-is.

-- 4. Make wallet_transactions readable only by the owning user via wallet join.
--    Drop the current overly-permissive ALL policy.
DROP POLICY IF EXISTS "Users can view transactions" ON wallet_transactions;

CREATE POLICY "Users can view their own transactions"
ON wallet_transactions
FOR SELECT
USING (
  wallet_id IN (
    SELECT id FROM user_wallets WHERE user_id = auth.uid()
  )
);

-- 5. Block direct INSERT into wallet_transactions from clients.
--    All inserts must go through the webhook Edge Function (service role).
--    The existing policy (if any) allowed any authenticated user to insert.
DROP POLICY IF EXISTS "Users can insert transactions" ON wallet_transactions;

-- NOTE: No INSERT policy means only service_role (Edge Functions) can write transactions.

-- 6. Safety check: confirm RLS is still enabled on critical tables
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;

-- Done. Summary of remaining policies after this migration:
-- user_wallets:        SELECT (own) ✅ | INSERT (own, first-time) ✅ | UPDATE ❌ (service role only)
-- wallet_transactions: SELECT (own via wallet join) ✅ | INSERT ❌ (service role only)
-- payout_methods:      ALL (own) ✅ (unchanged, safe since this is user-managed data)
