-- Schema audit 2026-09-12, part 1: no data or column is removed here.
-- Grant fixes, one data correction, and functions/trigger with zero callers
-- in both codebases (grep over MarketPlaceMobile and EgbayWeb app/lib/
-- supabase/functions, plus pg_proc/cron.job for SQL callers).
-- Applied to fpqbocohjzwlfcmfropr on 2026-09-12 via MCP apply_migration.

-- 1. Supabase default privileges grant EXECUTE to anon at creation time, and
--    REVOKE ... FROM PUBLIC does not remove that direct grant. All five guard
--    with auth.uid() so anon gets 'Not authenticated'; this closes the surface.
REVOKE EXECUTE ON FUNCTION public.report_content(text, uuid, text)    FROM anon;
REVOKE EXECUTE ON FUNCTION public.block_user(uuid)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_account()                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_my_profile(text, text, text) FROM anon;

-- 2. Three live_sessions have been status='live' since 2026-09-02. Both apps
--    already hide sessions older than 4h (isGenuinelyLive); close the rows.
UPDATE public.live_sessions
   SET status = 'ended', ended_at = COALESCE(started_at, created_at) + interval '4 hours'
 WHERE status = 'live' AND COALESCE(started_at, created_at) < now() - interval '1 day';

-- 3. Dead RPCs -- the unapplied EgbayWeb 20260901000004_drop_dead_wallet_rpcs
--    plus two more found today.
--    release_escrow(uuid,text,text)   compares notes->>'meetup_pin', which no
--                                     order carries; web calls the 2-arg form.
--    pay_order_with_wallet,           duplicate checkout_with_wallet with
--    deduct_wallet_balance            different fee math; no grants, no callers.
--    purchase_boost(uuid,uuid,text,integer)
--                                     no auth.uid() check; grant already
--                                     revoked, body still present.
--    get_products_with_details,       executable by anon, unused since both
--    get_user_chat_rooms              apps query tables + public_profiles.
DROP FUNCTION IF EXISTS public.purchase_boost(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.release_escrow(uuid, text, text);
DROP FUNCTION IF EXISTS public.pay_order_with_wallet(uuid, text);
DROP FUNCTION IF EXISTS public.deduct_wallet_balance(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS public.get_products_with_details(uuid);
DROP FUNCTION IF EXISTS public.get_user_chat_rooms();

-- 4. handle_product_delete (AFTER DELETE on products) posts to
--    functions/v1/delete-product-images, an edge function that is not
--    deployed (only generate-agora-token and paymob-webhook exist). The async
--    net.http_post never fails the DELETE, so this has been a no-op with a
--    log line. Orphaned storage objects remain a separate, known gap.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.products'::regclass
              AND tgfoid  = 'public.handle_product_delete'::regproc LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.products', t.tgname);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.handle_product_delete();
