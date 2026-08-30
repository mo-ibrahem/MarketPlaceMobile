import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Users, Clock, Video, Zap, ShieldCheck, Package, Play, ChevronRight } from 'lucide-react-native';
import { getActiveLiveSessions, LIVE_PASSES, type LiveSession } from '../../src/services/lib/liveService';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../src/services/lib/supabase';

export default function LiveDiscoveryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    try {
      const data = await getActiveLiveSessions();
      setSessions(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Realtime live feed updates
    const sub = supabase
      .channel('mobile_live_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const liveNow = sessions.filter(s => s.status === 'live');
  const upcoming = sessions.filter(s => s.status === 'scheduled');

  const renderLiveCard = ({ item }: { item: LiveSession }) => (
    <TouchableOpacity
      style={styles.liveCard}
      activeOpacity={0.88}
      onPress={() => router.push(`/live/${item.agora_channel}` as any)}
    >
      <View style={styles.liveCardVideo}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.liveCardImg} />
        ) : (
          <View style={[styles.liveCardImg, { alignItems: 'center', justifyContent: 'center' }]}>
            <Play color="rgba(255,255,255,0.4)" size={32} />
          </View>
        )}
        {/* Live Pill */}
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
        {/* Viewers */}
        <View style={styles.viewersBadge}>
          <Users color="white" size={10} />
          <Text style={styles.viewersText}>{item.current_viewers}</Text>
        </View>
        {/* Gradient */}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.liveCardGradient}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>{item.seller?.full_name?.[0]?.toUpperCase() || 'S'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName} numberOfLines={1}>{item.seller?.full_name || 'Seller'}</Text>
              <Text style={styles.streamTitle} numberOfLines={1}>{item.title_ar || item.title}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1C2541']} style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDotRed} />
              <Text style={styles.liveBadgeText}>EGYBAY LIVE — بث مباشر</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>سوق البث المباشر</Text>
          <Text style={styles.headerSub}>اشترِ مباشرة من التجار الموثوقين بضمان مالي كامل</Text>
        </View>
        {user && (
          <TouchableOpacity
            style={styles.goLiveBtn}
            onPress={() => router.push('/live/book' as any)}
          >
            <Video color="white" size={15} />
            <Text style={styles.goLiveBtnText}>ابدأ البث</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <FlatList
        data={liveNow}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} tintColor="#EF4444" />}
        ListHeaderComponent={
          <View>
            {loading ? (
              <View style={styles.center}><ActivityIndicator color="#EF4444" /></View>
            ) : liveNow.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Video color="#EF4444" size={36} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.emptyTitle}>لا توجد بثوث حية الآن</Text>
                  <Text style={styles.emptySub}>تحقق لاحقاً أو ابدأ بثك المباشر الخاص وقم ببيع منتجاتك</Text>
                  {user && (
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/live/book' as any)}>
                      <Video color="white" size={16} strokeWidth={2.5} />
                      <Text style={styles.emptyBtnText}>ابدأ بثك الآن</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.sectionHeader}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                <Text style={styles.sectionTitle}>يبث الآن ({liveNow.length})</Text>
              </View>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <View style={[styles.sectionHeader, { marginBottom: 8 }]}>
                  <Clock color="#3B82F6" size={14} />
                  <Text style={[styles.sectionTitle, { color: '#3B82F6' }]}>بثوث قادمة ({upcoming.length})</Text>
                </View>
                {upcoming.map(s => (
                  <View key={s.id} style={styles.upcomingCard}>
                    <View style={styles.upcomingIcon}>
                      <Clock color="#3B82F6" size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.upcomingTitle} numberOfLines={1}>{s.title_ar || s.title}</Text>
                      <Text style={styles.upcomingBy}>{s.seller?.full_name || 'Seller'}</Text>
                    </View>
                    <View style={styles.maxViewBadge}>
                      <Users color="#64748B" size={10} />
                      <Text style={styles.maxViewText}>{s.max_viewers}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        }
        renderItem={renderLiveCard}
        ListFooterComponent={
          <View style={styles.howCard}>
            <Text style={styles.howTitle}>كيف يعمل EgyBay Live للبائعين؟</Text>
            {[
              { step: '١', text: 'احجز الباقة وادفع من محفظتك (٧٩ - ٢٩٩ ج.م)', icon: Zap, color: '#F59E0B' },
              { step: '٢', text: 'ابدأ البث وثبّت منتجاتك على شاشة المشاهدين', icon: Video, color: '#EF4444' },
              { step: '٣', text: 'البيع بضمان مالي كامل — أرباحك للمحفظة بعد الشحن بوسطة', icon: ShieldCheck, color: '#10B981' },
            ].map(item => (
              <View key={item.step} style={styles.howRow}>
                <View style={[styles.howIcon, { backgroundColor: item.color + '20' }]}>
                  <item.icon color={item.color} size={16} />
                </View>
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
            <View style={styles.passRow}>
              {LIVE_PASSES.map((pass, idx) => (
                <View key={pass.tier} style={[styles.passCard, idx === 2 && styles.passCardFeatured]}>
                  {idx === 2 && (
                    <View style={styles.passFeaturedBadge}>
                      <Text style={styles.passFeaturedBadgeText}>الأكثر مبيعاً</Text>
                    </View>
                  )}
                  <Text style={styles.passEmoji}>{pass.badge}</Text>
                  <Text style={styles.passName}>{pass.name_ar}</Text>
                  <Text style={[styles.passPrice, idx === 2 && { color: '#B45309' }]}>{pass.priceEGP} ج.م</Text>
                  <Text style={styles.passDuration}>{pass.durationMinutes} دقيقة</Text>
                </View>
              ))}
            </View>
            {user && (
              <TouchableOpacity style={styles.bookBtn} onPress={() => router.push('/live/book' as any)}>
                <Video color="white" size={16} />
                <Text style={styles.bookBtnText}>احجز بثك المباشر الآن</Text>
                <ChevronRight color="white" size={16} />
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: 'white' },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  liveDotRed: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.8, shadowRadius: 4 },
  liveBadgeText: { fontSize: 9, fontWeight: '900', color: '#EF4444', letterSpacing: 0.5 },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#EF4444', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  goLiveBtnText: { fontSize: 13, fontWeight: '900', color: 'white' },

  list: { padding: 12, gap: 12 },
  center: { height: 100, alignItems: 'center', justifyContent: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },

  liveCard: { flex: 1 },
  liveCardVideo: { aspectRatio: 9 / 14, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0F172A', position: 'relative', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  liveCardImg: { width: '100%', height: '100%', position: 'absolute' },
  livePill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'white' },
  livePillText: { fontSize: 9, fontWeight: '900', color: 'white', letterSpacing: 0.5 },
  viewersBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  viewersText: { fontSize: 11, color: 'white', fontWeight: '800' },
  liveCardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, paddingTop: 30 },
  sellerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  sellerAvatarText: { fontSize: 12, fontWeight: '900', color: 'white' },
  sellerName: { fontSize: 11, color: '#E2E8F0', fontWeight: '600' },
  streamTitle: { fontSize: 13, fontWeight: '800', color: 'white', marginTop: 2 },

  upcomingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#EEF2FF', marginBottom: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  upcomingIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  upcomingTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  upcomingBy: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  maxViewBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  maxViewText: { fontSize: 11, color: '#64748B', fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 10 },
  emptyCard: { backgroundColor: 'white', width: '100%', borderRadius: 24, padding: 32, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4, borderWidth: 1, borderColor: '#FEF2F2' },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, width: '100%', shadowColor: '#EF4444', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  emptyBtnText: { fontSize: 15, fontWeight: '900', color: 'white' },

  howCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginTop: 12, borderWidth: 1, borderColor: '#EEF2FF', gap: 14, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3 },
  howTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  howText: { fontSize: 12, color: '#475569', flex: 1, fontWeight: '600', lineHeight: 18 },
  
  passRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  passCard: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#E2E8F0', position: 'relative' },
  passCardFeatured: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', shadowColor: '#F59E0B', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  passFeaturedBadge: { position: 'absolute', top: -8, backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  passFeaturedBadgeText: { color: 'white', fontSize: 8, fontWeight: '900' },
  passEmoji: { fontSize: 24, marginBottom: 4 },
  passName: { fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 2 },
  passPrice: { fontSize: 15, fontWeight: '900', color: '#3B82F6' },
  passDuration: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: 16, padding: 14, marginTop: 8, shadowColor: '#EF4444', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  bookBtnText: { fontSize: 14, fontWeight: '900', color: 'white' },
});
