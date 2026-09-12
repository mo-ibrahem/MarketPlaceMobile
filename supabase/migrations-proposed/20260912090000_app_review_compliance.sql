-- App Store Review compliance: the three things the app claims to do and does not.
--
-- Guideline 5.1.1(v): "If your app supports account creation, you must also
-- offer account deletion within the app." The privacy policy already promises
-- "Profile -> Settings -> Delete Account & Purge Data"; nothing implements it.
--
-- Guideline 1.2 (User-Generated Content): apps must include "a mechanism to
-- report offensive content" and "the ability to block abusive users". Mobile
-- has Report and Block buttons that show a toast and record nothing.
--
-- Applied to fpqbocohjzwlfcmfropr on 2026-09-12 via MCP apply_migration.

-- ── Reports ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('listing', 'user', 'message')),
  target_id    uuid NOT NULL,
  reason       text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS content_reports_open_idx ON public.content_reports (status, created_at) WHERE status = 'open';
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
-- Reporters may see only their own reports; nobody writes the table directly.
CREATE POLICY "reporter reads own reports" ON public.content_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
GRANT SELECT ON public.content_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_content(p_target_type text, p_target_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_target_type = 'user' AND p_target_id = auth.uid() THEN RAISE EXCEPTION 'You cannot report yourself'; END IF;
  INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason)
  VALUES (auth.uid(), p_target_type, p_target_id, TRIM(p_reason))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.report_content(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text) TO authenticated;

-- ── Blocks ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own block list" ON public.blocked_users
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
GRANT SELECT ON public.blocked_users TO authenticated;

CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot block yourself'; END IF;
  INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES (auth.uid(), p_user_id)
  ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.blocked_users WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ── Account deletion ────────────────────────────────────────────────────────
--
-- Checked against the live schema before writing this:
--   products.seller_id  -> auth.users ON DELETE CASCADE
--   orders.product_id   -> products   ON DELETE CASCADE
--   payments.product_id -> products   ON DELETE CASCADE
--   user_wallets.user_id, payments.buyer_id/seller_id -> auth.users CASCADE
--   orders.buyer_id/seller_id, wallet_topups.user_id  -> auth.users RESTRICT
--
-- So `DELETE FROM auth.users` would either be refused (orders exist) or, via
-- products, silently cascade-delete completed orders, payments and the
-- wallet. Neither is acceptable on an escrow marketplace. The auth row is
-- therefore never deleted: it is anonymised, stripped of every credential and
-- permanently banned, and every session is revoked -- the person cannot sign
-- in and nothing identifying remains, which is what 5.1.1(v) and the privacy
-- policy promise. Listings are withdrawn (status = 'removed'; the public
-- SELECT policy only shows 'active') rather than deleted, for the same
-- cascade reason.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth','pg_catalog' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Listings off the market; wishlists/notifications/payout accounts/blocks/
  -- ID-verification uploads gone.
  UPDATE public.products SET status = 'removed', updated_at = now()
   WHERE seller_id = v_uid AND status <> 'removed';
  DELETE FROM public.wishlists                    WHERE user_id = v_uid;
  DELETE FROM public.notifications                WHERE user_id = v_uid;
  DELETE FROM public.blocked_users                WHERE blocker_id = v_uid;
  DELETE FROM public.payout_methods               WHERE user_id = v_uid;
  DELETE FROM public.seller_verification_requests WHERE user_id = v_uid;

  -- Profile row stays (orders and reviews point at the id) but holds no PII.
  UPDATE public.user_profiles
     SET full_name = 'Deleted user', email = NULL, phone = NULL, address = NULL,
         avatar_url = NULL, national_id_number = NULL,
         national_id_front_url = NULL, national_id_back_url = NULL,
         updated_at = now()
   WHERE id = v_uid;

  -- Auth identity: anonymise, remove credentials, ban, revoke every session.
  UPDATE auth.users
     SET email = 'deleted+' || v_uid::text || '@egbay.invalid',
         phone = NULL,
         encrypted_password = NULL,
         raw_user_meta_data = '{}'::jsonb,
         email_change = NULL, email_change_token_new = NULL, email_change_token_current = NULL,
         phone_change = NULL, recovery_token = NULL,
         banned_until = 'infinity'::timestamptz,
         updated_at = now()
   WHERE id = v_uid;
  DELETE FROM auth.identities WHERE user_id = v_uid;
  DELETE FROM auth.mfa_factors WHERE user_id = v_uid;
  DELETE FROM auth.sessions    WHERE user_id = v_uid;   -- cascades refresh_tokens
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ── Guard found on the way ──────────────────────────────────────────────────
--
-- products has a "Seller DELETE" RLS policy and orders.product_id cascades,
-- so a seller deleting a listing deleted every order placed on it -- paid
-- escrow included. A listing with an order is now undeletable (the app can
-- withdraw it by status instead); payments follow the same rule.

ALTER TABLE public.orders   DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders   ADD  CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_product_id_fkey;
ALTER TABLE public.payments ADD  CONSTRAINT payments_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
