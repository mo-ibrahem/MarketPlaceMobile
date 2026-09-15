import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { useChatRooms } from '../../src/components/ChatList';
import type { ChatRoomInfo } from '../../src/services/lib/chatService';

/**
 * Chats inbox -- approved build 9b.
 *
 * Two things the old inbox did not do: it did not say which side of a deal
 * a thread was, and it did not say whether the ball was in your court. Both
 * are now real: "waiting on you" is every thread whose newest message came
 * from the other person (messages has no read_at column, so this is the
 * honest equivalent of unread), and the Buying/Selling filters compare the
 * listing's seller against you.
 */

function timeAgoShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}M`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H`;
  return `${Math.floor(hrs / 24)}D`;
}

type Filter = 'all' | 'buying' | 'selling' | 'offers';

export default function ChatsTabScreen() {
  const { isRTL } = useLanguage();
  const router = useRouter();
  const { chatRooms, loading, reload } = useChatRooms();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const counts = useMemo(() => ({
    buying: chatRooms.filter(c => c.i_am_seller === false).length,
    selling: chatRooms.filter(c => c.i_am_seller === true).length,
    offers: chatRooms.filter(c => c.last_message_is_offer).length,
  }), [chatRooms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chatRooms.filter(c => {
      if (filter === 'buying' && c.i_am_seller !== false) return false;
      if (filter === 'selling' && c.i_am_seller !== true) return false;
      if (filter === 'offers' && !c.last_message_is_offer) return false;
      if (!q) return true;
      return (
        c.other_user_name.toLowerCase().includes(q) ||
        (c.product_title ?? '').toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q)
      );
    });
  }, [chatRooms, filter, query]);

  const waiting = visible.filter(c => c.last_message_is_mine === false);
  const earlier = visible.filter(c => c.last_message_is_mine !== false);

  const T = isRTL
    ? { title: 'الدردشات', all: 'الكل', buying: 'شراء', selling: 'بيع', offers: 'عروض',
        waiting: 'بانتظار ردك', earlier: 'أقدم', you: 'أنت: ', offer: 'عرض',
        yourListing: 'إعلانك', yourOffer: 'عرضك', empty: 'لا توجد محادثات بعد',
        emptySub: 'اسأل عن أي إعلان وستظهر المحادثة هنا.', search: 'ابحث في المحادثات' }
    : { title: 'Chats', all: 'All', buying: 'Buying', selling: 'Selling', offers: 'Offers',
        waiting: 'WAITING ON YOU', earlier: 'EARLIER', you: 'You: ', offer: 'OFFER',
        yourListing: 'YOUR LISTING', yourOffer: 'YOUR OFFER', empty: 'No conversations yet',
        emptySub: 'Ask about any listing and the thread lands here.', search: 'Search chats' };

  /** The mono context line: which listing, and the money in play if any. */
  const contextLine = (chat: ChatRoomInfo) => {
    const parts: string[] = [];
    if (chat.i_am_seller && chat.product_title) parts.push(T.yourListing);
    if (chat.product_title) parts.push(chat.product_title);
    if (chat.last_message_is_offer && chat.last_offer_amount) {
      parts.push(`${chat.last_message_is_mine ? T.yourOffer : T.offer} ${Math.round(chat.last_offer_amount).toLocaleString('en-EG')}`);
    } else if (chat.product_price != null) {
      parts.push(Math.round(chat.product_price).toLocaleString('en-EG'));
    }
    return parts.join(' · ').toUpperCase();
  };

  const renderRow = (chat: ChatRoomInfo) => {
    const unanswered = chat.last_message_is_mine === false;
    return (
      <TouchableOpacity
        key={chat.room_id}
        style={s.row}
        onPress={() => router.push(`/chat/${chat.room_id}` as any)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: chat.product_image || chat.other_user_avatar_url || 'https://placehold.co/200x200/F1F5F9/94A3B8?text=%20' }}
          style={s.thumb}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.topLine}>
            <Text style={[s.name, unanswered && s.nameStrong]} numberOfLines={1}>{chat.other_user_name}</Text>
            <Text style={s.time}>{timeAgoShort(chat.last_message_time)}</Text>
          </View>

          {!!contextLine(chat) && (
            <Text style={s.context} numberOfLines={1}>{contextLine(chat)}</Text>
          )}

          <View style={s.previewRow}>
            {chat.last_message_is_offer && <Text style={s.offerChip}>{T.offer}</Text>}
            <Text style={[s.preview, unanswered && s.previewStrong]} numberOfLines={1}>
              {chat.last_message
                ? `${chat.last_message_is_mine ? T.you : ''}${chat.last_message}`
                : T.emptySub}
            </Text>
            {unanswered && <View style={s.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: T.all },
    { key: 'buying', label: T.buying, count: counts.buying },
    { key: 'selling', label: T.selling, count: counts.selling },
    { key: 'offers', label: T.offers, count: counts.offers || undefined },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerTop}>
          {searchOpen ? (
            <View style={s.searchField}>
              <Search size={16} color="#94A3B8" />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={T.search}
                placeholderTextColor="#94A3B8"
                style={s.searchInput}
              />
              <TouchableOpacity onPress={() => { setSearchOpen(false); setQuery(''); }} hitSlop={8}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.title}>
                {T.title} <Text style={s.titleCount}>{chatRooms.length}</Text>
              </Text>
              <TouchableOpacity style={s.searchBtn} onPress={() => setSearchOpen(true)} hitSlop={6}>
                <Search size={18} color="#0F172A" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {filters.map(f => {
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filterPill, on && s.filterPillOn]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
              >
                <Text style={[s.filterText, on && s.filterTextOn]}>
                  {f.label}{f.count != null ? ' ' : ''}
                  {f.count != null && <Text style={[s.filterCount, on && s.filterTextOn]}>{f.count}</Text>}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
      >
        {loading ? (
          <View style={s.empty}><ActivityIndicator color="#0F172A" /></View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{T.empty}</Text>
            <Text style={s.emptySub}>{T.emptySub}</Text>
          </View>
        ) : (
          <>
            {waiting.length > 0 && (
              <>
                <Text style={s.sectionKicker}>{T.waiting}</Text>
                {waiting.map(renderRow)}
              </>
            )}
            {earlier.length > 0 && (
              <>
                <Text style={[s.sectionKicker, waiting.length > 0 && { marginTop: 22 }]}>{T.earlier}</Text>
                {earlier.map(renderRow)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  header: { paddingHorizontal: 20, paddingTop: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 36 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -1.3, color: '#0F172A' },
  titleCount: { fontSize: 17, fontWeight: '700', color: '#94A3B8' },
  searchBtn: {
    height: 36, width: 36, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  searchField: {
    flex: 1, height: 36, borderRadius: 999, backgroundColor: '#F1F5F9',
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 0 },

  filterRow: { flexDirection: 'row', gap: 8, marginTop: 16, paddingBottom: 12 },
  filterPill: {
    height: 34, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  filterPillOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterText: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  filterTextOn: { color: '#FFFFFF', fontWeight: '800' },
  filterCount: { color: '#94A3B8' },

  content: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  sectionKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#64748B', paddingTop: 16 },

  row: { flexDirection: 'row', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#E2E8F0' },
  topLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  nameStrong: { fontWeight: '800' },
  time: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  context: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#64748B', marginTop: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  offerChip: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#0F172A',
    backgroundColor: '#FEF3C7', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden',
  },
  preview: { flex: 1, fontSize: 13.5, fontWeight: '500', color: '#64748B', lineHeight: 18 },
  previewStrong: { color: '#0F172A', fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },

  empty: { paddingVertical: 60, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});
