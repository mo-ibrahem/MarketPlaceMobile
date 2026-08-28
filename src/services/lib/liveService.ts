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
  msg_type: 'chat' | 'reaction' | 'system';
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

export async function generateAgoraToken(channelName: string, uid: number, role: 'host' | 'audience'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-agora-token', {
    body: { channelName, uid, role },
  });
  if (error) throw new Error(error.message);
  return data.token as string;
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
  const pass = LIVE_PASSES.find(p => p.tier === params.tier)!;
  const channelName = `egbay_live_${Date.now()}_${params.sellerId.slice(0, 8)}`;

  // Check wallet balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('available_balance')
    .eq('user_id', params.sellerId)
    .single();

  if (!wallet || wallet.available_balance < pass.priceEGP) {
    throw new Error(
      `رصيد غير كافٍ. المطلوب: ${pass.priceEGP} جنيه. المتاح: ${wallet?.available_balance ?? 0} جنيه.`
    );
  }

  // Deduct wallet
  await supabase
    .from('wallets')
    .update({ available_balance: wallet.available_balance - pass.priceEGP })
    .eq('user_id', params.sellerId);

  // Create session
  const { data: session, error: sessionErr } = await supabase
    .from('live_sessions')
    .insert({
      seller_id: params.sellerId,
      title: params.title,
      title_ar: params.titleAr,
      description: params.description,
      pass_tier: params.tier,
      pass_price_egp: pass.priceEGP,
      max_viewers: pass.maxViewers,
      agora_channel: channelName,
      status: 'scheduled',
      category: params.category,
    })
    .select()
    .single();

  if (sessionErr) throw sessionErr;
  return session as LiveSession;
}

export async function startLiveSession(sessionId: string, uid: number): Promise<{ token: string; channel: string }> {
  const { data: session, error } = await supabase
    .from('live_sessions')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('agora_channel')
    .single();

  if (error) throw error;
  const token = await generateAgoraToken(session.agora_channel, uid, 'host');
  return { token, channel: session.agora_channel };
}

export async function endLiveSession(sessionId: string): Promise<void> {
  await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export async function joinLiveSession(channelName: string, viewerUid: number): Promise<string> {
  return generateAgoraToken(channelName, viewerUid, 'audience');
}

// ──────────────────────────────────────────────────────────────
// Discovery Feed
// ──────────────────────────────────────────────────────────────

export async function getActiveLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(`
      *,
      seller:seller_id (full_name, avatar_url),
      pinned_products:live_pinned_products (
        *,
        product:product_id (id, title, price, images)
      )
    `)
    .in('status', ['live', 'scheduled'])
    .order('status', { ascending: false })
    .order('current_viewers', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []) as unknown as LiveSession[];
}

export async function getLiveSessionByChannel(channelName: string): Promise<LiveSession | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(`
      *,
      seller:seller_id (full_name, avatar_url),
      pinned_products:live_pinned_products (
        *,
        product:product_id (id, title, price, images)
      )
    `)
    .eq('agora_channel', channelName)
    .single();

  if (error) return null;
  return data as unknown as LiveSession;
}

// ──────────────────────────────────────────────────────────────
// Pinned Products
// ──────────────────────────────────────────────────────────────

export async function pinProduct(sessionId: string, productId: string, displayPrice?: number): Promise<void> {
  // Unpin current pin
  await supabase
    .from('live_pinned_products')
    .update({ unpinned_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('unpinned_at', null);

  await supabase
    .from('live_pinned_products')
    .insert({ session_id: sessionId, product_id: productId, display_price: displayPrice });
}

export async function unpinProduct(sessionId: string): Promise<void> {
  await supabase
    .from('live_pinned_products')
    .update({ unpinned_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('unpinned_at', null);
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
  msgType?: 'chat' | 'reaction' | 'system';
}): Promise<void> {
  await supabase.from('live_chat_messages').insert({
    session_id: params.sessionId,
    user_id: params.userId,
    username: params.username,
    message: params.message,
    is_host: params.isHost ?? false,
    msg_type: params.msgType ?? 'chat',
  });
}

export async function getRecentChatMessages(sessionId: string, limit = 50): Promise<LiveChatMessage[]> {
  const { data } = await supabase
    .from('live_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data ?? []) as LiveChatMessage[];
}
