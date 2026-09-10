/**
 * Renders a user-supplied profile name safely.
 *
 * `user_profiles.full_name` is populated from signup metadata and for a good
 * share of accounts it is literally the account's email address. Those names
 * are rendered publicly -- on listing cards, in chat, and on reviews, which
 * `anon` can read -- so printing them raw publishes people's email addresses to
 * anyone browsing, signed in or not.
 *
 * This never returns something containing an "@": an email is reduced to its
 * local part, which still distinguishes people without exposing an address.
 */
export function displayName(name?: string | null, fallback = 'EgyBay User'): string {
  const raw = (name ?? '').trim();
  if (!raw) return fallback;

  if (raw.includes('@')) {
    const local = raw.split('@')[0].trim();
    // Strip the disambiguating digits test/auto-generated locals carry.
    const cleaned = local.replace(/[._-]+/g, ' ').replace(/\s*\d{4,}\s*/g, ' ').trim();
    return cleaned || fallback;
  }

  return raw;
}
