import { supabase } from './supabase';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type LivePassTier = 'flash' | 'pro' | 'mega';

export interface LivePass {
  tier: LivePassTier;
  name: string;
  name_ar: string;
  durationMinutes: number;
  maxViewers: number;
  priceEGP: number;
  features: string[];
  features_ar: string[];
  badge: string;
  color: string;
  recommended?: boolean;
}

export interface LiveSession {
  id: string;
  seller_id: string;
  title: string;
  title_ar?: string;
  description?: string;
  pass_tier: LivePassTier;
  pass_price_egp: number;
  max_viewers: number;
  agora_channel?: string;
  thumbnail_url?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  peak_viewers: number;
  current_viewers: number;
  total_sales_egp: number;
  category?: string;
  created_at: string;
  seller?: {
    full_name?: string;
    avatar_url?: string;
  };
  pinned_products?: LivePinnedProduct[];
}

export interface LivePinnedProduct {
  id: string;
  session_id: string;
  product_id: string;
  display_price?: number;
  pinned_at: string;
  unpinned_at?: string;
  units_sold: number;
  product?: {
    id: string;
    title: string;
    price: number;
    images: string[];
  };
}

export interface LiveChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  message: string;
  is_host: boolean;
  msg_type: 'chat' | 'reaction' | 'system' | 'purchase' | 'pin';
  created_at: string;
}

// ──────────────────────────────────────────────────────────────
// Pass Configuration — Same pricing as web app
// ──────────────────────────────────────────────────────────────

export const LIVE_PASSES: LivePass[] = [
  {
    tier: 'flash',
    name: 'Flash Pass',
    name_ar: 'باس فلاش',
    durationMinutes: 30,
    maxViewers: 30,
    priceEGP: 79,
    badge: '⚡',
    color: '#F59E0B',
    features: ['30 minutes live', 'Up to 30 viewers', 'Live chat', 'Pin up to 3 products'],
    features_ar: ['بث لمدة ٣٠ دقيقة', 'حتى ٣٠ مشاهد', 'دردشة مباشرة', 'تثبيت ٣ منتجات'],
  },
  {
    tier: 'pro',
    name: 'Pro Show Pass',
    name_ar: 'باس برو',
    durationMinutes: 60,
    maxViewers: 100,
    priceEGP: 149,
    badge: '🔥',
    color: '#3665F3',
    recommended: true,
    features: ['60 min live', 'Up to 100 viewers', 'Chat + reactions', 'Pin up to 10 products', 'Push notification to all users'],
    features_ar: ['بث لمدة ٦٠ دقيقة', 'حتى ١٠٠ مشاهد', 'دردشة وتفاعلات', 'تثبيت ١٠ منتجات', 'إشعار فوري للمستخدمين'],
  },
  {
    tier: 'mega',
    name: 'Mega Event Pass',
    name_ar: 'باس ميجا',
    durationMinutes: 90,
    maxViewers: 300,
    priceEGP: 299,
    badge: '👑',
    color: '#7C3AED',
    features: ['90 min live', 'Up to 300 viewers', 'Priority CDN', 'Unlimited product pins', 'Featured on homepage'],
    features_ar: ['بث لمدة ٩٠ دقيقة', 'حتى ٣٠٠ مشاهد', 'شبكة توصيل مميزة', 'تثبيت منتجات بلا حدود', 'عرض على الصفحة الرئيسية'],
  },
];

// ──────────────────────────────────────────────────────────────
// Agora Token (via Supabase Edge Function)
// ──────────────────────────────────────────────────────────────

/**
 * Tokens come from the generate-agora-token edge function only. The previous
 * client-side generator shipped the Agora App Certificate inside the app
 * bundle, which let anyone who unpacked the IPA mint host tokens for any
 * channel. The certificate must be rotated in the Agora console; see
 * MOBILE-VERIFICATION-STATUS.md.
 */
export async function generateAgoraToken(channelName: string, uid: number, role: 'host' | 'audience'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-agora-token', {
    body: { channelName, uid, role },
  });
  if (error || !data?.token) throw new Error(error?.message || 'Could not get a streaming token');
  return data.token as string;
}

/**
 * Whether a live pass currently costs the seller nothing. This is a server
 * setting (private.platform_settings, read through live_passes_are_free()),
 * not a client assumption: the booking screen shows "free for now" only
 * because the database said so, and starts showing prices the moment the
 * operator flips the row -- no rebuild. Fails closed: an error means "not
 * free", so the screen never promises what the RPC would then refuse.
 */
export async function getLivePassesAreFree(): Promise<boolean> {
  const { data, error } = await supabase.rpc('live_passes_are_free');
  if (error) return false;
  return data === true;
}

// ──────────────────────────────────────────────────────────────
// Session Management
// ──────────────────────────────────────────────────────────────

export async function bookLiveSession(params: {
  sellerId: string;
  title: string;
  titleAr?: string;
  description?: string;
  tier: LivePassTier;
  category?: string;
}): Promise<LiveSession> {
  // Same path as the web app: /api/live/book runs book_live_session, which
  // charges the pass from the wallet and creates the row in one transaction.
  // The old client version debited the wallet through a checkout RPC with a
  // made-up order id (which could never succeed), then inserted the session
  // anyway, then returned a fabricated session object if that failed too.
  const { data: { session: auth } } = await supabase.auth.getSession();
  if (!auth) throw new Error('Not authenticated');
  const res = await fetch('https://egbay.shop/api/live/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.access_token}` },
    body: JSON.stringify({
      title: params.title,
      titleAr: params.titleAr ?? null,
      description: params.description ?? null,
      tier: params.tier,
      category: params.category ?? null,
    }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { throw new Error('Could not reach the live service. You have not been charged.'); }
  if (!res.ok || !data?.success || !data?.session) throw new Error(data?.error || 'Booking failed. You have not been charged.');
  return data.session as LiveSession;
}

export async function startLiveSession(sessionId: string, uid: number): Promise<{ token: string; channel: string }> {
  const { data: session, error } = await supabase
    .from('live_sessions')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('agora_channel')
    .single();
  if (error || !session) throw new Error(error?.message || 'Could not start the session');
  const token = await generateAgoraToken(session.agora_channel, uid, 'host');
  return { token, channel: session.agora_channel };
}

export async function endLiveSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function joinLiveSession(channelName: string, viewerUid: number): Promise<string> {
  return generateAgoraToken(channelName, viewerUid, 'audience');
}

// ──────────────────────────────────────────────────────────────
// Discovery Feed
// ──────────────────────────────────────────────────────────────

/**
 * A stream is only "live" if it says so AND started recently.
 *
 * `status` is set to 'live' when a broadcast starts and only cleared by
 * endLiveSession(). A stream that crashed, lost the network, or was killed by
 * the OS never gets ended, so its row stays 'live' forever. Three sessions on
 * this project have claimed to be live for over eight days, and the Live tab
 * advertised them in the app's primary navigation.
 *
 * Nothing streams for four hours, so anything older is a ghost.
 */
export const LIVE_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

export function isGenuinelyLive(session: Pick<LiveSession, 'status' | 'started_at'>): boolean {
  if (session.status !== 'live') return false;
  if (!session.started_at) return false;
  return Date.now() - new Date(session.started_at).getTime() < LIVE_STALE_AFTER_MS;
}

/**
 * live_sessions.seller_id points at auth.users, which PostgREST cannot embed
 * (`seller:seller_id(...)` returns PGRST200 -> 400). The old query did exactly
 * that and swallowed the error, so the Live tab and the home hero were empty
 * for everyone regardless of who was streaming. Sellers are hydrated from
 * public_profiles in a second query, as orders and chat already do.
 */
const SESSION_SELECT = `
  *,
  pinned_products:live_pinned_products (
    *,
    product:product_id (id, title, price, images)
  )
`;

async function hydrateSellers(sessions: any[]): Promise<LiveSession[]> {
  const ids = [...new Set(sessions.map(s => s.seller_id).filter(Boolean))];
  if (ids.length === 0) return sessions as LiveSession[];
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids);
  const byId = new Map((profiles ?? []).map(p => [p.id, p]));
  return sessions.map(s => ({
    ...s,
    seller: byId.get(s.seller_id)
      ? { full_name: byId.get(s.seller_id)!.full_name ?? undefined, avatar_url: byId.get(s.seller_id)!.avatar_url ?? undefined }
      : undefined,
  })) as LiveSession[];
}

export async function getActiveLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(SESSION_SELECT)
    .in('status', ['live', 'scheduled'])
    .order('status', { ascending: false })
    .order('current_viewers', { ascending: false })
    .limit(20);
  if (error) throw error;
  return hydrateSellers(data ?? []);
}

export async function getLiveSessionByChannel(channelName: string): Promise<LiveSession | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(SESSION_SELECT)
    .eq('agora_channel', channelName)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [s] = await hydrateSellers([data]);
  return s;
}

// ──────────────────────────────────────────────────────────────
// Pinned Products
// ──────────────────────────────────────────────────────────────

export async function pinProduct(sessionId: string, productId: string, displayPrice?: number): Promise<void> {
  const { error: unpinErr } = await supabase
    .from('live_pinned_products')
    .update({ unpinned_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('unpinned_at', null);
  if (unpinErr) throw unpinErr;
  const { error } = await supabase
    .from('live_pinned_products')
    .insert({ session_id: sessionId, product_id: productId, display_price: displayPrice });
  if (error) throw error;
}

export async function unpinProduct(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('live_pinned_products')
    .update({ unpinned_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('unpinned_at', null);
  if (error) throw error;
}

export async function getActivePinnedProduct(sessionId: string): Promise<LivePinnedProduct | null> {
  const { data, error } = await supabase
    .from('live_pinned_products')
    .select(`
      *,
      product:product_id (id, title, price, images)
    `)
    .eq('session_id', sessionId)
    .is('unpinned_at', null)
    .order('pinned_at', { ascending: false })
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LivePinnedProduct) ?? null;
}

// ──────────────────────────────────────────────────────────────
// Chat
// ──────────────────────────────────────────────────────────────

export async function sendChatMessage(params: {
  sessionId: string;
  userId: string;
  username: string;
  message: string;
  isHost?: boolean;
  msgType?: 'chat' | 'reaction' | 'system' | 'purchase' | 'pin';
}): Promise<void> {
  const { error } = await supabase.from('live_chat_messages').insert({
    session_id: params.sessionId,
    user_id: params.userId,
    username: params.username,
    message: params.message,
    is_host: params.isHost ?? false,
    msg_type: params.msgType ?? 'chat',
  });
  if (error) throw error;
}

export async function getRecentChatMessages(sessionId: string, limit = 50): Promise<LiveChatMessage[]> {
  const { data, error } = await supabase
    .from('live_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LiveChatMessage[];
}
