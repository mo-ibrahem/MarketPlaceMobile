import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users,
  MessageSquare, Send, Pin, X, ShoppingBag, AlertCircle
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import {
  startLiveSession, endLiveSession,
  pinProduct, unpinProduct,
  sendChatMessage, getRecentChatMessages,
  type LiveSession, type LiveChatMessage
} from '../../src/services/lib/liveService';
import { productService } from '../../src/services/lib/products';
import { supabase } from '../../src/services/lib/supabase';

// Agora Studio runs via WebView since react-native-agora requires native rebuild
// The WebView loads a self-contained Agora WebRTC host page
const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';

function buildStudioHTML(appId: string, token: string, channel: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow: hidden; }
  #local-video { width: 100vw; height: 100vh; object-fit: cover; }
  #status { position: fixed; top: 12px; left: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-family: sans-serif; }
</style>
</head>
<body>
<video id="local-video" autoplay muted playsinline></video>
<div id="status">جاري الاتصال...</div>
<script src="https://cdn.agora.io/sdk/release/AgoraRTC_N.js"></script>
<script>
const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
const appId = '${appId}';
const token = '${token}';
const channel = '${channel}';
let localVideoTrack, localAudioTrack;
async function start() {
  try {
    await client.setClientRole('host');
    await client.join(appId, channel, token, null);
    [localAudioTrack, localVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    const video = document.getElementById('local-video');
    const stream = new MediaStream([localVideoTrack.getMediaStreamTrack(), localAudioTrack.getMediaStreamTrack()]);
    video.srcObject = stream;
    await client.publish([localAudioTrack, localVideoTrack]);
    document.getElementById('status').textContent = '🔴 LIVE';
    window.ReactNativeWebView.postMessage('LIVE_STARTED');
  } catch (e) {
    document.getElementById('status').textContent = 'Error: ' + e.message;
    window.ReactNativeWebView.postMessage('ERROR:' + e.message);
  }
}
window.addEventListener('message', (e) => {
  if (e.data === 'TOGGLE_MIC') localAudioTrack?.setEnabled(!localAudioTrack?.enabled);
  if (e.data === 'TOGGLE_CAM') localVideoTrack?.setEnabled(!localVideoTrack?.enabled);
  if (e.data === 'END') { client.leave(); }
});
start();
</script>
</body>
</html>`;
}

export default function StudioScreen() {
  const { session: sessionId } = useLocalSearchParams<{ session: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const webViewRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      const { data } = await supabase.from('live_sessions').select('*').eq('id', sessionId).single();
      if (data) setSession(data as LiveSession);
      const msgs = await getRecentChatMessages(sessionId);
      setMessages(msgs);
      const prods = await productService.getProductsBySeller(user.id);
      setListings(prods ?? []);
    })();

    const sessionSub = supabase
      .channel(`studio_${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` }, p => {
        setViewerCount(p.new.current_viewers ?? 0);
      })
      .subscribe();

    const chatSub = supabase
      .channel(`studio_chat_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${sessionId}` }, p => {
        setMessages(prev => [...prev.slice(-99), p.new as LiveChatMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 50);
      })
      .subscribe();

    return () => { supabase.removeChannel(sessionSub); supabase.removeChannel(chatSub); };
  }, [sessionId, user]);

  const handleGoLive = useCallback(async () => {
    if (!sessionId || !user || !session) return;
    setStarting(true);
    setError('');
    try {
      const uid = Math.floor(Math.random() * 1000000);
      const { token, channel } = await startLiveSession(sessionId, uid);
      setAgoraToken(token);
      setIsLive(true);
      await sendChatMessage({ sessionId, userId: user.id, username: 'EgyBay', message: '🔴 البث انطلق! مرحباً بالجميع 🎉', isHost: true, msgType: 'system' });
    } catch (err: any) {
      setError(err?.message || 'تعذر بدء البث');
    } finally {
      setStarting(false);
    }
  }, [sessionId, user, session]);

  const handleEndStream = useCallback(() => {
    Alert.alert('إنهاء البث', 'هل تريد إنهاء البث المباشر؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إنهاء البث',
        style: 'destructive',
        onPress: async () => {
          webViewRef.current?.postMessage('END');
          if (sessionId) await endLiveSession(sessionId);
          router.replace('/live' as any);
        },
      },
    ]);
  }, [sessionId, router]);

  const toggleMic = () => {
    webViewRef.current?.postMessage('TOGGLE_MIC');
    setMicOn(v => !v);
  };

  const toggleCam = () => {
    webViewRef.current?.postMessage('TOGGLE_CAM');
    setCamOn(v => !v);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !user || !sessionId) return;
    const msg = chatInput.trim();
    setChatInput('');
    await sendChatMessage({ sessionId, userId: user.id, username: user.user_metadata?.full_name || 'Host', message: msg, isHost: true });
  };

  const handlePinProduct = async (product: any) => {
    if (!sessionId) return;
    await pinProduct(sessionId, product.id, product.price);
    setShowProductPicker(false);
  };

  const studioHTML = isLive && agoraToken && session?.agora_channel
    ? buildStudioHTML(AGORA_APP_ID, agoraToken, session.agora_channel)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      {/* Video Area */}
      <View style={{ flex: 1, position: 'relative' }}>
        {studioHTML ? (
          <WebView
            ref={webViewRef}
            source={{ html: studioHTML }}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onMessage={(e) => {
              if (e.nativeEvent.data === 'LIVE_STARTED') setIsLive(true);
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' }}>
            <Video color="#374151" size={48} />
            {error ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7F1D1D', borderRadius: 12, padding: 10, margin: 16 }}>
                <AlertCircle color="#FCA5A5" size={16} />
                <Text style={{ color: '#FCA5A5', fontSize: 12 }}>{error}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={handleGoLive}
              disabled={starting}
              style={{ backgroundColor: '#EF4444', borderRadius: 20, paddingHorizontal: 28, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, opacity: starting ? 0.6 : 1 }}
            >
              {starting ? <ActivityIndicator color="white" size="small" /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white' }} />}
              <Text style={{ fontSize: 16, fontWeight: '900', color: 'white' }}>{starting ? 'جاري الاتصال...' : 'ابدأ البث المباشر 🔴'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Top Overlay */}
        {isLive && (
          <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: '#EF4444', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' }} />
              <Text style={{ fontSize: 10, fontWeight: '900', color: 'white' }}>LIVE</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users color="#60A5FA" size={11} />
              <Text style={{ fontSize: 11, color: 'white', fontWeight: '700' }}>{viewerCount}</Text>
            </View>
          </View>
        )}

        {/* Bottom Controls */}
        {isLive && (
          <View style={{ position: 'absolute', bottom: insets.bottom + 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
            <TouchableOpacity onPress={toggleMic} style={[s.ctrl, !micOn && s.ctrlOff]}>
              {micOn ? <Mic color="white" size={20} /> : <MicOff color="white" size={20} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleCam} style={[s.ctrl, !camOn && s.ctrlOff]}>
              {camOn ? <Video color="white" size={20} /> : <VideoOff color="white" size={20} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowProductPicker(true)} style={[s.ctrl, { backgroundColor: '#2563EB' }]}>
              <Pin color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowChat(!showChat)} style={s.ctrl}>
              <MessageSquare color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEndStream} style={[s.ctrl, s.ctrlEnd]}>
              <PhoneOff color="white" size={22} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chat Panel */}
      {showChat && isLive && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.chatPanel}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 8, gap: 4 }}
            renderItem={({ item: msg }) => (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: msg.is_host ? '#EF4444' : '#374151', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, color: 'white', fontWeight: '700' }}>{msg.username?.[0]?.toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 9, color: msg.is_host ? '#FCA5A5' : '#9CA3AF' }}>{msg.username}</Text>
                  <Text style={{ fontSize: 11, color: 'white' }}>{msg.message}</Text>
                </View>
              </View>
            )}
          />
          <View style={{ flexDirection: 'row', gap: 6, padding: 8, borderTopWidth: 1, borderTopColor: '#1F2937' }}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="اكتب رسالة..."
              placeholderTextColor="#6B7280"
              style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: 'white' }}
              onSubmitEditing={handleSendChat}
            />
            <TouchableOpacity onPress={handleSendChat} style={{ width: 36, height: 36, backgroundColor: '#2563EB', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Send color="white" size={14} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Product Picker Modal */}
      {showProductPicker && (
        <View style={s.productPickerOverlay}>
          <View style={s.productPickerSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>تثبيت منتج على الشاشة</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <X color="#94A3B8" size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {listings.map(p => (
                <TouchableOpacity key={p.id} onPress={() => handlePinProduct(p)} style={s.productRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{p.title}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#2563EB' }}>{p.price?.toLocaleString()} ج.م</Text>
                  </View>
                  <Pin color="#94A3B8" size={16} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ctrl: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlOff: { backgroundColor: '#EF4444' },
  ctrlEnd: { backgroundColor: '#EF4444', width: 56, height: 56, borderRadius: 28 },
  chatPanel: { height: 240, backgroundColor: 'rgba(0,0,0,0.92)' },
  productPickerOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  productPickerSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 6 },
});
