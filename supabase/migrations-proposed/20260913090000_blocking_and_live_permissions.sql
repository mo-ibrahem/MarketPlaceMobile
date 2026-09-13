-- Draft against live schema inspected 2026-09-13. NOT APPLIED.
-- Apply in staging first and test with two users; no destructive data cleanup.
BEGIN;

-- Callers can inspect only their own interaction permission, never another
-- user's private block list. SECURITY DEFINER avoids recursive blocked_users RLS.
CREATE OR REPLACE FUNCTION public.can_interact_with(p_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL AND p_other IS NOT NULL
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now()))
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_other
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now()))
    AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_other)
         OR (b.blocker_id = p_other AND b.blocked_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_interact_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_interact_with(uuid) TO authenticated, service_role;

-- Restrictive policies AND with existing membership policies, so another
-- permissive policy cannot bypass blocking or participant validation.
CREATE POLICY "blocked users cannot create chat rooms" ON public.chat_rooms
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  cardinality(participant_ids) = 2
  AND participant_ids[1] <> participant_ids[2]
  AND auth.uid() = ANY(participant_ids)
  AND public.can_interact_with(participant_ids[1])
  AND public.can_interact_with(participant_ids[2])
);
CREATE POLICY "blocked users cannot send messages" ON public.messages
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id
    AND cardinality(r.participant_ids) = 2
    AND public.can_interact_with(r.participant_ids[1])
    AND public.can_interact_with(r.participant_ids[2]))
);
-- Old private messages remain available for transaction disputes, but no new
-- messages or notifications can be generated across a block.

CREATE POLICY "live chat respects blocks" ON public.live_chat_messages
AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_interact_with(user_id));
CREATE POLICY "live chat prevents impersonation" ON public.live_chat_messages
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  msg_type IN ('chat','reaction')
  AND char_length(trim(message)) BETWEEN 1 AND 1000
  AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id
    AND s.status = 'live' AND public.can_interact_with(s.seller_id)
    AND (is_host = false OR s.seller_id = auth.uid()))
);

-- Only server-side booking controls price, entitlement, channel and ledger IDs.
REVOKE UPDATE ON public.live_sessions FROM authenticated;
GRANT UPDATE (title,title_ar,description,thumbnail_url,category,status,scheduled_at,started_at,ended_at)
  ON public.live_sessions TO authenticated;

-- Applicant cannot supply approval or reviewer metadata on insert.
CREATE POLICY "verification starts pending" ON public.seller_verification_requests
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (status = 'pending' AND reviewed_by IS NULL
  AND reviewed_at IS NULL AND reviewer_notes IS NULL);

ALTER FUNCTION public.create_user_profile() SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_product_promotion_update() SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_product_promotion_update() FROM PUBLIC, anon, authenticated;

-- This RPC is exclusively for the trusted image cleanup Edge Function.
CREATE OR REPLACE FUNCTION public.product_image_cleanup_paths(p_seller_id uuid, p_paths text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
  SELECT coalesce(array_agg(o.name), ARRAY[]::text[])
  FROM storage.objects o
  WHERE o.bucket_id = 'product-images' AND o.owner_id = p_seller_id::text AND o.name = ANY(p_paths);
$$;
REVOKE ALL ON FUNCTION public.product_image_cleanup_paths(uuid,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_image_cleanup_paths(uuid,text[]) TO service_role;

-- Keep the intentional public projection, but never expose an email as a name.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, CASE WHEN position('@' in coalesce(full_name,'')) > 0 THEN 'EgyBay User'
  ELSE full_name END AS full_name,
  avatar_url, tier, is_verified_seller, rating_avg, rating_count
FROM public.user_profiles;

COMMIT;
