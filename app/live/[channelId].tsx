import { inlineScriptValue } from '../../src/services/lib/paymentSafety';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  ArrowLeft,
  AlertCircle,
  Flag,
  ChevronDown,
  Heart,
  MessageSquare,
  Pin,
  Send,
  Share2,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import Toast from 'react-native-toast-message';
import { isBackendMissing, reportContent, SAFETY_EMAIL } from '../../src/services/lib/moderationService';
import {
  getLiveSessionByChannel,
  getRecentChatMessages,
  joinLiveSession,
  sendChatMessage,
  type LiveChatMessage,
  type LivePinnedProduct,
  type LiveSession,
} from '../../src/services/lib/liveService';
import { supabase } from '../../src/services/lib/supabase';
import NotAvailableYet from '../../src/components/NotAvailableYet';
import { LIVE_ENABLED } from '../../src/services/lib/platformCommerce';
import { AGORA_APP_ID } from '../../src/services/lib/agoraConfig';

function buildViewerHTML(appId: string, token: string, channel: string, uid: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow: hidden; width: 100vw; height: 100vh; }
  #remote-video { width: 100vw; height: 100vh; object-fit: cover; }
  #loading { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-family: sans-serif; font-size: 14px; background: #0b0f19; }
</style>
</head>
<body>
<div id="loading">جاري الاتصال بالبث المباشر...</div>
<div id="remote-video"></div>
<script src="https://cdn.agora.io/sdk/release/AgoraRTC_N.js"></script>
<script>
const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
const appId = ${inlineScriptValue(appId)};
const token = ${inlineScriptValue(token)};
const channel = ${inlineScriptValue(channel)};
const uid = ${inlineScriptValue(uid)};
const loading = document.getElementById('loading');
client.on('connection-state-change', (cur) => {
  if (cur === 'RECONNECTING') { loading.textContent = 'إعادة الاتصال بالبث...'; loading.style.display = 'block'; }
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STATE', state: cur }));
});

// Register media listeners before joining. A host who is already publishing
// can be announced immediately during join, and installing these afterwards
// can leave the viewer connected to a black screen.
client.on('user-published', async (user, mediaType) => {
  await client.subscribe(user, mediaType);
  if (mediaType === 'video') {
    client.setStreamFallbackOption(user.uid, 2).catch(() => {});
    user.videoTrack.play(document.getElementById('remote-video'), { fit: 'cover' });
    loading.style.display = 'none';
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIDEO_STARTED' }));
  }
  if (mediaType === 'audio') user.audioTrack.play();
});
client.on('stream-fallback', (uidF, direction) => {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FALLBACK', direction }));
});
client.on('user-unpublished', (user, mediaType) => {
  if (mediaType === 'video') {
    loading.textContent = 'تم إيقاف كاميرا المضيف مؤقتاً';
    loading.style.display = 'flex';
  }
});

async function join() {
  try {
    // level 1 = interactive-live latency (the TikTok/Instagram feel, ~1-2s),
    // rather than the 2-4s of plain broadcast. The host pays the same either way.
    await client.setClientRole('audience', { level: 1 });
    await client.join(appId, channel, token, uid);
    loading.textContent = 'متصل — في انتظار كاميرا المضيف...';
  } catch (e) {
    document.getElementById('loading').textContent = 'تعذر الاتصال بالبث: ' + e.message;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', error: e.message }));
  }
}
join();
</script>
</body>
</html>`;
}

export default function LiveViewerScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [viewerUid, setViewerUid] = useState<number>(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [pinnedProduct, setPinnedProduct] = useState<LivePinnedProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [streamError, setStreamError] = useState('');

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Live is off in this build: nothing here can be reached, so don't even fetch.
    if (!LIVE_ENABLED) return;
    if (!channelId) return;

    (async () => {
      try {
        const s = await getLiveSessionByChannel(channelId);
        if (!s) {
          router.replace('/(tabs)/live');
          return;
        }
        setSession(s);
        setViewerCount(s.current_viewers || 0);

        const msgs = await getRecentChatMessages(s.id);
        setMessages(msgs);

        const activePin = s.pinned_products?.find(p => !p.unpinned_at);
        if (activePin) setPinnedProduct(activePin);

        const uid = 1 + Math.floor(Math.random() * 1000000);
        setViewerUid(uid);

        const token = await joinLiveSession(channelId, uid);
        setAgoraToken(token);
      } catch (err) {
        console.error('[LiveViewer]', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [channelId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!session?.id) return;

    const sessionSub = supabase
      .channel(`viewer_session_${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${session.id}` }, payload => {
        if (payload.new.status === 'ended') {
          router.replace('/(tabs)/live');
          return;
        }
        setViewerCount(payload.new.current_viewers ?? 0);
      })
      .subscribe();

    const chatSub = supabase
      .channel(`viewer_chat_${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${session.id}` }, payload => {
        setMessages(prev => [...prev.slice(-99), payload.new as LiveChatMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      })
      .subscribe();

    const pinsSub = supabase
      .channel(`viewer_pins_${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_pinned_products', filter: `session_id=eq.${session.id}` }, payload => {
        if (payload.eventType === 'INSERT') setPinnedProduct(payload.new as LivePinnedProduct);
        if (payload.eventType === 'UPDATE' && payload.new.unpinned_at) setPinnedProduct(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(chatSub);
      supabase.removeChannel(pinsSub);
    };
  }, [session?.id]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !user || !session) return;
    const msg = chatInput.trim();
    setChatInput('');
    try {
      await sendChatMessage({
        sessionId: session.id,
        userId: user.id,
        username: user.user_metadata?.full_name || 'مشتري',
        message: msg,
      });
    } catch (err: any) {
      setChatInput(msg); // give the text back; nothing was sent
      Toast.show({ type: 'error', text1: 'لم يتم إرسال الرسالة', text2: err?.message || 'حاول مرة أخرى' });
    }
  };

  const handleReaction = (emoji: string) => {
    // eslint-disable-next-line react-hooks/purity -- Called only by the reaction button's onPress event.
    const id = Date.now();
    // eslint-disable-next-line react-hooks/purity -- Random animation placement is chosen on a user press.
    const x = Math.random() * 70 + 15;
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2200);

    if (user && session) {
      sendChatMessage({
        sessionId: session.id,
        userId: user.id,
        username: user.user_metadata?.full_name || 'مشتري',
        message: emoji,
        msgType: 'reaction',
      }).catch(() => {});
    }
  };

  // Live is off in this build (LIVE_ENABLED).
  if (!LIVE_ENABLED) {
    return <NotAvailableYet />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={{ color: '#94A3B8', fontSize: 13 }}>جاري الاتصال بالبث المباشر...</Text>
      </View>
    );
  }

  const viewerHTML = agoraToken && session?.agora_channel
    ? buildViewerHTML(AGORA_APP_ID, agoraToken, session.agora_channel, viewerUid)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      {/* Video View */}
      <View style={{ flex: 1, position: 'relative' }}>
        {viewerHTML ? (
          <WebView
            source={{ html: viewerHTML }}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onMessage={(event) => {
              try {
                const message = JSON.parse(event.nativeEvent.data);
                if (message.type === 'ERROR') setStreamError(message.error || 'تعذر تشغيل البث');
                if (message.type === 'VIDEO_STARTED') setStreamError('');
              } catch { /* Ignore SDK status strings from older builds. */ }
            }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>البث غير متوفر حالياً</Text>
          </View>
        )}

        {!!streamError && (
          <View style={styles.streamError}>
            <AlertCircle color="#FCA5A5" size={16} />
            <Text style={{ color: '#FECACA', fontSize: 12, flex: 1, textAlign: 'right' }}>{streamError}</Text>
          </View>
        )}

        {/* Floating Reactions */}
        {reactions.map(r => (
          <Text
            key={r.id}
            style={{
              position: 'absolute',
              bottom: 120,
              left: `${r.x}%`,
              fontSize: 28,
            }}
          >
            {r.emoji}
          </Text>
        ))}

        {/* Top Header Overlay */}
        <View style={[styles.topOverlay, { paddingTop: 6 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconCircle}>
            <ArrowLeft color="white" size={18} />
          </TouchableOpacity>

          <View style={styles.sellerHeaderInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{session?.seller?.full_name?.[0]?.toUpperCase() || 'S'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName} numberOfLines={1}>{session?.seller?.full_name || 'البائع'}</Text>
              <Text style={styles.streamTitle} numberOfLines={1}>{session?.title_ar || session?.title}</Text>
            </View>
          </View>

          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>

          <View style={styles.viewersTag}>
            <Users color="#60A5FA" size={11} />
            <Text style={styles.viewersNum}>{viewerCount}</Text>
          </View>

          {/* A live stream is user-generated content (Guideline 1.2): the
              viewer must be able to report the person broadcasting. Writes a
              content_reports row; no toast unless the RPC actually resolved. */}
          {!!session?.seller_id && user?.id !== session.seller_id && (
            <TouchableOpacity
              onPress={() => {
                const sellerId = session.seller_id;
                const send = async (reason: string) => {
                  try {
                    await reportContent('user', sellerId, `${reason} (live ${session.id})`);
                  } catch (err: any) {
                    Alert.alert('لم يتم إرسال البلاغ', isBackendMissing(err)
                      ? `الإبلاغ غير متاح مؤقتاً. راسلنا على ${SAFETY_EMAIL}.`
                      : (err?.message || 'حاول مرة أخرى.'));
                    return;
                  }
                  Toast.show({ type: 'success', text1: 'تم إرسال البلاغ', text2: 'سيراجعه فريق الأمان خلال ٢٤ ساعة' });
                };
                Alert.alert('الإبلاغ عن هذا البث', 'ما سبب البلاغ؟', [
                  { text: 'إلغاء', style: 'cancel' },
                  { text: 'محتوى غير لائق', onPress: () => send('Inappropriate live content') },
                  { text: 'احتيال أو تضليل', onPress: () => send('Scam or misleading') },
                  { text: 'سلع محظورة', onPress: () => send('Prohibited items') },
                ]);
              }}
              style={styles.iconCircle}
              accessibilityLabel="Report this stream"
            >
              <Flag color="white" size={16} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pinned Product Card (Bottom left / overlay) */}
        {pinnedProduct && (
          <View style={[styles.pinnedCard, { bottom: showChat ? 276 : 70 }]}>
            {pinnedProduct.product?.images?.[0] ? (
              <Image source={{ uri: pinnedProduct.product.images[0] }} style={styles.pinnedImg} />
            ) : (
              <View style={[styles.pinnedImg, { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }]}>
                <ShoppingBag color="#94A3B8" size={16} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedTitle} numberOfLines={1}>{pinnedProduct.product?.title}</Text>
              <Text style={styles.pinnedPrice}>
                {(pinnedProduct.display_price || pinnedProduct.product?.price || 0).toLocaleString('ar-EG')} ج.م
              </Text>
            </View>
            <TouchableOpacity
              style={styles.buyBtn}
              onPress={() => router.push(`/checkout?productId=${pinnedProduct.product_id}` as any)}
            >
              <ShoppingBag color="white" size={13} />
              <Text style={styles.buyBtnText}>شراء بضمان</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Quick Reactions */}
        <View style={[styles.reactionBar, { bottom: showChat ? 230 : 20 }]}>
          {['❤️', '🔥', '👏', '😮', '🎉'].map(emoji => (
            <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)} style={styles.emojiBtn}>
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowChat(!showChat)} style={[styles.emojiBtn, { backgroundColor: '#3B82F6' }]}>
            <MessageSquare color="white" size={16} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Overlay Panel (Semi-transparent over bottom) */}
      {showChat && (
        // Full-screen avoider, panel at its bottom: the keyboard lifts the
        // panel instead of padding inside its fixed height (see studio.tsx).
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={styles.chatLayer}>
        <View style={[styles.chatSheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)} style={styles.chatClose} accessibilityLabel="Close live chat">
              <X color="white" size={18} />
            </TouchableOpacity>
            <Text style={styles.chatTitle}>دردشة البث</Text>
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}
            renderItem={({ item: msg }) => {
              if (msg.msg_type === 'purchase') {
                return (
                  <View style={{ backgroundColor: '#451A03', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 10, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={13} color="#FCD34D" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FCD34D' }}>طلب مؤكد بالبث!</Text>
                      <Text style={{ fontSize: 11, color: '#34D399', fontWeight: '700' }}>{msg.message}</Text>
                    </View>
                  </View>
                );
              }
              if (msg.msg_type === 'pin') {
                return (
                  <View style={{ backgroundColor: '#1E1B4B', borderWidth: 1, borderColor: '#6366F1', borderRadius: 8, padding: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pin size={11} color="#C7D2FE" />
                    <Text style={{ fontSize: 11, color: '#C7D2FE', fontWeight: '600' }}>{msg.message}</Text>
                  </View>
                );
              }
              return (
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                  <View style={[styles.chatAvatar, msg.is_host && { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.chatAvatarText}>{msg.username?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.chatBubble}>
                    <Text style={[styles.chatAuthor, msg.is_host && { color: '#FCA5A5', fontWeight: '800' }]}>
                      {msg.username} {msg.is_host ? '(HOST)' : ''}
                    </Text>
                    <Text style={styles.chatMsg}>{msg.message}</Text>
                  </View>
                </View>
              );
            }}
          />

          {user ? (
            <View style={styles.chatInputRow}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="اكتب رسالة في البث..."
                placeholderTextColor="#9CA3AF"
                style={styles.chatInput}
                onSubmitEditing={handleSendChat}
              />
              <TouchableOpacity onPress={handleSendChat} style={styles.chatSendBtn}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
                <Send color="white" size={15} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push('/login' as any)} style={styles.loginToChatBtn}>
              <Text style={styles.loginToChatText}>سجّل الدخول للمشاركة في الدردشة والشراء</Text>
            </TouchableOpacity>
          )}
        </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingBottom: 8,
    zIndex: 20,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '800', color: 'white' },
  sellerName: { fontSize: 11, fontWeight: '700', color: 'white' },
  streamTitle: { fontSize: 11, color: '#CBD5E1' },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'white' },
  liveText: { fontSize: 11, fontWeight: '900', color: 'white' },
  viewersTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  viewersNum: { fontSize: 11, color: 'white', fontWeight: '700' },

  pinnedCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 20,
  },
  pinnedImg: { width: 44, height: 44, borderRadius: 10 },
  pinnedTitle: { fontSize: 12, fontWeight: '700', color: 'white' },
  pinnedPrice: { fontSize: 14, fontWeight: '900', color: '#60A5FA' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buyBtnText: { fontSize: 11, fontWeight: '800', color: 'white' },

  reactionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 25,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatLayer: { position: 'absolute', zIndex: 40, left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  chatSheet: {
    height: 220,
    backgroundColor: 'rgba(3,7,18,0.96)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  chatHeader: { minHeight: 42, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  chatClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  chatTitle: { color: 'white', fontSize: 14, fontWeight: '800' },
  streamError: { position: 'absolute', zIndex: 24, top: 58, left: 12, right: 12, borderRadius: 12, padding: 10, backgroundColor: 'rgba(127,29,29,0.94)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  chatAvatarText: { fontSize: 11, color: 'white', fontWeight: '700' },
  chatBubble: { flex: 1 },
  chatAuthor: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  chatMsg: { fontSize: 12, color: 'white', lineHeight: 16 },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    color: 'white',
  },
  chatSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginToChatBtn: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  loginToChatText: { fontSize: 11, color: '#60A5FA', fontWeight: '700' },
});
