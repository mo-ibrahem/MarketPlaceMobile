import { supabase } from './supabase';

/**
 * Report / block / account deletion, backed by the RPCs in
 * supabase/migrations-proposed/20260912090000_app_review_compliance.sql.
 *
 * Every function here either succeeds against a real row or throws. Callers
 * must not show "submitted" / "blocked" / "deleted" unless the promise
 * resolved -- an earlier version of these screens showed a success toast and
 * recorded nothing, which is exactly what App Review 1.2 rejects.
 *
 * Until the migration is applied the RPCs do not exist and PostgREST returns
 * 42883 / PGRST202; `isBackendMissing` lets the UI say so honestly and point
 * to the email fallback instead of pretending.
 */

export type ReportTargetType = 'listing' | 'user' | 'message';

export const SAFETY_EMAIL = 'info@egbay.shop';

const MISSING_CODES = new Set(['42883', 'PGRST202', '42P01']);

export const isBackendMissing = (err: any): boolean => {
  const code = String(err?.code ?? '');
  const msg = String(err?.message ?? '');
  return MISSING_CODES.has(code) || /could not find the function|does not exist/i.test(msg);
};

const requireUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
};

export const reportContent = async (targetType: ReportTargetType, targetId: string, reason: string): Promise<string> => {
  await requireUser();
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('A reason is required');
  const { data, error } = await supabase.rpc('report_content', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: trimmed.slice(0, 1000),
  });
  if (error) throw error;
  return String(data);
};

export const blockUser = async (userId: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
};

export const unblockUser = async (userId: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
};

/** Ids this user has blocked. Empty (not an error) when the table is not there yet. */
export const getBlockedUserIds = async (): Promise<Set<string>> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', user.id);
  if (error) {
    if (isBackendMissing(error)) return new Set();
    throw error;
  }
  return new Set(((data as any[]) ?? []).map(r => String(r.blocked_id)));
};

/**
 * Deletes (or, where financial records reference the account, anonymises and
 * permanently bans) the signed-in account. Resolves only after the database
 * confirmed; the caller signs out afterwards.
 */
export const deleteMyAccount = async (): Promise<{ status: 'complete' | 'pending'; receipt?: string }> => {
  await requireUser();
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  if (data?.status !== 'complete' && data?.status !== 'pending') throw new Error('Account deletion was not confirmed');
  return { status: data.status, receipt: data.receipt };
};
