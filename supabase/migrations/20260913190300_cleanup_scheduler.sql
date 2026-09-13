-- Hosting-only scheduler; core authorization/deletion SQL is tested in PGlite.
BEGIN;
CREATE OR REPLACE FUNCTION public.process_paymob_topup(p_merchant_order_id text, p_paymob_tx_id bigint, p_amount_cents bigint, p_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_topup_id UUID;
    v_user_id UUID;
    v_amount NUMERIC(12, 2);
    v_currency TEXT;
    v_status TEXT;
    v_paymob_transaction_id BIGINT;
    v_wallet_id UUID;
    v_amount_egp NUMERIC(12, 2);
BEGIN
    PERFORM public.require_commerce_enabled();
    v_amount_egp := p_amount_cents / 100.0;

    SELECT id, user_id, amount, currency, status, paymob_transaction_id
    INTO v_topup_id, v_user_id, v_amount, v_currency, v_status, v_paymob_transaction_id
    FROM public.wallet_topups
    WHERE merchant_order_id = p_merchant_order_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Top-up not found: %', p_merchant_order_id; END IF;
    
    -- Order-level Idempotency Check (Happens FIRST)
    IF v_status = 'paid' THEN 
        IF v_paymob_transaction_id = p_paymob_tx_id THEN
            -- Verify ledger integrity before reporting idempotent success
            PERFORM 1 FROM public.wallet_transactions 
            WHERE topup_fk = v_topup_id 
              AND type = 'top_up' 
              AND paymob_transaction_id = p_paymob_tx_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Integrity Error: Top-up is paid but ledger record is missing/mismatched';
            END IF;

            RETURN jsonb_build_object('success', true, 'message', 'Already processed'); 
        ELSIF v_paymob_transaction_id IS NOT NULL THEN
            RAISE EXCEPTION 'Top-up already settled with a different transaction ID';
        END IF;
    END IF;
    
    IF v_status != 'pending' THEN RAISE EXCEPTION 'Top-up is not pending'; END IF;
    IF v_amount != v_amount_egp THEN RAISE EXCEPTION 'Amount mismatch'; END IF;
    IF v_currency != p_currency THEN RAISE EXCEPTION 'Currency mismatch'; END IF;

    SELECT id INTO v_wallet_id FROM public.user_wallets WHERE user_id = v_user_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, available_balance, pending_balance, currency)
        VALUES (v_user_id, v_amount, 0, 'EGP') RETURNING id INTO v_wallet_id;
    ELSE
        UPDATE public.user_wallets
        SET available_balance = available_balance + v_amount, updated_at = NOW()
        WHERE id = v_wallet_id;
    END IF;

    -- EXACT INSERT: Paymob top-up with Unique Violation catching for concurrency
    BEGIN
        INSERT INTO public.wallet_transactions (
            wallet_id, type, amount, status, description, 
            delta_available, delta_pending, topup_fk, paymob_transaction_id
        ) VALUES (
            v_wallet_id, 'top_up', v_amount, 'completed', 'Wallet Deposit via Paymob', 
            v_amount, 0, v_topup_id, p_paymob_tx_id
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate Paymob transaction ID % globally rejected', p_paymob_tx_id;
    END;

    UPDATE public.wallet_topups
    SET status = 'paid', paymob_transaction_id = p_paymob_tx_id, paid_at = NOW()
    WHERE id = v_topup_id;

    RETURN jsonb_build_object('success', true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.dispatch_cleanup_jobs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE worker_secret text;
BEGIN
 SELECT secret INTO worker_secret FROM private.worker_credentials WHERE purpose='cleanup';
 IF worker_secret IS NULL THEN RAISE EXCEPTION 'Cleanup authentication missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE status IN('pending','processing') AND (lease_until IS NULL OR lease_until<now())) THEN
 PERFORM net.http_post(
 url:='https://fpqbocohjzwlfcmfropr.supabase.co/functions/v1/delete-account',
 headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-secret',worker_secret),
 body:='{}'::jsonb,timeout_milliseconds:=30000); END IF;
 IF EXISTS(SELECT 1 FROM public.product_image_cleanup_jobs WHERE lease_until IS NULL OR lease_until<now()) THEN
 PERFORM net.http_post(
 url:='https://fpqbocohjzwlfcmfropr.supabase.co/functions/v1/delete-product-images',
 headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-secret',worker_secret),
 body:='{}'::jsonb,timeout_milliseconds:=30000); END IF;
 DELETE FROM public.account_deletion_jobs WHERE status='complete' AND completed_at<now()-interval '7 days';
END $$;
REVOKE ALL ON FUNCTION public.dispatch_cleanup_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_cleanup_jobs() TO service_role;
-- Retire only legacy product image HTTP webhooks; the durable queue replaces them.
DO $$
DECLARE t record;
BEGIN
 FOR t IN SELECT tgname FROM pg_trigger WHERE tgrelid='public.products'::regclass
 AND NOT tgisinternal AND encode(tgargs,'escape') LIKE '%delete-product-images%'
 LOOP EXECUTE format('DROP TRIGGER %I ON public.products',t.tgname); END LOOP;
END $$;
SELECT cron.schedule('egbay-retry-cleanup','* * * * *','SELECT public.dispatch_cleanup_jobs()');
COMMIT;

