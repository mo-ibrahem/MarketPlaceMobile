import { supabase } from './supabase';
import { getUserWallet, deductWalletSpendableFunds } from './walletService';
import { generateClientAgoraToken } from './agoraToken';

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

export async function generateAgoraToken(channelName: string, uid: number, role: 'host' | 'audience'): Promise<string> {
  try {
    const token = await generateClientAgoraToken(channelName, uid, role);
    if (token) return token;
  } catch (err) {
    console.warn('[LiveService Mobile] Client token generation fallback:', err);
  }

  try {
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: { channelName, uid, role },
    });
    if (!error && data?.token) return data.token as string;
  } catch {}

  return '';
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
  const wallet = await getUserWallet(params.sellerId);
  const available = Number(wallet?.available_balance || 0);

  if (available < pass.priceEGP) {
    throw new Error(
      `رصيد غير كافٍ. المطلوب: ${pass.priceEGP} جنيه. المتاح: ${available} جنيه.`
    );
  }

  // Deduct wallet
  await deductWalletSpendableFunds(
    params.sellerId,
    pass.priceEGP,
    `live_pass_${Date.now()}`,
    `Live Pass: ${pass.name} (${pass.durationMinutes} min)`
  );

  // Create session
  try {
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

    if (!sessionErr && session) {
      return session as LiveSession;
    }
  } catch (err) {
    console.warn('[LiveService Mobile] live_sessions fallback:', err);
  }

  const fallbackSession: LiveSession = {
    id: `session_${Date.now()}`,
    seller_id: params.sellerId,
    title: params.title,
    title_ar: params.titleAr,
    description: params.description,
    pass_tier: params.tier,
    pass_price_egp: pass.priceEGP,
    max_viewers: pass.maxViewers,
    peak_viewers: 0,
    current_viewers: 0,
    total_sales_egp: 0,
    agora_channel: channelName,
    status: 'scheduled',
    category: params.category,
    created_at: new Date().toISOString(),
  };
  return fallbackSession;
}

export async function startLiveSession(sessionId: string, uid: number): Promise<{ token: string; channel: string }> {
  try {
    const { data: session, error } = await supabase
      .from('live_sessions')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select('agora_channel')
      .single();

    if (session && !error) {
      let token = '';
      try {
        token = await generateAgoraToken(session.agora_channel, uid, 'host');
      } catch {}
      return { token, channel: session.agora_channel };
    }
  } catch (err) {
    console.warn('[LiveService Mobile] startLiveSession fallback:', err);
  }

  const ch = `channel_${sessionId}`;
  let token = '';
  try {
    token = await generateAgoraToken(ch, uid, 'host');
  } catch {}
  return { token, channel: ch };
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
// Pinned Products & In-Memory Fallbacks
// ──────────────────────────────────────────────────────────────
const inMemoryPinnedProducts: Record<string, LivePinnedProduct> = {};
const inMemoryChatMessages: Record<string, LiveChatMessage[]> = {};

export async function pinProduct(sessionId: string, productId: string, displayPrice?: number): Promise<void> {
  inMemoryPinnedProducts[sessionId] = {
    id: `pin_${Date.now()}`,
    session_id: sessionId,
    product_id: productId,
    display_price: displayPrice,
    pinned_at: new Date().toISOString(),
    units_sold: 0,
  };

  try {
    // Unpin current pin
    await supabase
      .from('live_pinned_products')
      .update({ unpinned_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('unpinned_at', null);

    await supabase
      .from('live_pinned_products')
      .insert({ session_id: sessionId, product_id: productId, display_price: displayPrice });
  } catch (err) {
    console.warn('[LiveService Mobile] pinProduct fallback:', err);
  }
}

export async function unpinProduct(sessionId: string): Promise<void> {
  delete inMemoryPinnedProducts[sessionId];
  try {
    await supabase
      .from('live_pinned_products')
      .update({ unpinned_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('unpinned_at', null);
  } catch {}
}

export async function getActivePinnedProduct(sessionId: string): Promise<LivePinnedProduct | null> {
  try {
    const { data } = await supabase
      .from('live_pinned_products')
      .select(`
        *,
        product:product_id (id, title, price, images)
      `)
      .eq('session_id', sessionId)
      .is('unpinned_at', null)
      .order('pinned_at', { ascending: false })
      .maybeSingle();

    if (data) return data as unknown as LivePinnedProduct;
  } catch {}

  return inMemoryPinnedProducts[sessionId] || null;
}

export async function recordLiveSale(sessionId: string, amountEGP: number): Promise<void> {
  try {
    await supabase.rpc('increment_live_session_sales', {
      p_session_id: sessionId,
      p_amount: amountEGP,
    });
  } catch {}
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
  const newMsg: LiveChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    session_id: params.sessionId,
    user_id: params.userId,
    username: params.username,
    message: params.message,
    is_host: params.isHost ?? false,
    msg_type: params.msgType ?? 'chat',
    created_at: new Date().toISOString(),
  };

  if (!inMemoryChatMessages[params.sessionId]) {
    inMemoryChatMessages[params.sessionId] = [];
  }
  inMemoryChatMessages[params.sessionId].push(newMsg);

  try {
    await supabase.from('live_chat_messages').insert({
      session_id: params.sessionId,
      user_id: params.userId,
      username: params.username,
      message: params.message,
      is_host: params.isHost ?? false,
      msg_type: params.msgType ?? 'chat',
    });
  } catch {}
}

export async function getRecentChatMessages(sessionId: string, limit = 50): Promise<LiveChatMessage[]> {
  try {
    const { data } = await supabase
      .from('live_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (data && data.length > 0) return data as LiveChatMessage[];
  } catch {}

  return inMemoryChatMessages[sessionId] || [];
}
