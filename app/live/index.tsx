import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronRight, Clock, Play, ShieldCheck, Users, Video } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { displayName } from '../../src/services/lib/displayName';
import { DIGITAL_PURCHASES_ENABLED } from '../../src/services/lib/platformCommerce';
import {
  getActiveLiveSessions,
  isGenuinelyLive,
  type LiveSession,
} from '../../src/services/lib/liveService';

/**
 * Live discovery, rebuilt.
 *
 * The previous screen had three structural problems, not cosmetic ones:
 *
 *  1. It advertised streams that were not live. `status === 'live'` is only
 *     cleared by a clean end, so crashed broadcasts stay 'live' forever --
 *     three of them had been "live" for over eight days and this screen listed
 *     them. isGenuinelyLive() now requires a recent started_at.
 *
 *  2. It served two audiences in one scroll. A viewer looking for something to
 *     watch had to scroll past a seller onboarding explainer and a wall of
 *     broadcast pricing tiers. Those belong behind a seller CTA, not in a
 *     viewer's feed.
 *
 *  3. Its empty state was an afterthought, when empty is the actual common
 *     case at this stage. Nothing is live most of the time, so the screen is
 *     designed around that: tell the viewer plainly, offer the one useful
 *     action (get told when a stream starts), and invite sellers to fill it.
 *
 * It was also Arabic-only, on an app with a language switcher.
 */
export default function LiveDiscoveryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await getActiveLiveSessions());
    } catch (err) {
      console.warn('[Live] load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const liveNow = sessions.filter(isGenuinelyLive);
  const upcoming = sessions.filter(s => s.status === 'scheduled');

  const T = isRTL
    ? {
        title: 'البث المباشر',
        sub: 'اشترِ مباشرة من التجار بضمان مالي كامل',
        liveNow: 'يبث الآن',
        upcoming: 'بثوث قادمة',
        noneTitle: 'لا يوجد بث مباشر الآن',
        noneSub: 'البث المباشر جديد على إيجي باي. سنخبرك فور بدء أول بث.',
        notify: 'أخبرني عند بدء البث',
        sellTitle: 'تبيع على إيجي باي؟',
        sellSub: 'اعرض منتجاتك مباشرة وبِع بضمان مالي وشحن بوسطة.',
        sellCta: 'ابدأ البث',
        viewers: 'مشاهد',
        scheduled: 'مجدول',
      }
    : {
        title: 'Live',
        sub: 'Buy directly from sellers, with full escrow protection',
        liveNow: 'Live now',
        upcoming: 'Scheduled',
        noneTitle: 'Nobody is live right now',
        noneSub: 'Live selling is new on EgyBay. We will tell you the moment the first stream starts.',
        notify: 'Notify me when a stream starts',
        sellTitle: 'Sell on EgyBay?',
        sellSub: 'Show your items on camera and sell with escrow and Bosta delivery.',
        sellCta: 'Start streaming',
        viewers: 'watching',
        scheduled: 'scheduled',
      };

  const renderCard = ({ item }: { item: LiveSession }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/live/${item.agora_channel}` as any)}
    >
      <View style={s.thumb}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={s.thumbImg} />
        ) : (
          <View style={[s.thumbImg, s.thumbFallback]}>
            <Play color="rgba(255,255,255,0.35)" size={30} />
          </View>
        )}

        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.livePillText}>LIVE</Text>
        </View>

        {item.current_viewers > 0 && (
          <View style={s.viewers}>
            <Users color="#FFFFFF" size={11} />
            <Text style={s.viewersText}>{item.current_viewers}</Text>
          </View>
        )}

        <LinearGradient colors={['transparent', 'rgba(15,23,42,0.9)']} style={s.thumbFade} />
      </View>

      <Text style={s.cardSeller} numberOfLines={1}>
        {displayName(item.seller?.full_name, 'Seller')}
      </Text>
      <Text style={s.cardTitle} numberOfLines={2}>
        {isRTL ? item.title_ar || item.title : item.title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>{T.title}</Text>
          <Text style={s.h1sub}>{T.sub}</Text>
        </View>
        <View style={s.escrowChip}>
          <ShieldCheck color="#059669" size={13} />
          <Text style={s.escrowChipText}>{isRTL ? 'ضمان' : 'Escrow'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#0F172A" /></View>
      ) : (
        <FlatList
          data={liveNow}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={liveNow.length > 0 ? s.row : undefined}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 96 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#0F172A"
            />
          }
          renderItem={renderCard}
          ListHeaderComponent={
            liveNow.length > 0 ? (
              <View style={s.sectionRow}>
                <View style={s.liveDotLg} />
                <Text style={s.section}>{T.liveNow} ({liveNow.length})</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            // Empty is the common case here, so it is the primary design
            // rather than a fallback -- and it never claims a stream exists.
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Video color="#94A3B8" size={30} />
              </View>
              <Text style={s.emptyTitle}>{T.noneTitle}</Text>
              <Text style={s.emptySub}>{T.noneSub}</Text>
              <TouchableOpacity style={s.notifyBtn} activeOpacity={0.85}>
                <Bell color="#FFFFFF" size={15} />
                <Text style={s.notifyText}>{T.notify}</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            <View>
              {upcoming.length > 0 && (
                <View style={s.upcomingWrap}>
                  <Text style={s.section}>{T.upcoming} ({upcoming.length})</Text>
                  {upcoming.map(u => (
                    <View key={u.id} style={s.upcomingRow}>
                      <View style={s.upcomingIcon}>
                        <Clock color="#64748B" size={16} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.upcomingTitle} numberOfLines={1}>
                          {isRTL ? u.title_ar || u.title : u.title}
                        </Text>
                        <Text style={s.upcomingBy} numberOfLines={1}>
                          {displayName(u.seller?.full_name, 'Seller')}
                        </Text>
                      </View>
                      <Text style={s.upcomingTag}>{T.scheduled}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Seller pitch, once, at the end -- not a pricing wall halfway
                  down a viewer's feed. Pricing lives on the booking screen,
                  which is where someone who has decided to stream goes. */}
              {/* Broadcast passes are paid digital access (3.1.1) to a
                  one-to-many real-time service (3.1.3(d)); both require
                  in-app purchase. The seller pitch is hidden on iOS until
                  passes go through StoreKit. */}
              {!!user && DIGITAL_PURCHASES_ENABLED && (
                <TouchableOpacity
                  style={s.sellCard}
                  activeOpacity={0.9}
                  onPress={() => router.push('/live/book' as any)}
                >
                  <View style={s.sellIcon}>
                    <Video color="#FFFFFF" size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sellTitle}>{T.sellTitle}</Text>
                    <Text style={s.sellSub}>{T.sellSub}</Text>
                  </View>
                  <ChevronRight color="#94A3B8" size={18} />
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { paddingVertical: 60, alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  h1: { fontSize: 30, fontWeight: '800', color: '#0F172A', letterSpacing: -0.8 },
  h1sub: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  escrowChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ECFDF5', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6, marginTop: 6,
  },
  escrowChipText: { fontSize: 12, fontWeight: '800', color: '#047857' },

  list: { paddingHorizontal: 16 },
  row: { gap: 14, marginBottom: 22 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  liveDotLg: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  section: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },

  card: { flex: 1 },
  thumb: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0F172A' },
  thumbImg: { width: '100%', height: 210 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 },
  livePill: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EF4444', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  livePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  viewers: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  viewersText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  cardSeller: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 9 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A', lineHeight: 19, height: 38, marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4, textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#64748B', lineHeight: 20, textAlign: 'center', marginTop: 8 },
  notifyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0F172A', borderRadius: 999,
    paddingHorizontal: 22, height: 48, marginTop: 22,
  },
  notifyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  upcomingWrap: { marginTop: 30, gap: 10 },
  upcomingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12,
  },
  upcomingIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  upcomingBy: { fontSize: 12, color: '#64748B', marginTop: 2 },
  upcomingTag: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },

  sellCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 20, padding: 14,
    marginTop: 30, borderWidth: 1, borderColor: '#E2E8F0',
  },
  sellIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  sellTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sellSub: { fontSize: 12.5, color: '#64748B', lineHeight: 17, marginTop: 2 },
});
