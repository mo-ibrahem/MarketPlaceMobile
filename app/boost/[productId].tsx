import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Flame,
  Lock,
  Radio,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import {
  BOOST_PACKAGES,
  boostProduct,
  type BoostPackage,
} from '../../src/services/lib/boostService';
import { productService, type Product } from '../../src/services/lib/products';
import { getUserWallet, type UserWallet } from '../../src/services/lib/walletService';

export default function BoostProductScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<Product | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [selectedTier, setSelectedTier] = useState<'urgent' | 'featured' | 'turbo'>('featured');
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!productId) return;
      try {
        const prod = await productService.getProductById(productId);
        setProduct(prod);
        if (user) {
          const w = await getUserWallet(user.id);
          setWallet(w);
        }
      } catch (err) {
        console.error('Error loading boost product:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [productId, user]);

  const selectedPkg: BoostPackage = BOOST_PACKAGES[selectedTier];
  const walletBalance = Number(wallet?.available_balance || 0);
  const canPayWithWallet = walletBalance >= selectedPkg.priceEGP;

  const handleApplyBoost = async () => {
    if (!product || !user) return;

    if (!canPayWithWallet) {
      // No card fallback to offer: boosts are wallet-balance-only (see the
      // Payment Method section below), so the only route is topping up.
      Alert.alert(
        'Not enough wallet balance',
        `This boost costs EGP ${selectedPkg.priceEGP.toLocaleString()} and your available balance is EGP ${walletBalance.toLocaleString()}. Top up your wallet, then come back.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Top up wallet', onPress: () => router.push('/wallet' as any) },
        ],
      );
      return;
    }

    setBoosting(true);
    try {
      const res = await boostProduct(product.id, user.id, selectedTier);
      Toast.show({
        type: 'success',
        text1: 'Boost Activated! ⚡🚀',
        text2: res.message,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Boost Failed', err?.message || 'Could not apply boost');
    } finally {
      setBoosting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Promote & Boost Listing</Text>
        <View style={styles.topIconBox}>
          <Sparkles color="#2563EB" size={18} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
      >
        <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          {/* Product Mini Preview Card */}
          {product && (
            <View style={styles.prodPreviewCard}>
              <Image
                source={{
                  uri:
                    product.images?.[0] ||
                    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300',
                }}
                style={styles.prodThumb}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.prodTitle} numberOfLines={1}>
                  {product.title}
                </Text>
                <Text style={styles.prodPrice}>EGP {Number(product.price).toLocaleString()}</Text>
                <View style={styles.prodStatusRow}>
                  <Text style={styles.prodCategory}>{product.category}</Text>
                  <Text style={styles.prodCondition}>• {product.condition}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Value Prop Banner */}
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroBadge}>
              <TrendingUp color="#38BDF8" size={14} />
              <Text style={styles.heroBadgeText}>EBAY & DUBIZZLE ALGORITHM BOOST</Text>
            </View>
            <Text style={styles.heroTitle}>Sell Up to 10x Faster</Text>
            <Text style={styles.heroSub}>
              Boosted listings appear at the top of Cairo & Alexandria searches, get gold badges, and trigger instant buyer interest.
            </Text>
          </LinearGradient>

          {/* Package Selection Cards */}
          <Text style={styles.sectionHeading}>Choose Promotion Package</Text>

          {(['urgent', 'featured', 'turbo'] as const).map((tierKey) => {
            const pkg = BOOST_PACKAGES[tierKey];
            const isSelected = selectedTier === tierKey;

            return (
              <TouchableOpacity
                key={tierKey}
                style={[styles.pkgCard, isSelected && styles.pkgCardSelected]}
                onPress={() => setSelectedTier(tierKey)}
                activeOpacity={0.9}
              >
                {tierKey === 'featured' && (
                  <View style={styles.popularRibbon}>
                    <Text style={styles.popularRibbonText}>MOST POPULAR ⭐</Text>
                  </View>
                )}

                <View style={styles.pkgTopRow}>
                  <View style={styles.pkgBadgeWrap}>
                    <Text style={styles.pkgBadgeEmoji}>{pkg.badgeEmoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pkgTitle}>{pkg.title}</Text>
                    <Text style={styles.pkgMultiplier}>{pkg.multiplierText}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.pkgPrice}>EGP {pkg.priceEGP}</Text>
                    <Text style={styles.pkgDuration}>{pkg.durationDays} Days</Text>
                  </View>
                </View>

                <Text style={styles.pkgDesc}>{pkg.description}</Text>

                <View style={styles.perksList}>
                  {pkg.perks.map((p, idx) => (
                    <View key={idx} style={styles.perkItem}>
                      <CheckCircle2 color={isSelected ? '#2563EB' : '#10B981'} size={14} />
                      <Text style={styles.perkText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Payment Method.
              Boosts are wallet-balance-only, mirroring the web app:
              /api/paymob/session rejects purpose: 'boost' outright because a
              card-paid boost has no activation path on the webhook side, which
              would take a seller's money and apply nothing. The card option
              that used to sit here could only ever fail. */}
          <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Payment Method</Text>

          <View style={[styles.paymentOptionCard, styles.paymentOptionActive]}>
            <Wallet size={20} color="#2563EB" />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentOptionTitle}>Deduct from Available Wallet</Text>
              <Text style={styles.paymentOptionSub}>
                Available: <Text style={{ fontWeight: '800', color: '#0F172A' }}>EGP {walletBalance.toLocaleString()}</Text>
              </Text>
            </View>
            <CheckCircle2 color="#2563EB" size={20} />
          </View>

          {!canPayWithWallet && (
            <TouchableOpacity style={styles.topUpHint} onPress={() => router.push('/wallet' as any)}>
              <CreditCard size={15} color="#B45309" />
              <Text style={styles.topUpHintText}>
                Not enough balance for this package — top up your wallet to boost.
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>Total Due</Text>
          <Text style={styles.totalAmount}>EGP {selectedPkg.priceEGP}</Text>
        </View>

        <TouchableOpacity
          style={styles.activateBtn}
          onPress={handleApplyBoost}
          disabled={boosting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activateGradient}
          >
            {boosting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Zap color="white" size={18} />
                <Text style={styles.activateText}>Activate Boost ⚡</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  topIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

  scrollContent: { padding: 16 },

  prodPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  prodThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F1F5F9' },
  prodTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  prodPrice: { fontSize: 14, fontWeight: '900', color: '#2563EB', marginBottom: 2 },
  prodStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  prodCategory: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  prodCondition: { fontSize: 11, color: '#64748B' },

  heroBanner: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroBadgeText: { color: '#38BDF8', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  heroSub: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, lineHeight: 17 },

  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },

  pkgCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  pkgCardSelected: { borderColor: '#2563EB', backgroundColor: '#F8FAFF' },
  popularRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularRibbonText: { color: 'white', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  pkgTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  pkgBadgeWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  pkgBadgeEmoji: { fontSize: 20 },
  pkgTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  pkgMultiplier: { fontSize: 11, fontWeight: '800', color: '#2563EB', marginTop: 1 },
  pkgPrice: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  pkgDuration: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  pkgDesc: { fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 16 },

  perksList: { gap: 6 },
  perkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontSize: 11, color: '#334155', fontWeight: '600' },

  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  paymentOptionActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  topUpHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 11,
    borderWidth: 1, borderColor: '#FDE68A', marginTop: 8,
  },
  topUpHintText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#92400E', lineHeight: 17 },
  paymentOptionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  paymentOptionSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  totalLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  activateBtn: { flex: 1.6, borderRadius: 14, overflow: 'hidden' },
  activateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  activateText: { color: 'white', fontSize: 14, fontWeight: '800' },
});
