-- Reviewed against production schema 2026-09-13. No bulk test-data deletion.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
-- No platform-wide "payments_enabled" switch here. PAYMENTS_ENABLED is a
-- build-time flag of the iOS app only; egbay.shop runs in payments mode
-- against the same database, so a server-side kill switch that defaults to
-- off would have stopped web checkout, top-ups, payouts, boosts, live
-- booking and webhook settlement the moment it was applied. See
-- HANDOFF-TO-CODEX.md section 2.1.
CREATE TABLE private.worker_credentials (
  purpose text PRIMARY KEY,
  secret text NOT NULL DEFAULT (gen_random_uuid()::text || gen_random_uuid()::text)
);
INSERT INTO private.worker_credentials(purpose) VALUES ('cleanup');
CREATE TABLE public.account_deletion_jobs (
  user_id uuid PRIMARY KEY, -- Deliberately survives auth deletion until completion is recorded.
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','complete','needs_review')),
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  completed_at timestamptz
);
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.account_is_active(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_user_id
   AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now()))
 AND NOT EXISTS (SELECT 1 FROM public.account_deletion_jobs j WHERE j.user_id=p_user_id);
$$;
REVOKE ALL ON FUNCTION public.account_is_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_is_active(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.my_account_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.account_is_active(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.my_account_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_is_active() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.require_active_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.my_account_is_active() THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.require_active_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_active_account() TO authenticated, service_role;

-- AND a current-account check with every existing user policy, including reads.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace
   AND c.relkind='r' AND c.relname <> 'account_deletion_jobs'
 LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.relname);
   EXECUTE format('CREATE POLICY active_account_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.my_account_is_active()) WITH CHECK (public.my_account_is_active())',r.relname);
 END LOOP;
END $$;
CREATE POLICY active_account_required ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
 USING (public.my_account_is_active()) WITH CHECK (public.my_account_is_active());

CREATE OR REPLACE FUNCTION public.can_interact_with(p_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.account_is_active(auth.uid()) AND public.account_is_active(p_other)
 AND NOT EXISTS (SELECT 1 FROM public.blocked_users b WHERE
 (b.blocker_id=auth.uid() AND b.blocked_id=p_other) OR (b.blocked_id=auth.uid() AND b.blocker_id=p_other));
$$;
REVOKE ALL ON FUNCTION public.can_interact_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_interact_with(uuid) TO authenticated, service_role;
CREATE POLICY valid_unblocked_direct_room ON public.chat_rooms AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (cardinality(participant_ids)=2 AND array_ndims(participant_ids)=1
 AND array_lower(participant_ids,1)=1 AND participant_ids[1]<>participant_ids[2]
 AND auth.uid()=ANY(participant_ids)
 AND public.can_interact_with(participant_ids[1]) AND public.can_interact_with(participant_ids[2]));
CREATE POLICY unblocked_message_insert ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (sender_id=auth.uid() AND char_length(trim(content)) BETWEEN 1 AND 4000
 AND EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id=room_id
 AND cardinality(r.participant_ids)=2 AND auth.uid()=ANY(r.participant_ids)
 AND public.can_interact_with(r.participant_ids[1]) AND public.can_interact_with(r.participant_ids[2])));
-- No client editing of membership, ownership or messages. Inbox hiding uses its scoped RPC.
REVOKE UPDATE, DELETE ON public.chat_rooms, public.messages FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.user_profiles(id,email,full_name)
 VALUES(NEW.id,NEW.email,COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),'EgyBay User'));
 INSERT INTO public.user_wallets(user_id) VALUES(NEW.id) ON CONFLICT(user_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE OR REPLACE VIEW public.public_profiles AS
 SELECT id, (CASE WHEN position('@' in coalesce(full_name,''))>0 THEN 'EgyBay User' ELSE full_name END)::varchar(255) AS full_name,
 avatar_url,tier,is_verified_seller,rating_avg,rating_count
 FROM public.user_profiles p WHERE EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p.id
 AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()))
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.user_id=p.id);

-- Live and verification privileges, narrowed to what the web client actually
-- does from the browser (EgbayWeb lib/liveService.ts, app/seller-verification):
--   live_sessions            insert via book_live_session RPC only; the client
--                            updates status/timestamps/labels, never price,
--                            channel, viewer counts or the wallet charge.
--   live_chat_messages       client inserts; never edits or deletes.
--   live_pinned_products     client inserts and unpins; never deletes.
--   seller_verification_requests
--                            client inserts (always pending, see policy below);
--                            review happens through the admin RPC.
REVOKE INSERT, UPDATE, DELETE ON public.live_sessions FROM PUBLIC, anon, authenticated;
GRANT UPDATE (title, title_ar, description, thumbnail_url, category, status, scheduled_at, started_at, ended_at)
  ON public.live_sessions TO authenticated;
REVOKE UPDATE, DELETE ON public.live_chat_messages FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON public.live_pinned_products FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.seller_verification_requests FROM PUBLIC, anon, authenticated;
CREATE POLICY verification_starts_pending ON public.seller_verification_requests AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND reviewer_notes IS NULL);

-- Claiming admin/host/system fields is never authorized by a caller-selected role.
ALTER FUNCTION public.check_product_promotion_update() SET search_path=public,pg_catalog;

-- A durable cleanup request blocks old JWTs immediately. No data is reported erased yet.
CREATE OR REPLACE FUNCTION public.begin_account_deletion(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
 INSERT INTO public.account_deletion_jobs(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
 UPDATE auth.users SET banned_until='infinity'::timestamptz WHERE id=p_user_id;
 UPDATE public.products SET status='removed',updated_at=now() WHERE seller_id=p_user_id;
 DELETE FROM auth.sessions WHERE user_id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.begin_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_account_deletion(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 PERFORM public.begin_account_deletion(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
-- Every shipped build up to 23 calls this RPC directly. It now enqueues the
-- same job the delete-account edge function does, so an old client gets
-- immediate access denial, withdrawn listings and revoked sessions, and the
-- cron dispatcher finishes storage and row cleanup within a minute. New
-- clients call the edge function and get an honest complete/pending answer.

CREATE OR REPLACE FUNCTION public.authorize_cleanup_worker(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_secret IS NOT NULL AND length(p_secret)>=64 AND EXISTS(
 SELECT 1 FROM private.worker_credentials WHERE purpose='cleanup' AND secret=p_secret);
$$;
REVOKE ALL ON FUNCTION public.authorize_cleanup_worker(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_cleanup_worker(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_account_deletions(p_user_id uuid DEFAULT NULL)
RETURNS SETOF public.account_deletion_jobs LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.account_deletion_jobs SET status='processing',lease_until=now()+interval '5 minutes',attempts=attempts+1
 WHERE user_id IN(SELECT user_id FROM public.account_deletion_jobs
 WHERE status IN('pending','processing') AND (lease_until IS NULL OR lease_until<now())
 AND (p_user_id IS NULL OR user_id=p_user_id)
 ORDER BY requested_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_account_deletions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletions(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.account_storage_objects(p_user_id uuid)
RETURNS TABLE(bucket_id text,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.bucket_id,o.name FROM storage.objects o
 WHERE EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE user_id=p_user_id AND status='processing')
 AND (o.owner_id=p_user_id::text OR (o.bucket_id='kyc-documents' AND split_part(o.name,'/',1)=p_user_id::text))
 LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.account_storage_objects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_storage_objects(uuid) TO service_role;
COMMIT;
