// Replaces the unauthorised, hand-written token generator inspected in production.
// Requires the blocking migration and Agora co-host authentication configuration.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.6';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, 'Method not allowed');
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, 'Authentication required');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const appId = Deno.env.get('AGORA_APP_ID');
  const certificate = Deno.env.get('AGORA_APP_CERT');
  // Subscriber privileges require this provider feature. Only set after it has
  // actually been enabled and tested in Agora; a flag does not enable it.
  if (!url || !key || !appId || !certificate ||
      Deno.env.get('AGORA_CO_HOST_AUTH_ENABLED') !== 'true') return reply(503, 'Live video is temporarily unavailable');

  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: { user }, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, 'Authentication required');
    let input;
    try { input = await req.json(); } catch { return reply(400, 'Invalid JSON'); }
    const { channelName, uid, role } = input ?? {};
    if (typeof channelName !== 'string' || !/^[A-Za-z0-9_-]{1,63}$/.test(channelName) ||
        !Number.isInteger(uid) || uid < 1 || uid > 4294967295 ||
        (role !== 'host' && role !== 'audience')) return reply(400, 'Invalid live session request');
    const { data: session, error } = await client.from('live_sessions')
      .select('seller_id,status,wallet_charge_id,pass_price_egp')
      .eq('agora_channel', channelName).maybeSingle();
    if (error) return reply(503, 'Live video is temporarily unavailable');
    if (!session || session.status !== 'live' || (session.pass_price_egp !== 0 && !session.wallet_charge_id))
      return reply(403, 'This live session is unavailable');
    if (role === 'host' && session.seller_id !== user.id)
      return reply(403, 'Only the session owner may broadcast');
    const { data: permitted, error: permissionError } = await client.rpc('can_interact_with', { p_other: session.seller_id });
    if (permissionError) return reply(503, 'Live video is temporarily unavailable');
    if (permitted !== true) return reply(403, 'This live session is unavailable');
    const ttl = 7200;
    const token = RtcTokenBuilder.buildTokenWithUid(appId, certificate, channelName, uid,
      role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER, ttl, ttl);
    if (!token) return reply(503, 'Live video is temporarily unavailable');
    return new Response(JSON.stringify({ token, channel: channelName, expireTs: Math.floor(Date.now()/1000)+ttl }), { headers });
  } catch {
    return reply(503, 'Live video is temporarily unavailable');
  }
});
