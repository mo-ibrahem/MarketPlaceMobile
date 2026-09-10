import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, AlertCircle, Video, Wallet } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { bookLiveSession, LIVE_PASSES, type LivePassTier } from '../../src/services/lib/liveService';
import { getUserWallet } from '../../src/services/lib/walletService';
import { supabase } from '../../src/services/lib/supabase';

const CATEGORIES = [
  { value: 'Electronics', label: 'إلكترونيات' },
  { value: 'Fashion', label: 'أزياء وأحذية' },
  { value: 'Home', label: 'أثاث ومنزل' },
  { value: 'Sports', label: 'رياضة ولياقة' },
  { value: 'Toys', label: 'ألعاب' },
  { value: 'Automotive', label: 'سيارات' },
];

export default function BookLiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedTier, setSelectedTier] = useState<LivePassTier>('pro');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    getUserWallet(user.id)
      .then((wallet) => {
        setBalance(wallet?.available_balance ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [user]);

  const selectedPass = LIVE_PASSES.find(p => p.tier === selectedTier)!;
  const canAfford = balance >= selectedPass.priceEGP;

  const handleBook = async () => {
    if (!user || !title.trim()) return;
    setBooking(true);
    setError('');
    try {
      const session = await bookLiveSession({
        sellerId: user.id,
        title: title.trim(),
        titleAr: titleAr.trim() || undefined,
        tier: selectedTier,
        category,
      });
      router.replace(`/live/studio?session=${session.id}` as any);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء الحجز');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#EF4444" /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#0F172A', '#1C2541']} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>احجز بثك المباشر</Text>
          <Text style={s.headerSub}>Book a Live Show</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>

        {/* Wallet Balance */}
        <View style={s.walletCard}>
          <Wallet color="#10B981" size={18} />
          <View>
            <Text style={s.walletLabel}>رصيد المحفظة المتاح</Text>
            <Text style={s.walletBalance}>{balance.toLocaleString('ar-EG')} ج.م</Text>
          </View>
          {!canAfford && (
            <TouchableOpacity onPress={() => router.push('/wallet' as any)} style={s.topUpBtn}>
              <Text style={s.topUpText}>شحن ←</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pass Selection */}
        <Text style={s.sectionLabel}>اختر باقة البث</Text>
        {LIVE_PASSES.map(pass => {
          const isSelected = selectedTier === pass.tier;
          const affordable = balance >= pass.priceEGP;
          return (
            <TouchableOpacity
              key={pass.tier}
              onPress={() => setSelectedTier(pass.tier)}
              style={[s.passCard, isSelected && s.passCardSelected, !affordable && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {pass.recommended && (
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>الأكثر طلباً</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>{pass.badge}</Text>
                  <View>
                    <Text style={[s.passName, isSelected && { color: '#1D4ED8' }]}>{pass.name_ar}</Text>
                    <Text style={s.passDetails}>{pass.durationMinutes} دقيقة • حتى {pass.maxViewers} مشاهد</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.passPrice, isSelected && { color: '#1D4ED8' }]}>{pass.priceEGP}</Text>
                  <Text style={s.passCurrency}>ج.م</Text>
                </View>
              </View>
              {isSelected && (
                <View style={s.passFeatures}>
                  {pass.features_ar.map((f, i) => (
                    <View key={i} style={s.featureRow}>
                      <CheckCircle2 color="#10B981" size={12} />
                      <Text style={s.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Details Form */}
        <Text style={s.sectionLabel}>تفاصيل البث</Text>

        {error ? (
          <View style={s.errorBox}>
            <AlertCircle color="#EF4444" size={14} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          value={titleAr}
          onChangeText={setTitleAr}
          placeholder="عنوان البث بالعربية *"
          style={s.input}
          textAlign="right"
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Stream Title in English *"
          style={s.input}
        />

        {/* Category */}
        <View style={s.categoriesWrap}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[s.catChip, category === c.value && s.catChipSelected]}
            >
              <Text style={[s.catText, category === c.value && s.catTextSelected]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cost Summary */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>سعر الباس:</Text>
            <Text style={s.summaryValue}>{selectedPass.priceEGP} ج.م</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>الرصيد بعد الدفع:</Text>
            <Text style={[s.summaryValue, { color: balance - selectedPass.priceEGP < 0 ? '#EF4444' : '#10B981' }]}>
              {(balance - selectedPass.priceEGP).toLocaleString()} ج.م
            </Text>
          </View>
          <Text style={s.summaryNote}>* عمولة إيجي باي ٤٪ على كل سلعة مباعة خلال البث</Text>
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={[s.bookBtn, (!canAfford || !title.trim() || booking) && { opacity: 0.5 }]}
          onPress={handleBook}
          disabled={!canAfford || !title.trim() || booking}
          activeOpacity={0.85}
        >
          {booking ? <ActivityIndicator color="white" size="small" /> : <Video color="white" size={18} />}
          <Text style={s.bookBtnText}>
            {canAfford
              ? `احجز البث وادفع ${selectedPass.priceEGP} ج.م من المحفظة`
              : 'رصيد غير كافٍ — اشحن محفظتك أولاً'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: 'white' },
  headerSub: { fontSize: 11, color: '#94A3B8' },
  content: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#374151', marginTop: 4 },

  walletCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0F172A', borderRadius: 16, padding: 14 },
  walletLabel: { fontSize: 11, color: '#94A3B8' },
  walletBalance: { fontSize: 20, fontWeight: '900', color: 'white' },
  topUpBtn: { marginLeft: 'auto' as any, backgroundColor: '#3B82F6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  topUpText: { fontSize: 11, fontWeight: '800', color: 'white' },

  passCard: { backgroundColor: 'white', borderRadius: 18, padding: 14, borderWidth: 2, borderColor: '#E2E8F0', gap: 10, position: 'relative' },
  passCardSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  popularBadge: { position: 'absolute', top: -10, alignSelf: 'center', backgroundColor: '#3B82F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  popularText: { fontSize: 11, fontWeight: '900', color: 'white' },
  passName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  passDetails: { fontSize: 11, color: '#64748B' },
  passPrice: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  passCurrency: { fontSize: 11, color: '#94A3B8' },
  passFeatures: { gap: 5, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 11, color: '#374151' },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: 12, color: '#B91C1C', flex: 1 },

  input: { backgroundColor: 'white', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F172A' },

  categoriesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  catChipSelected: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  catText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  catTextSelected: { color: '#1D4ED8', fontWeight: '800' },

  summaryCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  summaryNote: { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: 16, padding: 15, marginTop: 4 },
  bookBtnText: { fontSize: 14, fontWeight: '800', color: 'white', flex: 1, textAlign: 'center' },
});
