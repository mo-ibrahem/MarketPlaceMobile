-- Supabase Auth scans banned_until into a finite Go timestamp; infinity breaks
-- its admin deletion API. The deletion job denies access independently.
CREATE OR REPLACE FUNCTION public.begin_account_deletion(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
 INSERT INTO public.account_deletion_jobs(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
 UPDATE auth.users SET banned_until=now()+interval '100 years' WHERE id=p_user_id;
 UPDATE public.products SET status='removed',updated_at=now() WHERE seller_id=p_user_id;
 DELETE FROM auth.sessions WHERE user_id=p_user_id;
END $$;

UPDATE auth.users u SET banned_until=now()+interval '100 years'
WHERE u.banned_until='infinity'::timestamptz AND EXISTS(
 SELECT 1 FROM public.account_deletion_jobs j WHERE j.user_id=u.id);
