import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, Package, Plus, Send, ShieldCheck, Tag } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { blockUser, isBackendMissing, reportContent, SAFETY_EMAIL } from '../../src/services/lib/moderationService';
import { PAYMENTS_ENABLED } from '../../src/services/lib/platformCommerce';
import {
  getChatRoomDetails,
  getMessages,
  respondToOffer,
  sendMessage,
  sendOffer,
  subscribeToMessages,
  type ChatMessage,
  type ChatRoomDetails,
} from '../../src/services/lib/chatService';
import { getSellerReplyBadge } from '../../src/services/lib/reputationStats';

function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomInfo, setRoomInfo] = useState<ChatRoomDetails | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [replyBadge, setReplyBadge] = useState<string | null>(null);
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
          if (info?.other_user_id) {
            getSellerReplyBadge(info.other_user_id).then(b => { if (isMounted) setReplyBadge(b); }).catch(() => {});
          }
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

  const handleSendOffer = async () => {
    if (!roomId || !offerAmount || isNaN(Number(offerAmount)) || Number(offerAmount) <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    setSendingOffer(true);
    try {
      await sendOffer(roomId, Number(offerAmount));
      setOfferModalOpen(false);
      setOfferAmount('');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not send offer', text2: err.message });
    } finally {
      setSendingOffer(false);
    }
  };

  /**
   * Accept/decline a real structured offer. The database is the source of
   * truth (validate_offer_response enforces recipient-only, pending-only,
   * status-only) -- this just reflects it locally so the button doesn't
   * wait for the realtime round-trip, and un-reflects it if the server
   * refused.
   */
  const handleRespondToOffer = async (messageId: string, response: 'accepted' | 'declined') => {
    setRespondingTo(messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, offer_status: response } : m));
    try {
      await respondToOffer(messageId, response);
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, offer_status: 'pending' } : m));
      Toast.show({ type: 'error', text1: 'Could not respond', text2: err.message });
    } finally {
      setRespondingTo(null);
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

  const submitReport = async (type: 'user' | 'message', targetId: string, reason: string) => {
    try {
      await reportContent(type, targetId, reason);
    } catch (err: any) {
      Alert.alert(
        isRTL ? 'لم يتم إرسال البلاغ' : 'Report not sent',
        isBackendMissing(err)
          ? `Reporting is temporarily unavailable. Email ${SAFETY_EMAIL} and we will act within 24 hours.`
          : (err?.message || 'Please try again.'),
      );
      return;
    }
    Toast.show({
      type: 'success',
      text1: isRTL ? 'تم إرسال البلاغ' : 'Report sent',
      text2: isRTL ? 'سيراجعه فريق الأمان خلال ٢٤ ساعة' : 'Our safety team reviews reports within 24 hours.',
    });
  };
  const otherInitial = otherName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* The KeyboardAvoidingView must be the full-height container. It used
          to sit below the header and safety banner with a 10pt offset, so
          when the keyboard opened it padded by (keyboard − 10) while its own
          frame started ~120pt down the screen -- under-padding by roughly one
          input row. Result on a real iPhone: quick-reply chips visible, the
          text field and Send hidden behind the keyboard. As the outermost
          view, its frame is the screen and the overlap it measures is exact. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
              {/* The mockup shows "Active now" here. This app has no presence
                  data and will not invent it; the real, computed equivalent is
                  their reply speed, and it is omitted entirely when there is
                  not enough history behind it. */}
              {!!replyBadge && (
                <View style={styles.headerTrustRow}>
                  <View style={styles.headerTrustDot} />
                  <Text style={styles.headerTrust} numberOfLines={1}>{replyBadge}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {/* Guideline 1.2: report writes a content_reports row, block writes
                blocked_users; neither claims success until the RPC resolved. */}
            <TouchableOpacity
              style={styles.moreOptionsBtn}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              onPress={() => {
                if (!roomInfo?.other_user_id) return;
                const otherId = roomInfo.other_user_id;
                Alert.alert(
                  `${otherName}`,
                  isRTL ? 'الإبلاغ أو حظر هذا المستخدم' : 'Report or block this user',
                  [
                    { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                    {
                      text: isRTL ? 'إبلاغ عن إساءة' : 'Report user',
                      onPress: () =>
                        Alert.alert(
                          isRTL ? 'سبب الإبلاغ' : 'Why are you reporting them?',
                          undefined,
                          [
                            { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                            ...['Harassment or abuse', 'Scam or fraud', 'Spam', 'Other'].map(reason => ({
                              text: reason,
                              onPress: () => submitReport('user', otherId, `${reason} (chat room ${roomId})`),
                            })),
                          ],
                        ),
                    },
                    {
                      text: isRTL ? 'حظر المستخدم' : 'Block user',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await blockUser(otherId);
                        } catch (err: any) {
                          Alert.alert(
                            isRTL ? 'تعذر الحظر' : 'Could not block',
                            isBackendMissing(err)
                              ? `Blocking is temporarily unavailable. Email ${SAFETY_EMAIL} and we will act within 24 hours.`
                              : (err?.message || 'Please try again.'),
                          );
                          return;
                        }
                        Toast.show({
                          type: 'success',
                          text1: isRTL ? 'تم حظر المستخدم' : 'User blocked',
                          text2: isRTL ? 'لن تظهر محادثاتهم أو إعلاناتهم بعد الآن' : 'Their messages and listings are hidden from you.',
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
            <View style={styles.productBarView}>
              <Text style={styles.productBarViewText}>{isRTL ? 'عرض' : 'View'}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Message List ── */}
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              <View style={styles.safetyLine}>
                <ShieldCheck size={13} color="#94A3B8" />
                <Text style={styles.safetyLineText}>
                  {t(PAYMENTS_ENABLED ? 'chat.safetyReminder' : 'chat.safetyReminderClassifieds')}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.sender_id === user?.id;

              // Real structured offer (msg_type='offer', validated server-side
              // -- see chatService.sendOffer/respondToOffer). This used to be a
              // plain-text "[OFFER ACCEPTED]" pattern-match: either side could
              // type that string themselves and the UI would show it accepted.
              if (item.msg_type === 'offer') {
                return (
                  <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
                    <View style={[styles.offerCard, isMe ? styles.myOfferCard : styles.theirOfferCard]}>
                      <View style={[styles.offerCardHead, isMe && styles.offerCardHeadDark]}>
                        <Text style={[styles.offerBadgeText, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                          {isMe ? (isRTL ? 'عرضك' : 'YOUR OFFER') : (isRTL ? 'عرض' : 'OFFER')}
                        </Text>
                        <View style={styles.offerAmountRow}>
                          <Text style={[styles.offerAmount, isMe && { color: 'white' }]}>
                            {Number(item.offer_amount_egp).toLocaleString('en-EG')}
                          </Text>
                          <Text style={[styles.offerCurrency, isMe && { color: 'rgba(255,255,255,0.55)' }]}>EGP</Text>
                        </View>
                      </View>
                      <View style={styles.offerCardFoot}>
                        {item.offer_status === 'pending' ? (
                          isMe ? (
                            <Text style={styles.offerWaiting}>{isRTL ? 'بانتظار الرد' : 'Waiting for reply'}</Text>
                          ) : (
                            <View style={styles.offerActionRow}>
                              <TouchableOpacity
                                style={styles.acceptOfferBtn}
                                disabled={respondingTo === item.id}
                                onPress={() => handleRespondToOffer(item.id, 'accepted')}
                              >
                                <Text style={styles.acceptOfferText}>{t('chat.acceptOffer')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.declineOfferBtn}
                                disabled={respondingTo === item.id}
                                onPress={() => handleRespondToOffer(item.id, 'declined')}
                              >
                                <Text style={styles.declineOfferText}>{t('chat.declineOffer')}</Text>
                              </TouchableOpacity>
                            </View>
                          )
                        ) : (
                          <Text style={[styles.offerWaiting, item.offer_status === 'accepted' && styles.offerAccepted]}>
                            {item.offer_status === 'accepted'
                              ? (isRTL ? 'تم القبول' : 'Accepted')
                              : (isRTL ? 'تم الرفض' : 'Declined')}
                          </Text>
                        )}
                        <Text style={styles.offerTime}>{formatMessageTime(item.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
                  <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                      {item.content}
                    </Text>
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
              {!!roomInfo?.product_price && (
                <TouchableOpacity
                  style={styles.quickReplyChip}
                  onPress={() => { setOfferAmount(String(Math.round(Number(roomInfo.product_price) * 0.9))); setOfferModalOpen(true); }}
                  activeOpacity={0.75}
                >
                  <Tag size={12} color="#0F172A" />
                  <Text style={styles.quickReplyText}>{isRTL ? 'تقديم عرض' : 'Make an offer'}</Text>
                </TouchableOpacity>
              )}
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
          <View style={[styles.inputContainer, { paddingBottom: 10 + (keyboardOpen ? 0 : insets.bottom) }]}>
            {/* "+" opens the offer composer -- the one structured thing you
                can attach to a message in this app. */}
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => {
                if (roomInfo?.product_price) setOfferAmount(String(Math.round(Number(roomInfo.product_price) * 0.9)));
                setOfferModalOpen(true);
              }}
            >
              <Plus size={18} color="#0F172A" />
            </TouchableOpacity>
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
        </View>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={offerModalOpen} transparent animationType="fade" onRequestClose={() => setOfferModalOpen(false)}>
        <View style={styles.offerModalOverlay}>
          <View style={styles.offerModalCard}>
            <Text style={styles.offerModalTitle}>{isRTL ? 'كم تريد أن تعرض؟' : 'What would you like to offer?'}</Text>
            <View style={styles.offerModalInputRow}>
              <TextInput
                style={styles.offerModalInput}
                value={offerAmount}
                onChangeText={t => setOfferAmount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                autoFocus
              />
              <Text style={styles.offerModalCurrency}>EGP</Text>
            </View>
            <View style={styles.offerModalRow}>
              <TouchableOpacity style={styles.offerModalCancel} onPress={() => setOfferModalOpen(false)}>
                <Text style={styles.offerModalCancelText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.offerModalSend} onPress={handleSendOffer} disabled={sendingOffer}>
                {sendingOffer ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.offerModalSendText}>{isRTL ? 'إرسال العرض' : 'Send offer'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  headerTrustRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  headerTrustDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10B981' },
  headerTrust: { fontSize: 11, fontWeight: '700', color: '#059669' },
  productBarView: {
    height: 32, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center',
  },
  productBarViewText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  safetyLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 2 },
  safetyLineText: { flex: 1, fontSize: 12, color: '#94A3B8', fontWeight: '600', lineHeight: 17 },
  moreOptionsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },

  // Safety Banner

  // Message list
  listContainer: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  messageRow: { flexDirection: 'row', width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
  },
  myMessage: {
    backgroundColor: '#0F172A',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  myMessageText: { color: 'white' },
  theirMessageText: { color: '#1E293B' },
  timeText: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  myTimeText: { color: 'rgba(255,255,255,0.75)' },
  theirTimeText: { color: '#94A3B8' },

  // Real structured offer card (approved build) -- ink, not the retired
  // purple. A sent offer is ink-headed; a received one is outlined.
  offerCard: { width: '80%', maxWidth: 300, borderRadius: 18, overflow: 'hidden' },
  myOfferCard: { alignSelf: 'flex-end', borderWidth: 1, borderColor: '#0F172A' },
  theirOfferCard: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#CBD5E1' },
  offerCardHead: { padding: 13, backgroundColor: '#FFFFFF' },
  offerCardHeadDark: { backgroundColor: '#0F172A' },
  offerBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#94A3B8', textTransform: 'uppercase' },
  offerAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  offerAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -1.2, color: '#0F172A' },
  offerCurrency: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  offerCardFoot: { paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerWaiting: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  offerAccepted: { color: '#059669' },
  offerTime: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },

  // Offer Action Buttons
  offerActionRow: { flexDirection: 'row', gap: 8, flex: 1 },
  acceptOfferBtn: { flex: 1, backgroundColor: '#0F172A', paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  acceptOfferText: { color: 'white', fontWeight: '800', fontSize: 12 },
  declineOfferBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  declineOfferText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },

  // Offer amount modal
  offerModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 24 },
  offerModalCard: { backgroundColor: 'white', borderRadius: 22, padding: 22 },
  offerModalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },
  offerModalInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 18, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#0F172A' },
  offerModalInput: { flex: 1, fontSize: 34, fontWeight: '800', color: '#0F172A', letterSpacing: -1.5, padding: 0 },
  offerModalCurrency: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  offerModalRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  offerModalCancel: { flex: 1, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  offerModalCancelText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  offerModalSend: { flex: 1, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  offerModalSendText: { fontSize: 15, fontWeight: '800', color: 'white' },

  // Quick replies
  quickRepliesSection: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickRepliesRow: { paddingHorizontal: 16, gap: 8 },
  quickReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
});