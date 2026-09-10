-- Give users a way to edit their own profile again.
--
-- After 20260910120000_revoke_public_profiles_writes.sql, neither
-- public_profiles nor user_profiles grants INSERT/UPDATE to `authenticated`.
-- That correctly closed the privilege-escalation hole (a user could set their
-- own tier and is_verified_seller), but it left no write path at all: editing
-- your own name, phone or avatar now fails with
-- 42501 "permission denied for table user_profiles".
--
-- Verified against the live database as a signed-in user:
--   PATCH /rest/v1/user_profiles?id=eq.<self>  -> 42501
--   PATCH /rest/v1/public_profiles?id=eq.<self> -> 42501
--
-- The fix is a SECURITY DEFINER RPC that updates only the safe, user-owned
-- fields. Restoring a blanket UPDATE grant would reopen the escalation hole,
-- because the UPDATE policy on user_profiles is a bare `auth.uid() = id` with
-- no column restriction -- it cannot distinguish "change my name" from
-- "make me a verified tier 3 seller".
--
-- Note what is deliberately NOT settable here: tier, is_verified_seller,
-- tier_verified_at, rating_avg, rating_count, email, id.

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name  text DEFAULT NULL,
  p_phone      text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_full_name IS NOT NULL AND char_length(TRIM(p_full_name)) > 80 THEN
    RAISE EXCEPTION 'Name must be 80 characters or fewer';
  END IF;

  -- Never let a display name be set to an email address: full_name is rendered
  -- publicly on listing cards, chat and reviews (which anon can read).
  IF p_full_name IS NOT NULL AND POSITION('@' IN p_full_name) > 0 THEN
    RAISE EXCEPTION 'Display name must not contain an email address';
  END IF;

  UPDATE public.user_profiles
  SET full_name  = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
      phone      = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      avatar_url = COALESCE(NULLIF(TRIM(p_avatar_url), ''), avatar_url),
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text) TO authenticated;
