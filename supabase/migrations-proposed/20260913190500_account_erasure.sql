-- Detach deleted identities from retained transaction records without deleting
-- orders/ledgers or changing counterparty balances. Personal content is erased.
BEGIN;
DO $$
DECLARE item text[]; constraint_name text;
BEGIN
 FOREACH item SLICE 1 IN ARRAY ARRAY[
 ARRAY['products','seller_id'],ARRAY['orders','buyer_id'],ARRAY['orders','seller_id'],
 ARRAY['payments','buyer_id'],ARRAY['payments','seller_id'],ARRAY['user_wallets','user_id'],
 ARRAY['wallet_topups','user_id'],ARRAY['payout_requests','user_id'],
 ARRAY['reviews','reviewer_id'],ARRAY['reviews','seller_id']]
 LOOP
   SELECT c.conname INTO constraint_name FROM pg_constraint c
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
   WHERE c.contype='f' AND c.conrelid=('public.'||item[1])::regclass
   AND c.confrelid='auth.users'::regclass AND a.attname=item[2];
   IF constraint_name IS NULL THEN RAISE EXCEPTION 'Expected auth foreign key missing: %.%',item[1],item[2]; END IF;
   EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I, ALTER COLUMN %I DROP NOT NULL',item[1],constraint_name,item[2]);
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',item[1],constraint_name,item[2]);
 END LOOP;
END $$;
ALTER TABLE public.account_deletion_jobs ADD COLUMN receipt uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
CREATE OR REPLACE FUNCTION public.account_deletion_status(p_receipt uuid)
RETURNS TABLE(status text,completed_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT j.status,j.completed_at FROM public.account_deletion_jobs j WHERE j.receipt=p_receipt;
$$;
REVOKE ALL ON FUNCTION public.account_deletion_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_deletion_status(uuid) TO anon,authenticated,service_role;
COMMIT;

