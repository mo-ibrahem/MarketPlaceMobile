-- Preserve free live and enforce ownership/state on the server.
BEGIN;
CREATE POLICY live_chat_unblocked ON public.live_chat_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.can_interact_with(user_id) AND EXISTS(
 SELECT 1 FROM public.live_sessions s WHERE s.id=session_id AND public.can_interact_with(s.seller_id)));
CREATE POLICY live_chat_safe_insert ON public.live_chat_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(user_id=auth.uid() AND msg_type IN('chat','reaction') AND char_length(trim(message)) BETWEEN 1 AND 1000
 AND EXISTS(SELECT 1 FROM public.live_sessions s WHERE s.id=session_id AND s.status='live'
 AND public.can_interact_with(s.seller_id) AND (NOT is_host OR s.seller_id=auth.uid())));
CREATE POLICY pins_owned_product ON public.live_pinned_products AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(EXISTS(SELECT 1 FROM public.live_sessions s JOIN public.products p ON p.id=product_id
 WHERE s.id=session_id AND s.seller_id=auth.uid() AND p.seller_id=auth.uid()
 AND s.status='live' AND p.status='active'));
REVOKE UPDATE ON public.live_pinned_products FROM PUBLIC,anon,authenticated;
GRANT UPDATE(unpinned_at) ON public.live_pinned_products TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_live_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role()='authenticated' THEN
   PERFORM public.require_active_account();
   IF OLD.seller_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not the session owner'; END IF;
   IF OLD.status IN('ended','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
     RAISE EXCEPTION 'This session has ended'; END IF;
   IF NEW.status='live' AND OLD.status='scheduled' THEN
     IF OLD.pass_price_egp<>0 AND OLD.wallet_charge_id IS NULL THEN RAISE EXCEPTION 'Pass is unpaid'; END IF;
     NEW.started_at:=now(); NEW.ended_at:=NULL;
   ELSE NEW.started_at:=OLD.started_at; END IF;
   IF NEW.status IN('ended','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN NEW.ended_at:=now();
   ELSE NEW.ended_at:=OLD.ended_at; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_live_transition() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_live_transition BEFORE UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_live_transition();
COMMIT;

