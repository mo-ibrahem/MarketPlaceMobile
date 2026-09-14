-- Additional RPC guards use the inspected function bodies; no renaming/back doors.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_review_seller_verification(p_admin_id uuid, p_request_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_user_id UUID;
  v_tier SMALLINT;
  v_status TEXT;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved or rejected';
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.user_profiles WHERE id = p_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin';
  END IF;

  SELECT user_id, requested_tier, status INTO v_user_id, v_tier, v_status
  FROM public.seller_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found'; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Request already reviewed (status: %)', v_status; END IF;

  UPDATE public.seller_verification_requests
  SET status = p_decision,
      reviewer_notes = p_notes,
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    UPDATE public.user_profiles
    SET tier = v_tier,
        tier_verified_at = NOW(),
        is_verified_seller = true,
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'decision', p_decision, 'user_id', v_user_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    PERFORM public.require_active_account();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot block yourself'; END IF;
  INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES (auth.uid(), p_user_id)
  ON CONFLICT DO NOTHING;
END $function$
;
CREATE OR REPLACE FUNCTION public.book_live_session(
  p_seller_id uuid, p_title text, p_title_ar text, p_description text,
  p_tier text, p_category text, p_scheduled_at timestamptz, p_thumbnail_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog' AS $function$
DECLARE v_price NUMERIC; v_max_viewers INTEGER; v_wallet_id UUID; v_available NUMERIC; v_tx_id UUID; v_channel TEXT; v_session RECORD;
BEGIN
  IF NOT public.account_is_active(p_seller_id) THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_seller_id::text, 37));
  IF EXISTS(SELECT 1 FROM public.live_sessions WHERE seller_id=p_seller_id AND status IN('scheduled','live') AND created_at>now()-interval '4 hours') THEN RAISE EXCEPTION 'Finish your existing live session first'; END IF;
  IF length(p_title)>160 OR length(p_description)>2000 THEN RAISE EXCEPTION 'Live description too long'; END IF;
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

  v_channel := 'egbay_live_' || replace(gen_random_uuid()::text,'-','');
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
;
REVOKE EXECUTE ON FUNCTION public.check_product_promotion_update() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.checkout_with_wallet(p_user_id uuid, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_buyer_id UUID;
    v_seller_id UUID;
    v_amount NUMERIC(12, 2);
    v_status TEXT;
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_seller_wallet_id UUID;

    v_tier INT;
    v_platform_fee_rate NUMERIC;
    v_platform_commission NUMERIC;
    v_paymob_fee NUMERIC;
    v_total_deductions NUMERIC;
    v_net_escrow NUMERIC(12, 2);
BEGIN
    SELECT buyer_id, seller_id, amount, status
    INTO v_buyer_id, v_seller_id, v_amount, v_status
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF v_buyer_id != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF v_status != 'pending_payment' THEN RAISE EXCEPTION 'Order not pending_payment'; END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND OR v_available_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT id INTO v_seller_wallet_id
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

    SELECT tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;

    IF v_tier = 1 THEN v_platform_fee_rate := 0.035;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.025;
    ELSIF v_tier = 3 THEN v_platform_fee_rate := 0.015;
    ELSE v_platform_fee_rate := 0.035;
    END IF;

    v_platform_commission := v_amount * v_platform_fee_rate;
    v_paymob_fee := 0;
    v_total_deductions := v_platform_commission + v_paymob_fee;
    v_net_escrow := v_amount - v_total_deductions;

    IF v_net_escrow <= 0 THEN RAISE EXCEPTION 'Net escrow amount is negative or zero'; END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - v_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    UPDATE public.orders
    SET status = 'escrow_secured', updated_at = NOW()
    WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'payment_completed', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'escrow_secured', NOW());

    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, order_fk
    ) VALUES (
        v_wallet_id, p_order_id::TEXT, 'purchase', v_amount, 'completed', 'Order Payment', -v_amount, 0, p_order_id
    );

    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, fee_amount, order_fk
    ) VALUES (
        v_seller_wallet_id, p_order_id::TEXT, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order', 0, v_net_escrow, v_total_deductions, p_order_id
    );

    RETURN jsonb_build_object('success', true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_marketplace_order(p_product_id uuid, p_buyer_id uuid, p_handover_method text, p_handover_pin_hash text, p_handover_pin_encrypted text, p_shipping_address jsonb, p_live_session_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_seller_id UUID;
    v_price NUMERIC;
    v_hardened_price NUMERIC;
    v_title TEXT;
    v_images TEXT[];
    v_condition TEXT;
    v_category TEXT;
    v_order_id UUID;
    v_product_snapshot JSONB;
    v_handover_method TEXT;
    v_live_display_price NUMERIC;
BEGIN
    v_handover_method := COALESCE(p_handover_method, 'courier');

    IF v_handover_method NOT IN ('courier', 'qr_meetup') THEN
        RAISE EXCEPTION 'Unsupported handover method';
    END IF;

    IF p_handover_pin_hash IS NULL OR p_handover_pin_encrypted IS NULL THEN
        RAISE EXCEPTION 'Secure handover PIN data is required';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE buyer_id = p_buyer_id
          AND product_id = p_product_id
          AND status = 'pending_payment'
          AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
        RAISE EXCEPTION 'You already have a pending order for this item.';
    END IF;

    UPDATE public.products
    SET stock = stock - 1, updated_at = NOW()
    WHERE id = p_product_id AND stock >= 1 AND status = 'active'
    RETURNING seller_id, price, title, images, condition, category
    INTO v_seller_id, v_price, v_title, v_images, v_condition, v_category;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product is out of stock, unavailable, or does not exist.';
    END IF;

    v_hardened_price := COALESCE(v_price, 0);

    IF p_live_session_id IS NOT NULL THEN
        SELECT display_price INTO v_live_display_price
        FROM public.live_pinned_products
        WHERE session_id = p_live_session_id
          AND product_id = p_product_id
          AND unpinned_at IS NULL
        LIMIT 1;

        IF v_live_display_price IS NOT NULL THEN
            v_hardened_price := LEAST(v_hardened_price, v_live_display_price);
        END IF;
    END IF;

    IF v_handover_method = 'courier' THEN
        v_hardened_price := v_hardened_price + 65;
    END IF;

    v_product_snapshot := jsonb_build_object(
        'id', p_product_id,
        'title', v_title,
        'price', v_hardened_price,
        'images', COALESCE(v_images, ARRAY[]::TEXT[]),
        'condition', COALESCE(v_condition, 'Used'),
        'category', COALESCE(v_category, 'General')
    );

    INSERT INTO public.orders (
        product_id, buyer_id, seller_id, status, amount, product_snapshot,
        handover_method, handover_pin_hash, handover_pin_encrypted, notes,
        shipping_address, created_at
    )
    VALUES (
        p_product_id, p_buyer_id, v_seller_id, 'pending_payment', v_hardened_price,
        v_product_snapshot, v_handover_method, p_handover_pin_hash, p_handover_pin_encrypted,
        jsonb_build_object(
            'amount', v_hardened_price,
            'live_session_id', p_live_session_id,
            'courier_name', NULL
        ),
        p_shipping_address, NOW()
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_events (order_id, event_type, payload)
    VALUES (v_order_id, 'order_placed', jsonb_build_object('amount', v_hardened_price));

    IF p_live_session_id IS NOT NULL THEN
        UPDATE public.live_sessions
        SET total_sales_egp = COALESCE(total_sales_egp, 0) + v_hardened_price::integer
        WHERE id = p_live_session_id;

        UPDATE public.live_pinned_products
        SET units_sold = COALESCE(units_sold, 0) + 1
        WHERE session_id = p_live_session_id
          AND product_id = p_product_id
          AND unpinned_at IS NULL;
    END IF;

    RETURN v_order_id;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.edit_review(p_review_id uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_review RECORD;
BEGIN
    PERFORM public.require_active_account();
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;
    IF p_comment IS NOT NULL AND char_length(p_comment) > 1000 THEN
        RAISE EXCEPTION 'Comment must be 1000 characters or fewer';
    END IF;

    SELECT id, reviewer_id, created_at INTO v_review
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF auth.uid() != v_review.reviewer_id THEN
        RAISE EXCEPTION 'You can only edit your own review';
    END IF;

    IF v_review.created_at < NOW() - INTERVAL '7 days' THEN
        RAISE EXCEPTION 'The edit window for this review has closed';
    END IF;

    UPDATE public.reviews
    SET rating = p_rating, comment = p_comment, edited_at = NOW()
    WHERE id = p_review_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.hide_chat_room_for_user(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    PERFORM public.require_active_account();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.chat_rooms
    SET deleted_for = deleted_for || v_uid
    WHERE id = p_room_id
      AND v_uid = ANY(participant_ids)
      AND NOT (v_uid = ANY(deleted_for));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_product_view(p_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    IF auth.uid() IS NOT NULL THEN PERFORM public.require_active_account(); END IF;
    UPDATE public.products
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_product_id
      AND status = 'active';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    PERFORM public.require_active_account();
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE user_id = auth.uid()
      AND read_at IS NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    PERFORM public.require_active_account();
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE id = ANY(p_ids)
      AND user_id = auth.uid()
      AND read_at IS NULL;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_order_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_wallet_transaction() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.process_paymob_order_payment(p_merchant_order_id text, p_paymob_tx_id bigint, p_amount_cents bigint, p_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order_id UUID;
    v_buyer_id UUID;
    v_seller_id UUID;
    v_amount NUMERIC(12, 2);
    v_status TEXT;
    v_paymob_transaction_id BIGINT;
    v_amount_egp NUMERIC(12, 2);
    v_seller_wallet_id UUID;
    v_tier INT;
    v_platform_fee_rate NUMERIC;
    v_platform_commission NUMERIC;
    v_paymob_fee NUMERIC;
    v_total_deductions NUMERIC;
    v_net_escrow NUMERIC(12, 2);
BEGIN
    IF p_currency IS DISTINCT FROM 'EGP' OR p_amount_cents IS NULL OR p_amount_cents <= 0
      OR p_paymob_tx_id IS NULL OR p_paymob_tx_id <= 0 THEN RAISE EXCEPTION 'Invalid payment'; END IF;
    v_amount_egp := p_amount_cents / 100.0;

    SELECT id, buyer_id, seller_id, amount, status, paymob_transaction_id
    INTO v_order_id, v_buyer_id, v_seller_id, v_amount, v_status, v_paymob_transaction_id
    FROM public.orders
    WHERE id = p_merchant_order_id::UUID
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

    IF v_amount IS DISTINCT FROM v_amount_egp THEN RAISE EXCEPTION 'Amount mismatch'; END IF;
    IF v_paymob_transaction_id IS NOT NULL THEN
        IF v_paymob_transaction_id = p_paymob_tx_id THEN
            PERFORM 1 FROM public.wallet_transactions
            WHERE order_fk = v_order_id
              AND type = 'escrow_hold'
              AND paymob_transaction_id = p_paymob_tx_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'CRITICAL ALARM: Order % is escrow_secured but missing ledger hold for Paymob TX %', v_order_id, p_paymob_tx_id;
            END IF;

            RETURN jsonb_build_object('success', true, 'message', 'Idempotent completion');
        ELSE
            RAISE EXCEPTION 'Order % already paid by different Paymob TX %', v_order_id, v_paymob_transaction_id;
        END IF;
    END IF;

    IF v_status != 'pending_payment' THEN RAISE EXCEPTION 'Order not pending_payment'; END IF;
    IF v_amount != v_amount_egp THEN RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_amount, v_amount_egp; END IF;

    SELECT id INTO v_seller_wallet_id
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.user_wallets (user_id)
        VALUES (v_seller_id)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id INTO v_seller_wallet_id;

        IF v_seller_wallet_id IS NULL THEN
            SELECT id INTO v_seller_wallet_id
            FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;
        END IF;

        IF v_seller_wallet_id IS NULL THEN
            RAISE EXCEPTION 'Could not create seller wallet for %', v_seller_id;
        END IF;
    END IF;

    SELECT tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;

    IF v_tier = 1 THEN v_platform_fee_rate := 0.035;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.025;
    ELSIF v_tier = 3 THEN v_platform_fee_rate := 0.015;
    ELSE v_platform_fee_rate := 0.035;
    END IF;

    v_platform_commission := v_amount * v_platform_fee_rate;
    v_paymob_fee := (v_amount * 0.0275) + 3.00;
    v_total_deductions := v_platform_commission + v_paymob_fee;
    v_net_escrow := v_amount - v_total_deductions;

    IF v_net_escrow <= 0 THEN RAISE EXCEPTION 'Net escrow amount is negative or zero'; END IF;

    UPDATE public.orders
    SET status = 'escrow_secured',
        paymob_transaction_id = p_paymob_tx_id,
        updated_at = NOW()
    WHERE id = v_order_id;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_id, 'payment_completed', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_id, 'escrow_secured', NOW());

    BEGIN
        INSERT INTO public.wallet_transactions (
            wallet_id, order_id, type, amount, status, description,
            delta_available, delta_pending, order_fk, paymob_transaction_id, fee_amount
        ) VALUES (
            v_seller_wallet_id, v_order_id::TEXT, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order (Paymob)',
            0, v_net_escrow, v_order_id, p_paymob_tx_id, v_total_deductions
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate Paymob transaction ID % globally rejected', p_paymob_tx_id;
    END;

    RETURN jsonb_build_object('success', true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.purchase_boost(p_user_id uuid, p_product_id uuid, p_package_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_seller_id UUID;
    v_amount NUMERIC(12, 2);
    v_days INTEGER;
BEGIN
    SELECT seller_id INTO v_seller_id FROM public.products WHERE id = p_product_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF v_seller_id != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    -- Authoritative server-side pricing & duration
    IF p_package_id = 'urgent' THEN 
        v_amount := 50.00; v_days := 3;
    ELSIF p_package_id = 'featured' THEN 
        v_amount := 150.00; v_days := 7;
    ELSIF p_package_id = 'turbo' THEN 
        v_amount := 300.00; v_days := 14;
    ELSE RAISE EXCEPTION 'Invalid tier';
    END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND OR v_available_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - v_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    UPDATE public.products
    SET is_promoted = true,
        promotion_tier = p_package_id,
        promoted_until = NOW() + (v_days || ' days')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- EXACT INSERT: boost (Using reference_id_text for product tracking)
    INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, status, description, delta_available, delta_pending, reference_id_text
    ) VALUES (
        v_wallet_id, 'boost', -v_amount, 'completed', 'Product Boost - ' || p_package_id, -v_amount, 0, p_product_id::TEXT
    );

    RETURN jsonb_build_object('success', true);
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.refresh_seller_rating_aggregate() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.request_wallet_payout(p_user_id uuid, p_amount numeric, p_payout_method_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_payout_id UUID;
BEGIN
    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
    IF v_available_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    PERFORM 1 FROM public.payout_methods WHERE id = p_payout_method_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid payout method'; END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    -- EXACT INSERT: Populating wallet_id for payout requests linkage (ASSUMING IT EXISTS IN SCHEMA)
    INSERT INTO public.payout_requests (
        user_id, wallet_id, amount, status, payout_method_id, created_at
    ) VALUES (
        p_user_id, v_wallet_id, p_amount, 'pending', p_payout_method_id, NOW()
    ) RETURNING id INTO v_payout_id;

    -- EXACT INSERT: payout
    INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, status, description, 
        delta_available, delta_pending, payout_fk
    ) VALUES (
        v_wallet_id, 'withdrawal', -p_amount, 'pending', 'Payout Request', 
        -p_amount, 0, v_payout_id
    );

    RETURN jsonb_build_object('success', true, 'payoutRequestId', v_payout_id);
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.resolve_paymob_attempts_on_status_change() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.respond_to_review(p_review_id uuid, p_response text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_seller_id uuid;
BEGIN
    PERFORM public.require_active_account();
    IF p_response IS NULL OR char_length(trim(p_response)) = 0 THEN
        RAISE EXCEPTION 'Response cannot be empty';
    END IF;
    IF char_length(p_response) > 1000 THEN
        RAISE EXCEPTION 'Response must be 1000 characters or fewer';
    END IF;

    SELECT seller_id INTO v_seller_id
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF auth.uid() != v_seller_id THEN
        RAISE EXCEPTION 'Only the reviewed seller can respond to this review';
    END IF;

    UPDATE public.reviews
    SET seller_response = p_response, seller_responded_at = NOW()
    WHERE id = p_review_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.submit_review(p_order_id uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order RECORD;
    v_review_id uuid;
BEGIN
    PERFORM public.require_active_account();
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;
    IF p_comment IS NOT NULL AND char_length(p_comment) > 1000 THEN
        RAISE EXCEPTION 'Comment must be 1000 characters or fewer';
    END IF;

    SELECT id, buyer_id, seller_id, product_id, status, updated_at
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF auth.uid() != v_order.buyer_id THEN
        RAISE EXCEPTION 'Only the buyer of this order can review it';
    END IF;

    IF v_order.status != 'completed' THEN
        RAISE EXCEPTION 'Order must be completed before it can be reviewed';
    END IF;

    IF v_order.updated_at < NOW() - INTERVAL '90 days' THEN
        RAISE EXCEPTION 'The review window for this order has closed';
    END IF;

    BEGIN
        INSERT INTO public.reviews (order_id, reviewer_id, seller_id, product_id, rating, comment)
        VALUES (p_order_id, auth.uid(), v_order.seller_id, v_order.product_id, p_rating, p_comment)
        RETURNING id INTO v_review_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already reviewed this order';
    END;

    RETURN v_review_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    PERFORM public.require_active_account();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.blocked_users WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;
END $function$
;
REVOKE EXECUTE ON FUNCTION public.unhide_chat_room_on_new_message() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    PERFORM public.require_active_account();
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_full_name IS NOT NULL AND char_length(TRIM(p_full_name)) > 80 THEN
    RAISE EXCEPTION 'Name must be 80 characters or fewer';
  END IF;

  -- Never let a display name be set to an email address: full_name is rendered
  -- publicly on listing cards, chat and reviews (which anon can read).
  IF p_full_name IS NOT NULL AND POSITION('@' IN p_full_name) > 0 THEN
    RAISE EXCEPTION 'Display name must not contain an email address';
  END IF;

  UPDATE public.user_profiles
  SET full_name  = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
      phone      = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      avatar_url = COALESCE(NULLIF(TRIM(p_avatar_url), ''), avatar_url),
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$function$
;

-- Only accessible targets can be reported; limits prevent unbounded spam/storage.
CREATE OR REPLACE FUNCTION public.report_content(p_target_type text,p_target_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.require_active_account();
 IF p_target_type NOT IN ('listing','user','message') OR p_target_id IS NULL
 OR char_length(trim(p_reason)) NOT BETWEEN 1 AND 1000 OR p_reason IS NULL THEN
 RAISE EXCEPTION 'Invalid report'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 14));
 IF (SELECT count(*) FROM public.content_reports WHERE reporter_id=auth.uid() AND created_at>now()-interval '1 hour')>=20
 THEN RAISE EXCEPTION 'Report limit reached. Contact info@egbay.shop for urgent concerns.'; END IF;
 IF p_target_type='listing' AND NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_target_id AND status='active') THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 IF p_target_type='user' AND (p_target_id=auth.uid() OR NOT public.account_is_active(p_target_id)) THEN RAISE EXCEPTION 'User unavailable'; END IF;
 IF p_target_type='message' AND NOT EXISTS(SELECT 1 FROM public.messages m JOIN public.chat_rooms r ON r.id=m.room_id WHERE m.id=p_target_id AND auth.uid()=ANY(r.participant_ids))
 THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 INSERT INTO public.content_reports(reporter_id,target_type,target_id,reason)
 VALUES(auth.uid(),p_target_type,p_target_id,trim(p_reason)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.purge_account_data(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE product_ids uuid[]; retained_ids uuid[]; room_ids uuid[]; own_message_ids uuid[];
BEGIN
 PERFORM 1 FROM public.account_deletion_jobs WHERE user_id=p_user_id AND status='processing' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Deletion was not requested'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=p_user_id::text
 OR (bucket_id='kyc-documents' AND split_part(name,'/',1)=p_user_id::text)) THEN RAISE EXCEPTION 'Storage cleanup incomplete'; END IF;
 SELECT coalesce(array_agg(id),'{}') INTO product_ids FROM public.products WHERE seller_id=p_user_id;
 SELECT coalesce(array_agg(DISTINCT product_id),'{}') INTO retained_ids FROM (
 SELECT product_id FROM public.orders WHERE product_id=ANY(product_ids)
 UNION SELECT product_id FROM public.payments WHERE product_id=ANY(product_ids)) x;
 SELECT coalesce(array_agg(id),'{}') INTO room_ids FROM public.chat_rooms WHERE p_user_id=ANY(participant_ids);
 SELECT coalesce(array_agg(id),'{}') INTO own_message_ids FROM public.messages WHERE sender_id=p_user_id;
 -- Erase this user's content; retain the other participant's messages and balances.
 DELETE FROM public.messages WHERE sender_id=p_user_id;
 UPDATE public.chat_rooms SET participant_ids=array_remove(participant_ids,p_user_id),
 deleted_for=array_remove(deleted_for,p_user_id) WHERE id=ANY(room_ids);
 DELETE FROM public.reviews WHERE reviewer_id=p_user_id;
 UPDATE public.reviews SET seller_response=NULL WHERE seller_id=p_user_id;
 DELETE FROM public.notifications WHERE user_id=p_user_id OR payload->>'room_id'=ANY(room_ids::text[]);
 DELETE FROM public.content_reports WHERE reporter_id=p_user_id OR target_id=p_user_id
 OR target_id=ANY(own_message_ids) OR target_id=ANY(product_ids);
 DELETE FROM public.live_chat_messages WHERE user_id=p_user_id;
 DELETE FROM public.live_sessions WHERE seller_id=p_user_id;
 DELETE FROM public.live_pinned_products WHERE product_id=ANY(product_ids);
 UPDATE public.products SET status='removed',title='Deleted listing',description='',images='{}',updated_at=now()
 WHERE id=ANY(retained_ids);
 DELETE FROM public.products WHERE id=ANY(product_ids) AND NOT(id=ANY(retained_ids));

 UPDATE public.orders SET shipping_address=NULL,notes=NULL,handover_pin_hash=NULL,
 handover_pin_encrypted=NULL,updated_at=now() WHERE buyer_id=p_user_id;
 UPDATE public.orders SET product_snapshot=jsonb_build_object('title','Deleted listing'),notes=NULL,updated_at=now()
 WHERE seller_id=p_user_id OR product_id=ANY(product_ids);
 UPDATE public.order_events SET payload='{}' WHERE order_id IN(
 SELECT id FROM public.orders WHERE buyer_id=p_user_id OR seller_id=p_user_id);
 UPDATE public.paymob_payment_attempts SET payload=NULL,error_message=NULL WHERE order_id IN(
 SELECT id FROM public.orders WHERE buyer_id=p_user_id OR seller_id=p_user_id)
 OR merchant_order_id IN(SELECT merchant_order_id FROM public.wallet_topups WHERE user_id=p_user_id);
 UPDATE public.payout_requests SET metadata='{}' WHERE user_id=p_user_id;
 UPDATE public.payments SET metadata='{}',stripe_customer_id=NULL,payment_method_id=NULL
 WHERE buyer_id=p_user_id;
 DELETE FROM public.payout_methods WHERE user_id=p_user_id;
 DELETE FROM public.seller_verification_requests WHERE user_id=p_user_id;
 UPDATE public.seller_verification_requests SET reviewed_by=NULL WHERE reviewed_by=p_user_id;
 DELETE FROM public.wishlists WHERE user_id=p_user_id;
 DELETE FROM public.blocked_users WHERE blocker_id=p_user_id OR blocked_id=p_user_id;
 DELETE FROM public.user_profiles WHERE id=p_user_id;
 DELETE FROM auth.sessions WHERE user_id=p_user_id;
 -- Edge worker now hard-deletes auth via the supported admin API. The nullable
 -- SET NULL financial FKs preserve transaction rows and delink this identity.
END $$;
REVOKE ALL ON FUNCTION public.purge_account_data(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_data(uuid) TO service_role;
COMMIT;
