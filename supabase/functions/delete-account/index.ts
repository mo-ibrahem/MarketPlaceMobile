import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply(503, { error: 'Account deletion unavailable' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let userId: string | null = null;
  let receipt: string | undefined;
  const workerSecret = req.headers.get('x-cleanup-secret');
  if (workerSecret) {
    const { data, error } = await admin.rpc('authorize_cleanup_worker', { p_secret: workerSecret });
    if (error) return reply(503, { error: 'Cleanup unavailable' });
    if (data !== true) return reply(401, { error: 'Unauthorized' });
  } else {
    const bearer = req.headers.get('authorization');
    if (!bearer?.startsWith('Bearer ')) return reply(401, { error: 'Authentication required' });
    const { data: { user }, error } = await admin.auth.getUser(bearer.slice(7));
    if (error || !user) return reply(401, { error: 'Authentication required' });
    // Never accept a target account ID supplied by the caller.
    userId = user.id;
    const { error: beginError } = await admin.rpc('begin_account_deletion', { p_user_id: userId });
    if (beginError) return reply(503, { error: 'Could not start account deletion. Please try again.' });
    const { data: job } = await admin.from('account_deletion_jobs').select('receipt').eq('user_id', userId).single();
    receipt = job?.receipt;
  }
  const { data: jobs, error: claimError } = await admin.rpc('claim_account_deletions', { p_user_id: userId });
  if (claimError) return reply(userId ? 202 : 503, { status: 'pending', receipt });
  let completed = false;
  for (const job of jobs ?? []) {
    try {
      let drained = false;
      for (let batch = 0; batch < 20; batch++) {
        const { data: objects, error } = await admin.rpc('account_storage_objects', { p_user_id: job.user_id });
        if (error) throw error;
        if (!objects?.length) { drained = true; break; }
        const buckets = new Set<string>(objects.map((o: { bucket_id: string }) => o.bucket_id));
        for (const bucket of buckets) {
          const paths = objects.filter((o: { bucket_id: string }) => o.bucket_id === bucket).map((o: { name: string }) => o.name);
          const { error: removeError } = await admin.storage.from(bucket).remove(paths);
          if (removeError) throw removeError;
        }
      }
      if (!drained) throw new Error('More storage cleanup remains');
      // Erase personal content before deleting auth. Nullable financial FKs
      // retain transaction records without deleting counterpart balances.
      const { error: purgeError } = await admin.rpc('purge_account_data', { p_user_id: job.user_id });
      if (purgeError) throw purgeError;
      const { error: deleteError } = await admin.auth.admin.deleteUser(job.user_id);
      if (deleteError) {
        const { error: lookupError } = await admin.auth.admin.getUserById(job.user_id);
        if (lookupError?.status !== 404 && lookupError?.code !== 'user_not_found') throw deleteError;
      }
      const { error: finishError } = await admin.from('account_deletion_jobs').update({
        status: 'complete', completed_at: new Date().toISOString(), lease_until: null,
      }).eq('user_id', job.user_id);
      if (finishError) throw finishError;
      if (userId === job.user_id) completed = true;
    } catch {
      // No account contents, tokens or raw provider errors in logs.
      console.warn('Account cleanup requires retry');
      await admin.from('account_deletion_jobs').update({ status: 'pending', lease_until: null }).eq('user_id', job.user_id);
    }
  }
  return reply(userId && !completed ? 202 : 200, { status: completed ? 'complete' : userId ? 'pending' : 'processed', receipt });
});
