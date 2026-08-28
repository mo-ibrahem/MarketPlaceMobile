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
                <Video color="#CBD5E1" size={40} />
                <Text style={styles.emptyTitle}>لا توجد بثوث حية الآن</Text>
                <Text style={styles.emptySub}>تحقق لاحقاً أو ابدأ بثك الخاص</Text>
                {user && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/live/book' as any)}>
                    <Video color="white" size={14} />
                    <Text style={styles.emptyBtnText}>ابدأ بثك الآن</Text>
                  </TouchableOpacity>
                )}
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
              {LIVE_PASSES.map(pass => (
                <View key={pass.tier} style={styles.passCard}>
                  <Text style={styles.passEmoji}>{pass.badge}</Text>
                  <Text style={styles.passName}>{pass.name_ar}</Text>
                  <Text style={styles.passPrice}>{pass.priceEGP} ج.م</Text>
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
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: 'white' },
  headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  liveDotRed: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#EF4444', letterSpacing: 0.5 },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  goLiveBtnText: { fontSize: 12, fontWeight: '800', color: 'white' },

  list: { padding: 10, gap: 10 },
  center: { height: 100, alignItems: 'center', justifyContent: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  liveCard: { flex: 1 },
  liveCardVideo: { aspectRatio: 9 / 14, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0F172A', position: 'relative' },
  liveCardImg: { width: '100%', height: '100%', position: 'absolute' },
  livePill: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'white' },
  livePillText: { fontSize: 9, fontWeight: '900', color: 'white' },
  viewersBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  viewersText: { fontSize: 10, color: 'white', fontWeight: '700' },
  liveCardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  sellerAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  sellerAvatarText: { fontSize: 10, fontWeight: '800', color: 'white' },
  sellerName: { fontSize: 10, color: '#94A3B8' },
  streamTitle: { fontSize: 11, fontWeight: '700', color: 'white' },

  upcomingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6 },
  upcomingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  upcomingTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  upcomingBy: { fontSize: 11, color: '#64748B' },
  maxViewBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  maxViewText: { fontSize: 10, color: '#94A3B8' },

  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 12, marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#94A3B8', marginBottom: 16 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnText: { fontSize: 13, fontWeight: '800', color: 'white' },

  howCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  howTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  howText: { fontSize: 12, color: '#475569', flex: 1 },
  passRow: { flexDirection: 'row', gap: 8 },
  passCard: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 10, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  passEmoji: { fontSize: 20 },
  passName: { fontSize: 10, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  passPrice: { fontSize: 14, fontWeight: '900', color: '#3B82F6' },
  passDuration: { fontSize: 9, color: '#94A3B8' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: 14, padding: 13 },
  bookBtnText: { fontSize: 13, fontWeight: '800', color: 'white', flex: 1, textAlign: 'center' },
});
