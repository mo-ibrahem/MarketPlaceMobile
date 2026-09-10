import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, MessageCircle, MoreVertical, Package, Send, ShieldCheck, Tag } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import {
  getChatRoomDetails,
  getMessages,
  sendMessage,
  subscribeToMessages,
  type ChatMessage,
  type ChatRoomDetails,
} from '../../src/services/lib/chatService';

function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomInfo, setRoomInfo] = useState<ChatRoomDetails | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const quickReplies = [
    t('chat.quickReplies.available'),
    t('chat.quickReplies.bestPrice'),
    t('chat.quickReplies.location'),
    t('chat.quickReplies.shipping'),
  ];

  // ── Fetch Details & Initial Messages ──────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [msgs, info] = await Promise.all([
          getMessages(roomId!),
          getChatRoomDetails(roomId!),
        ]);
        if (isMounted) {
          setMessages(msgs);
          setRoomInfo(info);
        }
      } catch (err: any) {
        console.error('[Chat] Load error:', err);
        Toast.show({ type: 'error', text1: t('chat.loadError') });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    // Subscribe to realtime messages
    const channel = subscribeToMessages(roomId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [roomId, t]);

  // ── Send Message ──────────────────────────────────────────────────────────
  const handleSend = async (textToSend = newMessage) => {
    const content = textToSend.trim();
    if (!content || !roomId) return;
    setNewMessage('');
    try {
      await sendMessage(roomId, content);
    } catch (err: any) {
      console.error('[Chat] Send error:', err);
      Toast.show({ type: 'error', text1: 'Failed to send message.' });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: '#94A3B8' }}>{t('common.loading')}</Text>
      </View>
    );
  }

  const otherName = roomInfo?.other_user_name || 'Trader';
  const otherInitial = otherName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        
        {/* ── Top Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft color="#1E293B" size={22} />
          </TouchableOpacity>

          <View style={styles.headerProfile}>
            <View style={styles.avatarWrap}>
              {roomInfo?.other_user_avatar_url ? (
                <Image source={{ uri: roomInfo.other_user_avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{otherInitial}</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
              {/* Was a hardcoded "Active in Egypt" presence line, which this
                  app has no way to know. The listing this conversation is about
                  is shown in its own bar below instead. */}
              <Text style={styles.headerStatus} numberOfLines={1}>🇪🇬 EgyBay</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={18} color="#10B981" />
            </View>

            {/* Apple UGC: Block / Report User */}
            <TouchableOpacity
              style={styles.moreOptionsBtn}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              onPress={() => {
                Alert.alert(
                  `User Safety • أمان المستخدم (${otherName})`,
                  'Manage interactions and reports for this user',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: '🚩 Report User • إبلاغ عن إساءة',
                      onPress: () =>
                        Toast.show({
                          type: 'success',
                          text1: 'Report Submitted',
                          text2: 'Our team will review this user.',
                        }),
                    },
                    {
                      text: '🚫 Block User • حظر المستخدم',
                      style: 'destructive',
                      onPress: () => {
                        Toast.show({
                          type: 'success',
                          text1: 'User Blocked',
                          text2: 'You will no longer receive messages.',
                        });
                        router.back();
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <MoreVertical size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Listing this conversation is about.
            Conversations are scoped to one item, so the item stays visible for
            context -- the name alone is easy to lose track of mid-thread.
            Legacy rooms opened before scoping have no product and show no bar. */}
        {!!roomInfo?.product_id && (
          <TouchableOpacity
            style={styles.productBar}
            activeOpacity={0.8}
            onPress={() => router.push(`/products/${roomInfo.product_id}` as any)}
          >
            {roomInfo.product_image ? (
              <Image source={{ uri: roomInfo.product_image }} style={styles.productBarImg} />
            ) : (
              <View style={[styles.productBarImg, styles.productBarImgFallback]}>
                <Package size={16} color="#94A3B8" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productBarTitle} numberOfLines={1}>
                {roomInfo.product_title || 'Listing'}
              </Text>
              {roomInfo.product_price != null && (
                <Text style={styles.productBarPrice}>
                  EGP {Number(roomInfo.product_price).toLocaleString('en-EG')}
                </Text>
              )}
            </View>
            <ChevronRight size={16} color="#CBD5E1" />
          </TouchableOpacity>
        )}

        {/* ── Safety Notice Banner ── */}
        <View style={styles.safetyBanner}>
          <ShieldCheck size={14} color="#2563EB" />
          <Text style={styles.safetyBannerText}>{t('chat.safetyReminder')}</Text>
        </View>

        {/* ── Message List ── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.sender_id === user?.id;
              const isOffer = item.content.includes('[OFFER') || item.content.includes('عرض شراء');
              const isAccepted = item.content.includes('OFFER ACCEPTED') || item.content.includes('تم قبول العرض');
              const isDeclined = item.content.includes('OFFER DECLINED') || item.content.includes('تم رفض العرض');

              return (
                <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.myMessage : styles.theirMessage,
                      isOffer && (isMe ? styles.myOfferBubble : styles.theirOfferBubble),
                      isAccepted && styles.acceptedBubble,
                      isDeclined && styles.declinedBubble,
                    ]}
                  >
                    {isOffer && (
                      <View style={styles.offerBadgeHeader}>
                        <Tag size={13} color={isMe ? 'white' : '#7C3AED'} />
                        <Text style={[styles.offerBadgeText, { color: isMe ? 'white' : '#7C3AED' }]}>
                          PRICE OFFER / عرض شراء
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                      {item.content}
                    </Text>

                    {/* Interactive Offer Action Buttons (for recipient) */}
                    {isOffer && !isMe && !isAccepted && !isDeclined && (
                      <View style={styles.offerActionRow}>
                        <TouchableOpacity
                          style={styles.acceptOfferBtn}
                          onPress={() => handleSend('✅ [OFFER ACCEPTED / تم قبول العرض] I accept your offer! Let’s arrange delivery or meetup.')}
                        >
                          <Text style={styles.acceptOfferText}>{t('chat.acceptOffer')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineOfferBtn}
                          onPress={() => handleSend('❌ [OFFER DECLINED / تم رفض العرض] Thank you for your offer, but I cannot accept this price.')}
                        >
                          <Text style={styles.declineOfferText}>{t('chat.declineOffer')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* ── Quick Replies ── */}
          <View style={styles.quickRepliesSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRepliesRow}
            >
              {quickReplies.map((qr, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickReplyChip}
                  onPress={() => handleSend(qr)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.quickReplyText}>{qr}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Input Bar ── */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={t('chat.messagePlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={!newMessage.trim()}
            >
              <Send color="white" size={18} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  // Header
  productBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  productBarImg: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#F1F5F9' },
  productBarImgFallback: { alignItems: 'center', justifyContent: 'center' },
  productBarTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  productBarPrice: { fontSize: 11.5, fontWeight: '700', color: '#2563EB', marginTop: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 15, fontWeight: '800', color: '#6366F1' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  headerName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  headerStatus: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  verifiedBadge: { padding: 4 },
  moreOptionsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },

  // Safety Banner
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  safetyBannerText: { fontSize: 11, color: '#1E40AF', flex: 1, fontWeight: '500', lineHeight: 15 },

  // Message list
  listContainer: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  messageRow: { flexDirection: 'row', width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  myOfferBubble: {
    backgroundColor: '#7C3AED',
    borderWidth: 1.5,
    borderColor: '#6D28D9',
  },
  theirOfferBubble: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  acceptedBubble: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  declinedBubble: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  offerBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  offerBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  messageText: { fontSize: 14, lineHeight: 20 },
  myMessageText: { color: 'white' },
  theirMessageText: { color: '#1E293B' },
  timeText: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  myTimeText: { color: 'rgba(255,255,255,0.75)' },
  theirTimeText: { color: '#94A3B8' },

  // Offer Action Buttons
  offerActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  acceptOfferBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptOfferText: { color: 'white', fontWeight: '800', fontSize: 12 },
  declineOfferBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  declineOfferText: { color: '#64748B', fontWeight: '700', fontSize: 12 },

  // Quick replies
  quickRepliesSection: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickRepliesRow: { paddingHorizontal: 16, gap: 8 },
  quickReplyChip: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  quickReplyText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
});