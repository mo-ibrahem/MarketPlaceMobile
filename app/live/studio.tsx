import { inlineScriptValue } from '../../src/services/lib/paymentSafety';
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
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, SwitchCamera,
  MessageSquare, Send, Pin, X, ShoppingBag, AlertCircle
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import {
  startLiveSession, endLiveSession, revertLiveSessionToScheduled,
  pinProduct, unpinProduct,
  sendChatMessage, getRecentChatMessages,
  type LiveSession, type LiveChatMessage
} from '../../src/services/lib/liveService';
import { productService } from '../../src/services/lib/products';
import { supabase } from '../../src/services/lib/supabase';
import NotAvailableYet from '../../src/components/NotAvailableYet';
import { LIVE_ENABLED } from '../../src/services/lib/platformCommerce';
import { AGORA_APP_ID } from '../../src/services/lib/agoraConfig';

// Agora Studio runs via WebView since react-native-agora requires native rebuild
// The WebView loads a self-contained Agora WebRTC host page

function buildStudioHTML(appId: string, token: string, channel: string, uid: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow: hidden; }
  #local-video { width: 100vw; height: 100vh; background: #050505; overflow: hidden; }
  #local-video video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
  #status { position: fixed; top: 12px; left: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-family: sans-serif; }
</style>
</head>
<body>
<div id="local-video"></div>
<div id="status">جاري الاتصال...</div>
<script src="https://cdn.agora.io/sdk/release/AgoraRTC_N.js"></script>
<script>
// h264, not vp8: on iOS the phone encodes H.264 in hardware and VP8 in
// software. VP8 was a hot phone, dropped frames and a flat battery.
const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
const appId = ${inlineScriptValue(appId)};
const token = ${inlineScriptValue(token)};
const channel = ${inlineScriptValue(channel)};
const uid = ${inlineScriptValue(uid)};
let localVideoTrack, localAudioTrack;
let micEnabled = false, cameraEnabled = false;
const status = (t) => { document.getElementById('status').textContent = t; };
const emit = (type, extra = {}) => window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...extra }));
client.on('connection-state-change', (cur) => {
  if (cur === 'RECONNECTING') status('⚠️ إعادة الاتصال...');
  else if (cur === 'CONNECTED' && localVideoTrack) status('🔴 LIVE');
  else if (cur === 'DISCONNECTED') status('انقطع الاتصال');
  window.ReactNativeWebView.postMessage('STATE:' + cur);
});
// Two quality layers so a viewer on a weak connection gets a smaller
// picture instead of a frozen one (the viewer opts into the fallback).
client.enableDualStream().catch(() => {});
async function start() {
  try {
    await client.setClientRole('host');
    await client.join(appId, channel, token, uid);
    // Start video independently. A phone call can temporarily reserve the
    // microphone on iOS; that must not also suppress the camera preview.
    localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      facingMode: 'user',
      encoderConfig: { width: 720, height: 1280, frameRate: 24, bitrateMin: 600, bitrateMax: 1800 },
      optimizationMode: 'motion'
    });
    localVideoTrack.play('local-video', { fit: 'cover', mirror: true });
    cameraEnabled = true;
    emit('CAMERA_STATE', { enabled: true });

    try {
      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
      micEnabled = true;
      emit('MIC_STATE', { enabled: true });
    } catch (audioError) {
      // Video can still go live. Tell the native UI exactly why it is silent.
      micEnabled = false;
      emit('MIC_UNAVAILABLE', { error: audioError?.message || 'Microphone unavailable' });
    }

    await client.publish(localAudioTrack ? [localAudioTrack, localVideoTrack] : [localVideoTrack]);
    status('🔴 LIVE');
    emit('LIVE_STARTED', { hasAudio: !!localAudioTrack });
  } catch (e) {
    status('Error: ' + e.message);
    emit('ERROR', { error: e?.message || 'Unable to start live video' });
  }
}
window.addEventListener('message', async (e) => {
  if (e.data === 'TOGGLE_MIC') {
    try {
      if (!localAudioTrack) {
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
        await client.publish(localAudioTrack);
        micEnabled = true;
      } else {
        micEnabled = !micEnabled;
        await localAudioTrack.setEnabled(micEnabled);
      }
      emit('MIC_STATE', { enabled: micEnabled });
    } catch (audioError) {
      localAudioTrack?.close();
      localAudioTrack = undefined;
      micEnabled = false;
      emit('MIC_UNAVAILABLE', { error: audioError?.message || 'Microphone unavailable' });
    }
  }
  if (e.data === 'TOGGLE_CAM' && localVideoTrack) {
    cameraEnabled = !cameraEnabled;
    await localVideoTrack.setEnabled(cameraEnabled);
    emit('CAMERA_STATE', { enabled: cameraEnabled });
  }
  if (e.data === 'FLIP_CAM' && localVideoTrack) {
    try {
      const cameras = await AgoraRTC.getCameras();
      if (cameras.length > 1) {
        const current = localVideoTrack.getMediaStreamTrack().getSettings().deviceId;
        const currentIndex = cameras.findIndex(camera => camera.deviceId === current);
        await localVideoTrack.setDevice(cameras[(currentIndex + 1) % cameras.length].deviceId);
        emit('CAMERA_FLIPPED');
      }
    } catch (cameraError) {
      emit('MEDIA_WARNING', { error: cameraError?.message || 'Could not switch camera' });
    }
  }
  if (e.data === 'END') {
    localAudioTrack?.close();
    localVideoTrack?.close();
    await client.leave();
  }
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
  const [hostUid, setHostUid] = useState(0);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  // True only after the WebView reported that Agora accepted the publish.
  // The LIVE badge waits for this: the row is `live` in the database from
  // the moment Go Live is pressed, but nobody can see anything until then.
  const [published, setPublished] = useState(false);
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
  const [mediaNotice, setMediaNotice] = useState('');

  const webViewRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Live is off in this build: nothing here can be reached, so don't even fetch.
    if (!LIVE_ENABLED) return;
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
      // Fail here with a readable message rather than inside the WebView with
      // Agora's "Invalid appid" (what build 26 showed when the ID was empty).
      if (!AGORA_APP_ID) throw new Error('Live video is not configured in this build');
      const uid = 1 + Math.floor(Math.random() * 1000000);
      setHostUid(uid);
      const { token, channel } = await startLiveSession(sessionId, uid);
      setAgoraToken(token);
      setIsLive(true);
      await sendChatMessage({ sessionId, userId: user.id, username: 'EgyBay', message: '🔴 البث انطلق! مرحباً بالجميع 🎉', isHost: true, msgType: 'chat' });
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
          // endLiveSession throws on a refused update; stay on the screen
          // with the reason instead of navigating away from a still-live row.
          try {
            if (sessionId) await endLiveSession(sessionId);
          } catch (err: any) {
            setError(err?.message || 'تعذر إنهاء البث');
            return;
          }
          webViewRef.current?.postMessage('END');
          router.replace('/live' as any);
        },
      },
    ]);
  }, [sessionId, router]);

  const toggleMic = () => {
    webViewRef.current?.postMessage('TOGGLE_MIC');
  };

  const toggleCam = () => {
    webViewRef.current?.postMessage('TOGGLE_CAM');
  };

  const handleSendChat = async (customText?: string) => {
    const content = customText || chatInput;
    if (!content.trim() || !user || !sessionId) return;
    const msg = content.trim();
    if (!customText) setChatInput('');
    try {
      await sendChatMessage({
        sessionId,
        userId: user.id,
        username: user.user_metadata?.full_name || 'Host',
        message: msg,
        isHost: true,
        msgType: customText ? 'reaction' : 'chat',
      });
    } catch (err: any) {
      if (!customText) setChatInput(msg);
      setError(err?.message || 'تعذر إرسال الرسالة');
    }
  };

  const handlePinProduct = async (product: any) => {
    if (!sessionId) return;
    try {
      await pinProduct(sessionId, product.id, product.price);
      setShowProductPicker(false);
    } catch (err: any) {
      setError(err?.message || 'تعذر تثبيت المنتج');
    }
  };

  const studioHTML = isLive && agoraToken && session?.agora_channel
    ? buildStudioHTML(AGORA_APP_ID, agoraToken, session.agora_channel, hostUid)
    : null;

  // Live is off in this build (LIVE_ENABLED).
  if (!LIVE_ENABLED) {
    return <NotAvailableYet />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      {/* Video Area */}
      <View style={{ flex: 1, position: 'relative' }}>
        {studioHTML ? (
          <WebView
            ref={webViewRef}
            // baseUrl gives the page a real https origin. Inline HTML alone
            // is an opaque origin, and WebKit only exposes getUserMedia to
            // secure contexts -- without this the host has no camera at all.
            source={{ html: studioHTML, baseUrl: 'https://egbay.shop' }}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // The OS already asked for camera/mic (NSCameraUsageDescription,
            // NSMicrophoneUsageDescription); do not ask a second time inside
            // the web view.
            mediaCapturePermissionGrantType="grant"
            onMessage={(e) => {
              const raw = e.nativeEvent.data;
              let event: { type?: string; error?: string; enabled?: boolean; hasAudio?: boolean } = {};
              try { event = JSON.parse(raw); } catch { event = { type: raw }; }
              if (event.type === 'LIVE_STARTED') {
                setIsLive(true);
                setPublished(true);
                setMicOn(event.hasAudio !== false);
              } else if (event.type === 'MIC_STATE') {
                setMicOn(event.enabled === true);
                if (event.enabled) setMediaNotice('');
              } else if (event.type === 'CAMERA_STATE') {
                setCamOn(event.enabled === true);
              } else if (event.type === 'MIC_UNAVAILABLE') {
                setMicOn(false);
                setMediaNotice('الميكروفون غير متاح. أنهِ المكالمة ثم اضغط زر الميكروفون للمحاولة مرة أخرى.');
              } else if (event.type === 'MEDIA_WARNING') {
                setMediaNotice(event.error || 'تعذر تغيير إعداد الكاميرا');
              } else if (event.type === 'ERROR') {
                const message = event.error || 'تعذر بدء البث';
                if (published) { setError(message); return; }
                // Agora never started the broadcast (build 26 hit this with an
                // empty App ID). Take the session out of `live` so the viewer
                // list does not advertise a stream nobody can watch, and go
                // back to the Go Live screen with the reason visible.
                setIsLive(false);
                setAgoraToken(null);
                if (sessionId) revertLiveSessionToScheduled(sessionId).catch(() => {});
                setError(message);
              }
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
          <View pointerEvents="box-none" style={{ position: 'absolute', zIndex: 20, top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: published ? '#EF4444' : '#B45309', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' }} />
              <Text style={{ fontSize: 11, fontWeight: '900', color: 'white' }}>{published ? 'LIVE' : 'جارٍ الاتصال…'}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users color="#60A5FA" size={11} />
              <Text style={{ fontSize: 11, color: 'white', fontWeight: '700' }}>{viewerCount}</Text>
            </View>
          </View>
        )}

        {!!mediaNotice && isLive && (
          <TouchableOpacity onPress={() => setMediaNotice('')} style={s.mediaNotice} accessibilityLabel="Dismiss media warning">
            <AlertCircle color="#FDE68A" size={15} />
            <Text style={{ color: '#FEF3C7', fontSize: 12, flex: 1, textAlign: 'right' }}>{mediaNotice}</Text>
            <X color="#FDE68A" size={14} />
          </TouchableOpacity>
        )}

        {/* Bottom Controls */}
        {isLive && (
          <View style={{ position: 'absolute', zIndex: 20, bottom: insets.bottom + 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <TouchableOpacity onPress={toggleMic} disabled={!published} style={[s.ctrl, !micOn && s.ctrlOff]} accessibilityLabel={micOn ? 'Mute microphone' : 'Unmute microphone'}>
              {micOn ? <Mic color="white" size={20} /> : <MicOff color="white" size={20} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleCam} disabled={!published} style={[s.ctrl, !camOn && s.ctrlOff]} accessibilityLabel={camOn ? 'Turn camera off' : 'Turn camera on'}>
              {camOn ? <Video color="white" size={20} /> : <VideoOff color="white" size={20} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => webViewRef.current?.postMessage('FLIP_CAM')} style={s.ctrl} accessibilityLabel="Switch camera">
              <SwitchCamera color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowProductPicker(true)} style={[s.ctrl, { backgroundColor: '#0F172A' }]}>
              <Pin color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowChat(true)} style={[s.ctrl, showChat && s.ctrlActive]} accessibilityLabel="Open live chat">
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
          <View style={s.chatHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)} style={s.chatClose} accessibilityLabel="Close live chat">
              <X color="white" size={18} />
            </TouchableOpacity>
            <Text style={s.chatTitle}>دردشة البث</Text>
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 8, gap: 6 }}
            renderItem={({ item: msg }) => {
              if (msg.msg_type === 'purchase') {
                return (
                  <View style={{ backgroundColor: '#451A03', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 10, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>🎉</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FCD34D' }}>طلب جديد!</Text>
                      <Text style={{ fontSize: 11, color: '#34D399', fontWeight: '700' }}>{msg.message}</Text>
                    </View>
                  </View>
                );
              }
              if (msg.msg_type === 'pin') {
                return (
                  <View style={{ backgroundColor: '#1E1B4B', borderWidth: 1, borderColor: '#6366F1', borderRadius: 8, padding: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 11 }}>📌</Text>
                    <Text style={{ fontSize: 11, color: '#C7D2FE', fontWeight: '600' }}>{msg.message}</Text>
                  </View>
                );
              }
              return (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: msg.is_host ? '#DC2626' : '#374151', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, color: 'white', fontWeight: '800' }}>{msg.is_host ? '👑' : (msg.username?.[0]?.toUpperCase() || '?')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: msg.is_host ? '#FCA5A5' : '#9CA3AF', fontWeight: msg.is_host ? '800' : '500' }}>
                      {msg.username} {msg.is_host ? '(HOST)' : ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: 'white' }}>{msg.message}</Text>
                  </View>
                </View>
              );
            }}
          />
          {/* Quick Emojis Strip */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#0B0F19' }}>
            {['❤️', '🔥', '👏', '🚀', '💎', '💯', '😂', '🎉'].map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => handleSendChat(emoji)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, padding: 8, borderTopWidth: 1, borderTopColor: '#1F2937' }}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="اكتب رسالة..."
              placeholderTextColor="#6B7280"
              style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: 'white' }}
              onSubmitEditing={() => handleSendChat()}
            />
            <TouchableOpacity onPress={() => handleSendChat()} style={{ width: 36, height: 36, backgroundColor: '#0F172A', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
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
  ctrl: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15,23,42,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ctrlActive: { backgroundColor: '#2563EB', borderColor: '#60A5FA' },
  ctrlOff: { backgroundColor: '#EF4444' },
  ctrlEnd: { backgroundColor: '#EF4444', width: 48, height: 48, borderRadius: 24 },
  mediaNotice: { position: 'absolute', zIndex: 25, top: 52, left: 12, right: 12, minHeight: 42, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(120,53,15,0.94)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatPanel: { position: 'absolute', zIndex: 40, left: 0, right: 0, bottom: 0, height: 280, backgroundColor: 'rgba(3,7,18,0.96)', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  chatHeader: { minHeight: 42, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  chatClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  chatTitle: { color: 'white', fontSize: 14, fontWeight: '800' },
  productPickerOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  productPickerSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 6 },
});
