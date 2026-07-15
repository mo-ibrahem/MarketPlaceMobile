import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Baby,
  Dumbbell,
  Heart,
  Home,
  LayoutGrid,
  Search,
  Shirt,
  Smartphone,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EgbayLogo from '../../assets/images/egbay.svg';
import { productService, type Product } from '../../src/services/lib/products';

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_SEARCHES = ['Electronics', 'iPhone', 'Fashion', 'Furniture', 'Toys', 'Books'];

const CATEGORIES = [
  { id: 'all',         nameKey: 'home.categories.allCategories', icon: LayoutGrid,  color: '#6366F1', bg: '#EEF2FF' },
  { id: 'Electronics', nameKey: 'home.categories.electronics',   icon: Smartphone,  color: '#0EA5E9', bg: '#E0F2FE' },
  { id: 'Fashion',     nameKey: 'home.categories.fashion',       icon: Shirt,       color: '#EC4899', bg: '#FCE7F3' },
  { id: 'Home',        nameKey: 'home.categories.home',          icon: Home,        color: '#10B981', bg: '#D1FAE5' },
  { id: 'Toys',        nameKey: 'home.categories.toys',          icon: Baby,        color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'Sports',      nameKey: 'sell.categories.sports',        icon: Dumbbell,    color: '#EF4444', bg: '#FEE2E2' },
] as const;

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  // ── Data Loading ────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      const list = data || [];
      setProducts(list);
      setWishlistIds(new Set(list.filter(p => p.isWishlisted).map(p => p.id)));
    } catch (e) {
      console.error('[Home] failed to load products', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadProducts(); }, [loadProducts])
  );

  // ── Derived data ────────────────────────────────────────────────────────────

  /** "Trending" = most expensive items (premium feel) */
  const trending = useMemo(
    () => [...products].sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 6),
    [products]
  );

  /** Recently Added = newest first (API default), up to 8 */
  const recentlyAdded = products.slice(0, 8);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSearch = (q = searchQuery) => {
    if (!q.trim()) return;
    setSearchFocused(false);
    router.push({ pathname: '/products', params: { search: q } } as any);
  };

  const handleCategory = (cat: typeof CATEGORIES[number]) => {
    router.push(
      cat.id === 'all'
        ? ('/products' as any)
        : ({ pathname: '/products', params: { category: cat.id } } as any)
    );
  };

  const toggleWishlist = async (product: Product) => {
    const was = wishlistIds.has(product.id);
    // Optimistic update
    setWishlistIds(prev => {
      const next = new Set(prev);
      was ? next.delete(product.id) : next.add(product.id);
      return next;
    });
    try {
      was
        ? await productService.removeFromWishlist(product.id)
        : await productService.addToWishlist(product.id);
    } catch {
      // Revert on error
      setWishlistIds(prev => {
        const next = new Set(prev);
        was ? next.add(product.id) : next.delete(product.id);
        return next;
      });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ════════════════ HERO ════════════════ */}
        <LinearGradient
          colors={['#1D4ED8', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 24 }]}
        >
          {/* Logo backdrop */}
          <View style={styles.logoBadge}>
            <EgbayLogo width={170} height={58} />
          </View>

          <Text style={styles.heroSubtitle}>{t('home.heroSubtitle')}</Text>

          {/* Search row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Search color="#9CA3AF" size={18} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                onSubmitEditing={() => handleSearch()}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X color="#9CA3AF" size={16} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={() => handleSearch()}>
              <Search color="white" size={18} />
            </TouchableOpacity>
          </View>

          {/* Quick search chips (shown while focused) */}
          {searchFocused && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.quickRow}
              style={{ marginTop: 14 }}
            >
              {QUICK_SEARCHES.map(q => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => handleSearch(q)}>
                  <Search color="rgba(255,255,255,0.75)" size={11} />
                  <Text style={styles.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </LinearGradient>

        {/* ════════════════ CATEGORIES ════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.shopByCategory')}</Text>
          <TouchableOpacity onPress={() => router.push('/products' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.pill, { backgroundColor: cat.bg, borderColor: cat.color + '40' }]}
                onPress={() => handleCategory(cat)}
                activeOpacity={0.75}
              >
                <View style={[styles.pillIconRing, { backgroundColor: cat.color + '20' }]}>
                  <Icon color={cat.color} size={18} />
                </View>
                <Text style={[styles.pillLabel, { color: cat.color }]}>{t(cat.nameKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ════════════════ TRENDING NOW ════════════════ */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <View style={styles.titleRow}>
            <TrendingUp color="#EF4444" size={18} />
            <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>Trending Now</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/products' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
            {[1, 2, 3].map(i => <SkeletonTrendCard key={i} />)}
          </ScrollView>
        ) : (
          <FlatList
            data={trending}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendRow}
            keyExtractor={item => 'trend-' + item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.trendCard}
                onPress={() => router.push(`/products/${item.id}` as any)}
                activeOpacity={0.88}
              >
                <Image
                  source={{ uri: item.images?.[0] || 'https://placehold.co/300x380/334155/94a3b8?text=Item' }}
                  style={styles.trendImage}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.84)']}
                  style={styles.trendOverlay}
                >
                  <Text style={styles.trendTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.trendPricePill}>
                    <Text style={styles.trendPriceText}>${Number(item.price).toFixed(2)}</Text>
                  </View>
                </LinearGradient>
                {/* Heart button */}
                <TouchableOpacity style={styles.trendHeart} onPress={() => toggleWishlist(item)}>
                  <Heart
                    size={16}
                    color={wishlistIds.has(item.id) ? '#EF4444' : 'white'}
                    fill={wishlistIds.has(item.id) ? '#EF4444' : 'none'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}

        {/* ════════════════ RECENTLY ADDED ════════════════ */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <View style={styles.titleRow}>
            <Sparkles color="#F59E0B" size={18} />
            <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>{t('home.recentlyAdded')}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/products' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.recentGrid}>
            {[[0, 1], [2, 3]].map((pair, i) => (
              <View key={i} style={styles.recentRow}>
                {pair.map(k => <SkeletonProductCard key={k} />)}
              </View>
            ))}
          </View>
        ) : recentlyAdded.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No listings yet — be the first to sell! 🛍️</Text>
          </View>
        ) : (
          <FlatList
            data={recentlyAdded}
            numColumns={2}
            scrollEnabled={false}
            keyExtractor={item => 'recent-' + item.id}
            contentContainerStyle={styles.recentGrid}
            columnWrapperStyle={styles.recentRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => router.push(`/products/${item.id}` as any)}
                activeOpacity={0.88}
              >
                {/* Image + overlaid badges */}
                <View style={styles.imgWrapper}>
                  <Image
                    source={{ uri: item.images?.[0] || 'https://placehold.co/400x300/F1F5F9/64748B?text=Item' }}
                    style={styles.productImg}
                  />
                  {/* Blue price pill */}
                  <View style={styles.imgPricePill}>
                    <Text style={styles.imgPriceText}>${Number(item.price).toFixed(2)}</Text>
                  </View>
                  {/* Heart */}
                  <TouchableOpacity style={styles.imgHeart} onPress={() => toggleWishlist(item)}>
                    <Heart
                      size={14}
                      color={wishlistIds.has(item.id) ? '#EF4444' : '#6B7280'}
                      fill={wishlistIds.has(item.id) ? '#EF4444' : 'none'}
                    />
                  </TouchableOpacity>
                  {/* "NEW" badge */}
                  {item.condition === 'New' && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                {/* Card body */}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardSeller} numberOfLines={1}>
                    {item.seller?.full_name ?? 'Seller'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Skeleton Helpers ─────────────────────────────────────────────────────────

function Pulse({ style }: { style?: object }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,    duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: '#E2E8F0', borderRadius: 10 }, style, { opacity }]} />;
}

function SkeletonTrendCard() {
  return <Pulse style={{ width: 160, height: 224, borderRadius: 22, marginRight: 0 }} />;
}

function SkeletonProductCard() {
  return (
    <View style={[styles.productCard, { flex: 1 }]}>
      <Pulse style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 0 }} />
      <View style={{ padding: 10, gap: 8 }}>
        <Pulse style={{ height: 13, width: '85%' }} />
        <Pulse style={{ height: 11, width: '55%' }} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  logoBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', height: 50 },
  searchBtn: {
    backgroundColor: '#2563EB',
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  quickRow: { gap: 8, paddingBottom: 4 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  quickChipText: { color: 'white', fontSize: 13, fontWeight: '500' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  seeAll: { fontSize: 13, color: '#2563EB', fontWeight: '700' },

  // Category pills
  pillRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  pillIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillLabel: { fontSize: 14, fontWeight: '700' },

  // Trending
  trendRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  trendCard: {
    width: 160,
    height: 224,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  trendImage: { width: '100%', height: '100%', position: 'absolute' },
  trendOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: 'flex-end',
  },
  trendTitle: { color: 'white', fontSize: 13, fontWeight: '700', marginBottom: 7, lineHeight: 18 },
  trendPricePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trendPriceText: { color: 'white', fontSize: 13, fontWeight: '800' },
  trendHeart: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 20,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Recently Added grid
  recentGrid: { paddingHorizontal: 14, paddingBottom: 4 },
  recentRow: { gap: 12, marginBottom: 12 },
  productCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  imgWrapper: { position: 'relative' },
  productImg: { width: '100%', aspectRatio: 4 / 3 },
  imgPricePill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imgPriceText: { color: 'white', fontSize: 12, fontWeight: '800' },
  imgHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  newBadgeText: { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 4, lineHeight: 18 },
  cardSeller: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  // Empty
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});