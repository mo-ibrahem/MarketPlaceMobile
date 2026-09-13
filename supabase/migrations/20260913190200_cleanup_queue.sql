-- Durable image cleanup. Worker secret is generated in the database, never in source.
BEGIN;
CREATE TABLE public.product_image_cleanup_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), old_record jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0,
 lease_until timestamptz
);
ALTER TABLE public.product_image_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_image_cleanup_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.product_image_cleanup_jobs TO service_role;
CREATE OR REPLACE FUNCTION public.queue_product_image_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF cardinality(OLD.images)>0 THEN
 INSERT INTO public.product_image_cleanup_jobs(old_record)
 VALUES(jsonb_build_object('seller_id',OLD.seller_id,'images',OLD.images)); END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.queue_product_image_cleanup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_product_image_cleanup AFTER DELETE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.queue_product_image_cleanup();
CREATE OR REPLACE FUNCTION public.claim_product_image_cleanups()
RETURNS SETOF public.product_image_cleanup_jobs LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.product_image_cleanup_jobs SET attempts=attempts+1,lease_until=now()+interval '5 minutes'
 WHERE id IN(SELECT id FROM public.product_image_cleanup_jobs WHERE lease_until IS NULL OR lease_until<now()
 ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_product_image_cleanups() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_product_image_cleanups() TO service_role;
CREATE OR REPLACE FUNCTION public.product_image_cleanup_paths(p_seller_id uuid,p_paths text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(array_agg(o.name),'{}'::text[]) FROM storage.objects o
 WHERE o.bucket_id='product-images' AND o.owner_id=p_seller_id::text AND o.name=ANY(p_paths)
 -- Preserve images reused by another still-existing listing from the same seller.
 AND NOT EXISTS(SELECT 1 FROM public.products p WHERE p.seller_id=p_seller_id
 AND EXISTS(SELECT 1 FROM unnest(p.images) img WHERE img LIKE '%/product-images/'||o.name));
$$;
REVOKE ALL ON FUNCTION public.product_image_cleanup_paths(uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_image_cleanup_paths(uuid,text[]) TO service_role;

-- Defense in depth: also revoke any pre-existing column grants on disabled mutations.
DO $$
DECLARE t text; cols text;
BEGIN
 FOREACH t IN ARRAY ARRAY['chat_rooms','messages','live_sessions','live_chat_messages','live_pinned_products','seller_verification_requests']
 LOOP
 SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid=('public.'||t)::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE format('REVOKE UPDATE (%s) ON public.%I FROM PUBLIC, anon, authenticated',cols,t);
 IF t NOT IN('chat_rooms','messages') THEN
 EXECUTE format('REVOKE INSERT (%s) ON public.%I FROM PUBLIC, anon, authenticated',cols,t); END IF;
 END LOOP;
END $$;
COMMIT;

