-- Live selling comes back before payments do: the platform absorbs the Agora
-- cost for now, so a live pass costs the seller nothing until Paymob's
-- merchant approval lands and the wallet is turned back on. The price is a
-- server-side setting -- the app reads it and shows "free for now"; when the
-- operator flips it, the same booking screen starts charging without a
-- rebuild. Tier limits (viewer caps) are unchanged; only the debit is skipped.
--
-- Applied to fpqbocohjzwlfcmfropr on 2026-09-13.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.platform_settings (
  singleton            boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  live_passes_are_free boolean NOT NULL DEFAULT true,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.platform_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.live_passes_are_free()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT live_passes_are_free FROM private.platform_settings WHERE singleton), false);
$$;
REVOKE ALL ON FUNCTION public.live_passes_are_free() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_passes_are_free() TO authenticated, service_role;

-- Same body as the deployed version except the wallet debit is inside
-- IF v_price > 0. A free pass records pass_price_egp = 0 and no wallet charge.
CREATE OR REPLACE FUNCTION public.book_live_session(
  p_seller_id uuid, p_title text, p_title_ar text, p_description text,
  p_tier text, p_category text, p_scheduled_at timestamptz, p_thumbnail_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog' AS $function$
DECLARE v_price NUMERIC; v_max_viewers INTEGER; v_wallet_id UUID; v_available NUMERIC; v_tx_id UUID; v_channel TEXT; v_session RECORD;
BEGIN
  IF p_tier = 'flash' THEN v_price := 79;  v_max_viewers := 30;
  ELSIF p_tier = 'pro' THEN v_price := 149; v_max_viewers := 100;
  ELSIF p_tier = 'mega' THEN v_price := 299; v_max_viewers := 300;
  ELSE RAISE EXCEPTION 'Invalid live pass tier'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'Title is required'; END IF;

  IF public.live_passes_are_free() THEN v_price := 0; END IF;

  IF v_price > 0 THEN
    SELECT id, available_balance INTO v_wallet_id, v_available FROM public.user_wallets WHERE user_id = p_seller_id FOR UPDATE;
    IF NOT FOUND OR v_available < v_price THEN RAISE EXCEPTION 'Insufficient wallet balance. Required: % EGP', v_price; END IF;
    UPDATE public.user_wallets SET available_balance = available_balance - v_price, updated_at = NOW() WHERE id = v_wallet_id;
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, status, description, delta_available, delta_pending, reference_id_text)
    VALUES (v_wallet_id, 'live_pass', v_price, 'completed', 'Live Pass Fee (' || p_tier || ')', -v_price, 0, NULL)
    RETURNING id INTO v_tx_id;
  END IF;

  v_channel := 'egbay_live_' || extract(epoch from now())::bigint || '_' || substr(p_seller_id::text, 1, 8);
  INSERT INTO public.live_sessions (seller_id, title, title_ar, description, pass_tier, pass_price_egp, max_viewers,
    agora_channel, status, scheduled_at, category, thumbnail_url, wallet_charge_id)
  VALUES (p_seller_id, p_title, p_title_ar, p_description, p_tier, v_price, v_max_viewers,
    v_channel, 'scheduled', p_scheduled_at, p_category, p_thumbnail_url, v_tx_id)
  RETURNING * INTO v_session;
  IF v_tx_id IS NOT NULL THEN
    UPDATE public.wallet_transactions SET reference_id_text = v_session.id::text WHERE id = v_tx_id;
  END IF;
  RETURN to_jsonb(v_session);
END;
$function$;
