-- Stop publishing users' email addresses as their display name.
--
-- user_profiles.full_name is rendered publicly: listing cards, chat, and
-- reviews -- and `reviews` grants SELECT to `anon`, so a logged-out visitor
-- browsing a product page can read it. create_user_profile defaulted
-- full_name to the account's email whenever signup metadata carried no
-- full_name:
--
--     COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
--
-- so any user who signed up without setting a display name published their
-- email address on every listing they touched. At time of writing, 12 of 26
-- rows in user_profiles have full_name exactly equal to email.
--
-- The address itself is still stored in user_profiles.email, which is not part
-- of the public_profiles view; this only stops it being duplicated into the
-- public-facing name.
--
-- NOTE: this belongs in the EgbayWeb migration history alongside
-- 20260910120000_revoke_public_profiles_writes.sql. It lives here only because
-- it was authored from the mobile repo.

CREATE OR REPLACE FUNCTION public.create_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Fall back to the email's local part, never the full address.
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      'EgyBay User'
    )
  );

  INSERT INTO public.user_wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill rows already carrying an address.
-- Recoverable: every affected row still has its original value in
-- user_profiles.email, so this can be reversed with
--     UPDATE public.user_profiles SET full_name = email WHERE ...
UPDATE public.user_profiles
SET full_name = COALESCE(NULLIF(SPLIT_PART(email, '@', 1), ''), 'EgyBay User')
WHERE full_name = email
  AND full_name LIKE '%@%';
