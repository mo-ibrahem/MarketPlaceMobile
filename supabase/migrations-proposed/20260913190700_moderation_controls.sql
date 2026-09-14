-- Moderators review reports through a service-only, audited action RPC.
-- Text filtering is a baseline; human image/live review remains an operating duty.
CREATE TABLE private.moderation_removals (
 target_type text NOT NULL CHECK(target_type IN('listing','message')),
 target_id uuid NOT NULL, removed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(target_type,target_id)
);
REVOKE ALL ON private.moderation_removals FROM PUBLIC,anon,authenticated;
ALTER TABLE public.content_reports ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN moderation_action text, ADD COLUMN reviewer_notes text;
REVOKE INSERT,UPDATE,DELETE ON public.content_reports FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.content_is_allowed(p_type text,p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM private.moderation_removals WHERE target_type=p_type AND target_id=p_id);
$$;
REVOKE ALL ON FUNCTION public.content_is_allowed(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_is_allowed(text,uuid) TO anon,authenticated,service_role;
CREATE POLICY moderation_visible ON public.products AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.content_is_allowed('listing',id));
CREATE POLICY moderation_no_republish ON public.products AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(public.content_is_allowed('listing',id)) WITH CHECK(public.content_is_allowed('listing',id));
CREATE POLICY moderation_visible ON public.messages AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.content_is_allowed('message',id));
CREATE OR REPLACE FUNCTION public.validate_content_text()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE body text;
BEGIN
 IF TG_TABLE_NAME='products' THEN body:=coalesce(NEW.title,'')||' '||coalesce(NEW.description,'');
 ELSIF TG_TABLE_NAME='messages' THEN body:=coalesce(NEW.content,'');
 ELSE body:=coalesce(NEW.message,''); END IF;
 body:=regexp_replace(lower(body),'[[:space:]]+',' ','g');
 IF body ~ '(child pornography|child porn|buy cocaine|cocaine for sale|heroin for sale|سأقتلك|سوف أقتلك|بيع كوكايين|بيع هيروين)' THEN
   RAISE EXCEPTION 'This content violates the community rules. Contact info@egbay.shop if this is a mistake.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_content_text() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_content_text BEFORE INSERT OR UPDATE OF title,description ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.validate_content_text();
CREATE TRIGGER validate_content_text BEFORE INSERT ON public.messages
 FOR EACH ROW EXECUTE FUNCTION public.validate_content_text();
CREATE TRIGGER validate_content_text BEFORE INSERT ON public.live_chat_messages
 FOR EACH ROW EXECUTE FUNCTION public.validate_content_text();

CREATE OR REPLACE FUNCTION public.admin_review_content_report(p_admin_id uuid,p_report_id uuid,p_action text,p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE report public.content_reports%ROWTYPE;
BEGIN
 IF NOT public.account_is_active(p_admin_id) OR NOT EXISTS(
 SELECT 1 FROM public.user_profiles WHERE id=p_admin_id AND is_admin=true) THEN
 RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN('dismiss','remove','suspend') OR char_length(coalesce(p_notes,''))>1000 THEN
 RAISE EXCEPTION 'Invalid moderation action'; END IF;
 SELECT * INTO report FROM public.content_reports WHERE id=p_report_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report unavailable'; END IF;
 IF report.status<>'open' THEN RAISE EXCEPTION 'Report already reviewed'; END IF;
 IF p_action='remove' THEN
   IF report.target_type NOT IN('listing','message') THEN RAISE EXCEPTION 'Only content can be removed'; END IF;
   INSERT INTO private.moderation_removals(target_type,target_id) VALUES(report.target_type,report.target_id) ON CONFLICT DO NOTHING;
   IF report.target_type='listing' THEN UPDATE public.products SET status='removed',updated_at=now() WHERE id=report.target_id; END IF;
 ELSIF p_action='suspend' THEN
   IF report.target_type<>'user' OR report.target_id=p_admin_id OR EXISTS(
     SELECT 1 FROM public.user_profiles WHERE id=report.target_id AND is_admin=true) THEN RAISE EXCEPTION 'Invalid suspension target'; END IF;
   UPDATE auth.users SET banned_until=now()+interval '100 years' WHERE id=report.target_id;
   DELETE FROM auth.sessions WHERE user_id=report.target_id;
   UPDATE public.products SET status='removed',updated_at=now() WHERE seller_id=report.target_id;
   UPDATE public.live_sessions SET status='ended',ended_at=now() WHERE seller_id=report.target_id AND status IN('live','scheduled');
 END IF;
 UPDATE public.content_reports SET status=CASE WHEN p_action='dismiss' THEN 'dismissed' ELSE 'actioned' END,
 reviewed_at=now(),reviewed_by=p_admin_id,moderation_action=p_action,reviewer_notes=nullif(trim(p_notes),'')
 WHERE id=p_report_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_content_report(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_content_report(uuid,uuid,text,text) TO service_role;
