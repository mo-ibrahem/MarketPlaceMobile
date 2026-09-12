-- Schema audit 2026-09-12, part 2: DESTRUCTIVE. Each item removes a table or
-- column that no code in MarketPlaceMobile or EgbayWeb reads or writes.
-- Row/population counts were taken live before writing this. Apply only after
-- reading each block; take a backup first (Dashboard -> Database -> Backups).
-- NOT APPLIED.

-- A. payments: the Stripe-era table (stripe_payment_intent_id,
--    stripe_customer_id, payment_method_id). 1 row (id 'paymob_90004'),
--    referenced by exactly 1 order via orders.payment_id. No code touches
--    either. Paymob transactions live on orders.paymob_transaction_id and
--    paymob_payment_attempts.
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_id;
DROP TABLE IF EXISTS public.payments;

-- B. user_wallets: payout_schedule / express_payout_enabled were only ever
--    written by the mobile "express payouts within 30 seconds" UI, removed in
--    ef8946e because nothing fulfils payouts automatically. use_spendable_funds
--    has no reader or writer anywhere.
ALTER TABLE public.user_wallets
  DROP COLUMN IF EXISTS payout_schedule,
  DROP COLUMN IF EXISTS express_payout_enabled,
  DROP COLUMN IF EXISTS use_spendable_funds;

-- C. products: promoted_ad_rate / is_promoted_on_sale were only written by the
--    mobile "Promote to sell 50% faster" toggle (removed in ef8946e); nothing
--    reads them (EgbayWeb migration 20260902070500 says the same). 0 rows set.
--    The tamper-guard trigger check_product_promotion_update references both
--    columns, so it is redefined without them first.
CREATE OR REPLACE FUNCTION public.check_product_promotion_update()
 RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_role TEXT;
BEGIN
  BEGIN v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  EXCEPTION WHEN OTHERS THEN v_role := current_user; END;
  IF v_role NOT IN ('service_role', 'postgres') AND (
      NEW.is_promoted     IS DISTINCT FROM OLD.is_promoted OR
      NEW.promoted_until  IS DISTINCT FROM OLD.promoted_until OR
      NEW.promotion_tier  IS DISTINCT FROM OLD.promotion_tier
  ) THEN
    RAISE EXCEPTION 'Only system administrators can modify promotion status (Role: %)', v_role;
  END IF;
  RETURN NEW;
END; $function$;
ALTER TABLE public.products
  DROP COLUMN IF EXISTS promoted_ad_rate,
  DROP COLUMN IF EXISTS is_promoted_on_sale;

-- D. user_profiles: national_id_number / national_id_front_url /
--    national_id_back_url duplicate seller_verification_requests, which is
--    what the web KYC flow actually writes and the admin route reads.
--    0 of 26 profiles have any of them set. Keeping ID-document paths on the
--    profile row also widens the PII blast radius for no reason.
--    delete_my_account nulls these columns, so it is redefined first.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth','pg_catalog' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.products SET status = 'removed', updated_at = now()
   WHERE seller_id = v_uid AND status <> 'removed';
  DELETE FROM public.wishlists                    WHERE user_id = v_uid;
  DELETE FROM public.notifications                WHERE user_id = v_uid;
  DELETE FROM public.blocked_users                WHERE blocker_id = v_uid;
  DELETE FROM public.payout_methods               WHERE user_id = v_uid;
  DELETE FROM public.seller_verification_requests WHERE user_id = v_uid;
  UPDATE public.user_profiles
     SET full_name = 'Deleted user', email = NULL, phone = NULL, address = NULL,
         avatar_url = NULL, updated_at = now()
   WHERE id = v_uid;
  UPDATE auth.users
     SET email = 'deleted+' || v_uid::text || '@egbay.invalid',
         phone = NULL, encrypted_password = NULL, raw_user_meta_data = '{}'::jsonb,
         email_change = NULL, email_change_token_new = NULL, email_change_token_current = NULL,
         phone_change = NULL, recovery_token = NULL,
         banned_until = 'infinity'::timestamptz, updated_at = now()
   WHERE id = v_uid;
  DELETE FROM auth.identities WHERE user_id = v_uid;
  DELETE FROM auth.mfa_factors WHERE user_id = v_uid;
  DELETE FROM auth.sessions    WHERE user_id = v_uid;
END $$;
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS national_id_number,
  DROP COLUMN IF EXISTS national_id_front_url,
  DROP COLUMN IF EXISTS national_id_back_url;

-- E. live_sessions.agora_token: 0 of 5 rows populated; tokens are minted per
--    viewer by the generate-agora-token edge function and never stored.
ALTER TABLE public.live_sessions DROP COLUMN IF EXISTS agora_token;

-- NOT touched, deliberately:
--   wallet_transactions carries both legacy (order_id text, reference_id_text)
--   and typed (order_fk, topup_fk, payout_fk) reference columns, written by
--   different RPC generations. Collapsing them means rewriting
--   process_paymob_topup / release_escrow / purchase_boost / checkout_with_wallet
--   together and back-filling 53 rows -- a separate, tested change.
