import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Baby,
  BookOpen,
  Car,
  Clock,
  Dumbbell,
  Globe,
  Heart,
  Home,
  LayoutGrid,
  MapPin,
  Search,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Truck,
  X,
  Zap,
  Video,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useLanguage } from '../../hooks/useLanguage';
import { getProductBoostInfo } from '../../src/services/lib/boostService';
import { productService, type Product } from '../../src/services/lib/products';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatEGP(price: number | string): string {
  const n = Math.round(Number(price));
  return `EGP ${n.toLocaleString('en-EG')}`;
}

function getCountdownToMidnight(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_SEARCHES = ['Electronics', 'iPhone 15', 'Jordan', 'PlayStation', 'Furniture', 'Toyota'];

const TRENDING_SEARCHES = [
  { label: 'iPhone 15', emoji: '🔥' },
  { label: 'Laptop', emoji: '💻' },
  { label: 'Jordan Sneakers', emoji: '👟' },
  { label: 'PlayStation 5', emoji: '🎮' },
  { label: 'Air Fryer', emoji: '🍳' },
  { label: 'Camera DSLR', emoji: '📷' },
  { label: 'Watch Rolex', emoji: '⌚' },
  { label: 'Sofa Set', emoji: '🛋️' },
];

const DEAL_BANNERS = [
  {
    key: 'b0',
    titleKey: 'home.dealBannerLiveTitle',
    subKey: 'home.dealBannerLiveSub',
    titleFallback: 'EgyBay Live — بث مباشر 🔴',
    subFallback: 'تسوق مباشرة مع التجار عبر البث المباشر واشترِ بضمان مالي وشحن بوسطة',
    colors: ['#7F1D1D', '#B91C1C'] as [string, string],
    emoji: '🔴',
    category: '__live__',
  },
  {
    key: 'b1',
    titleKey: 'home.dealBanner1Title',
    subKey: 'home.dealBanner1Sub',
    colors: ['#1D4ED8', '#7C3AED'] as [string, string],
    emoji: '🔥',
    category: 'Electronics',
  },
  {
    key: 'b2',
    titleKey: 'home.dealBanner2Title',
    subKey: 'home.dealBanner2Sub',
    colors: ['#0369A1', '#0EA5E9'] as [string, string],
    emoji: '✨',
    category: undefined,
  },
  {
    key: 'b3',
    titleKey: 'home.dealBanner3Title',
    subKey: 'home.dealBanner3Sub',
    colors: ['#065F46', '#10B981'] as [string, string],
    emoji: '🛡️',
    category: undefined,
  },
];

const CATEGORIES = [
  { id: 'all',         nameKey: 'home.categories.allCategories', emoji: '✨', icon: LayoutGrid,  color: '#6366F1', bg: '#EEF2FF'  },
  { id: 'Electronics', nameKey: 'home.categories.electronics',   emoji: '📱', icon: Smartphone,  color: '#0EA5E9', bg: '#E0F2FE'  },
  { id: 'Fashion',     nameKey: 'home.categories.fashion',       emoji: '👗', icon: Shirt,        color: '#EC4899', bg: '#FCE7F3'  },
  { id: 'Home',        nameKey: 'home.categories.home',          emoji: '🛋️', icon: Home,         color: '#10B981', bg: '#D1FAE5'  },
  { id: 'Toys',        nameKey: 'home.categories.toys',          emoji: '🧸', icon: Baby,         color: '#F59E0B', bg: '#FEF3C7'  },
  { id: 'Sports',      nameKey: 'home.categories.sports',        emoji: '⚽', icon: Dumbbell,     color: '#EF4444', bg: '#FEE2E2'  },
  { id: 'Books',       nameKey: 'home.categories.books',         emoji: '📚', icon: BookOpen,     color: '#8B5CF6', bg: '#EDE9FE'  },
  { id: 'Automotive',  nameKey: 'home.categories.automotive',    emoji: '🚗', icon: Car,          color: '#64748B', bg: '#F1F5F9'  },
] as const;

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive calculations
  const isTabletOrDesktop = width >= 768;
  const maxContentWidth = Math.min(width, 960);
  const bannerWidth = Math.min(width - 32, 920);
  const numColumns = width >= 900 ? 4 : width >= 600 ? 3 : 2;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(getCountdownToMidnight());

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdownToMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Banner carousel
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollView>(null);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bannerTimer.current = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % DEAL_BANNERS.length;
        bannerRef.current?.scrollTo({ x: next * (bannerWidth + 12), animated: true });
        return next;
      });
    }, 3500);
    return () => { if (bannerTimer.current) clearInterval(bannerTimer.current); };
  }, [bannerWidth]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const trending = useMemo(
    () => [...products].sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 8),
    [products]
  );

  const recentlyAdded = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        const aBoost = (a as any).is_promoted ? 1 : 0;
        const bBoost = (b as any).is_promoted ? 1 : 0;
        return bBoost - aBoost;
      })
      .slice(0, 12);
  }, [products]);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ alignItems: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        <View style={[styles.pageWrapper, { maxWidth: maxContentWidth }]}>

          {/* ════════════════ FLAGSHIP TOP BAR ════════════════ */}
          <View style={[styles.flagshipHeader, { paddingTop: insets.top + 10 }]}>
            {/* Row 1: Logo & Utility Controls */}
            <View style={styles.topHeaderRow}>
              <TouchableOpacity onPress={() => router.push('/(tabs)' as any)} activeOpacity={0.8}>
                <Image
                  source={require('../../assets/images/egbay_logo_header.png')}
                  style={{ width: 125, height: 44, resizeMode: 'contain' }}
                />
              </TouchableOpacity>

              <View style={styles.headerActions}>
                {/* Location chip */}
                <TouchableOpacity
                  style={styles.locationChip}
                  onPress={() => router.push('/products' as any)}
                  activeOpacity={0.8}
                >
                  <MapPin size={12} color="#2563EB" />
                  <Text style={styles.locationChipText}>Cairo, EG</Text>
                </TouchableOpacity>

                {/* Language Switcher */}
                <TouchableOpacity
                  style={styles.langPill}
                  onPress={() => changeLanguage(language === 'en' ? 'ar' : 'en')}
                  activeOpacity={0.8}
                >
                  <Globe size={13} color="#475569" />
                  <Text style={styles.langPillText}>{language === 'en' ? 'عربي' : 'EN'}</Text>
                </TouchableOpacity>

                {/* Wishlist Shortcut */}
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => router.push('/(tabs)/explore' as any)}
                  activeOpacity={0.8}
                >
                  <Heart size={18} color="#334155" />
                  {wishlistIds.size > 0 && (
                    <View style={styles.headerBadge}>
                      <Text style={styles.headerBadgeText}>{wishlistIds.size}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Row 2: Omni Search Bar */}
            <View style={styles.searchBarRow}>
              <View style={styles.searchBar}>
                <Search color="#64748B" size={17} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('home.searchPlaceholder')}
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  onSubmitEditing={() => handleSearch()}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X color="#94A3B8" size={16} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => router.push('/products' as any)}
                activeOpacity={0.8}
              >
                <SlidersHorizontal size={18} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Row 3: Category Quick Rail */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRail}
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryRailItem}
                  onPress={() => handleCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.categoryRailText}>
                    {cat.emoji} {t(cat.nameKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Quick search chips dropdown (while focused) */}
            {searchFocused && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.quickRow}
                style={{ marginTop: 8 }}
              >
                {QUICK_SEARCHES.map(q => (
                  <TouchableOpacity key={q} style={styles.quickChip} onPress={() => handleSearch(q)}>
                    <Search color="#2563EB" size={11} />
                    <Text style={styles.quickChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ════════════════ TRUST & ASSURANCE STRIP ════════════════ */}
          <View style={styles.trustSection}>
            <View style={styles.trustCard}>
              <View style={[styles.trustIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <ShieldCheck color="#2563EB" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>{t('home.trustPill1Title')}</Text>
                <Text style={styles.trustSub}>{t('home.trustPill1Sub')}</Text>
              </View>
            </View>

            <View style={styles.trustCard}>
              <View style={[styles.trustIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Truck color="#059669" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>{t('home.trustPill2Title')}</Text>
                <Text style={styles.trustSub}>{t('home.trustPill2Sub')}</Text>
              </View>
            </View>

            <View style={styles.trustCard}>
              <View style={[styles.trustIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Tag color="#D97706" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>{t('home.trustPill3Title')}</Text>
                <Text style={styles.trustSub}>{t('home.trustPill3Sub')}</Text>
              </View>
            </View>
          </View>

          {/* ════════════════ FLASH DEALS LIVE STRIP ════════════════ */}
          <TouchableOpacity
            style={styles.flashStrip}
            activeOpacity={0.9}
            onPress={() => router.push('/products' as any)}
          >
            <LinearGradient
              colors={['#DC2626', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.flashGradient}
            >
              <View style={styles.flashLeft}>
                <Text style={styles.flashBadgeText}>{t('home.flashDeals')}</Text>
              </View>
              <View style={styles.flashRight}>
                <Clock color="white" size={14} />
                <Text style={styles.flashTimerText}>
                  {t('home.endsIn')} <Text style={styles.flashTimerDigits}>{countdown}</Text>
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ════════════════ DEAL BANNER CAROUSEL ════════════════ */}
          <View style={styles.bannerSection}>
            <ScrollView
              ref={bannerRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled={false}
              decelerationRate="fast"
              snapToInterval={bannerWidth + 12}
              snapToAlignment="start"
              contentContainerStyle={styles.bannerRow}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (bannerWidth + 12));
                setBannerIndex(idx);
              }}
            >
              {DEAL_BANNERS.map((banner) => (
                <TouchableOpacity
                  key={banner.key}
                  activeOpacity={0.9}
                  style={{ width: bannerWidth }}
                  onPress={() => {
                    if (banner.category === '__live__') {
                      router.push('/live' as any);
                    } else if (banner.category) {
                      router.push({ pathname: '/products', params: { category: banner.category } } as any);
                    } else {
                      router.push('/products' as any);
                    }
                  }}
                >
                  <LinearGradient
                    colors={banner.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0.8 }}
                    style={styles.bannerCard}
                  >
                    <Text style={styles.bannerEmoji}>{banner.emoji}</Text>
                    <View style={styles.bannerTextWrap}>
                      <Text style={styles.bannerTitle}>
                        {(banner as any).titleFallback ? (t(banner.titleKey) === banner.titleKey ? (banner as any).titleFallback : t(banner.titleKey)) : t(banner.titleKey)}
                      </Text>
                      <Text style={styles.bannerSub}>
                        {(banner as any).subFallback ? (t(banner.subKey) === banner.subKey ? (banner as any).subFallback : t(banner.subKey)) : t(banner.subKey)}
                      </Text>
                    </View>
                    <View style={[styles.bannerCta, banner.category === '__live__' && { backgroundColor: '#EF4444' }]}>
                      <Text style={styles.bannerCtaText}>{banner.category === '__live__' ? 'Live 🔴' : 'Shop →'}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Dots */}
            <View style={styles.bannerDots}>
              {DEAL_BANNERS.map((_, i) => (
                <View key={i} style={[styles.bannerDot, i === bannerIndex && styles.bannerDotActive]} />
              ))}
            </View>
          </View>

          {/* ════════════════ CATEGORIES ════════════════ */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.shopByCategory')}</Text>
            <TouchableOpacity onPress={() => router.push('/products' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.catGrid}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catGridCard,
                    {
                      backgroundColor: cat.bg,
                      borderColor: cat.color + '30',
                      flexBasis: width < 480 ? '22%' : width < 768 ? '23%' : '11%',
                    },
                  ]}
                  onPress={() => handleCategory(cat)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.catGridIconWrap, { backgroundColor: cat.color + '20' }]}>
                    <Icon color={cat.color} size={24} />
                  </View>
                  <Text style={[styles.catGridLabel, { color: cat.color }]} numberOfLines={1}>
                    {t(cat.nameKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ════════════════ EGYBAY LIVE STRIP ════════════════ */}
          <TouchableOpacity
            style={styles.liveStripCard}
            activeOpacity={0.88}
            onPress={() => router.push('/live' as any)}
          >
            <LinearGradient
              colors={['#0F172A', '#1E1B4B', '#450A0A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.liveStripGradient}
            >
              <View style={styles.liveStripLeft}>
                <View style={styles.liveStripPill}>
                  <View style={styles.liveStripDot} />
                  <Text style={styles.liveStripPillText}>LIVE</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveStripTitle}>بث مباشر لتجار ومحلات مصر 🔴</Text>
                  <Text style={styles.liveStripSub}>تسوق وشاهد المنتجات الحصرية مباشرة مع الضمان</Text>
                </View>
              </View>
              <View style={styles.liveStripBtn}>
                <Text style={styles.liveStripBtnText}>دخول البث ←</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ════════════════ TRENDING SEARCHES ════════════════ */}
          <View style={styles.sectionHeader}>
            <View style={styles.titleRow}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>{t('home.trendingSearches')}</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingSearchRow}
          >
            {TRENDING_SEARCHES.map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.trendingSearchChip}
                onPress={() => router.push({ pathname: '/products', params: { search: item.label } } as any)}
                activeOpacity={0.75}
              >
                <Text style={styles.trendingSearchEmoji}>{item.emoji}</Text>
                <Text style={styles.trendingSearchText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ════════════════ TRENDING NOW ════════════════ */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <View style={styles.titleRow}>
              <TrendingUp color="#EF4444" size={18} />
              <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>{t('home.trendingNow')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/products' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
              {[1, 2, 3, 4].map(i => <SkeletonTrendCard key={i} />)}
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
                    colors={['transparent', 'rgba(0,0,0,0.88)']}
                    style={styles.trendOverlay}
                  >
                    <Text style={styles.trendTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.trendPricePill}>
                      <Text style={styles.trendPriceText}>{formatEGP(item.price)}</Text>
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
              key={`grid-${numColumns}`}
              data={recentlyAdded}
              numColumns={numColumns}
              scrollEnabled={false}
              keyExtractor={item => 'recent-' + item.id}
              contentContainerStyle={styles.recentGrid}
              columnWrapperStyle={styles.recentRow}
              renderItem={({ item, index }) => (
                <Reanimated.View
                  entering={FadeInDown.duration(320).delay(Math.min(index, 8) * 60)}
                  style={{ flex: 1 }}
                >
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
                      {/* EGP price pill */}
                      <View style={styles.imgPricePill}>
                        <Text style={styles.imgPriceText}>{formatEGP(item.price)}</Text>
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

                      {/* Promoted / Urgent Ribbon Badge */}
                      {(() => {
                        const boost = getProductBoostInfo(item);
                        if (boost.isPromoted && boost.pkg) {
                          return (
                            <View style={[styles.cardPromotedBadge, { backgroundColor: boost.pkg.id === 'urgent' ? '#F59E0B' : '#2563EB' }]}>
                              <Text style={styles.cardPromotedBadgeText}>{boost.pkg.badgeEmoji} {boost.pkg.id.toUpperCase()}</Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                    {/* Card body */}
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                      
                      {/* Rating & Condition Strip */}
                      <View style={styles.cardRatingRow}>
                        <View style={styles.ratingPill}>
                          <Star color="#F59E0B" fill="#F59E0B" size={11} />
                          <Text style={styles.ratingText}>4.9</Text>
                        </View>
                        <Text style={styles.conditionTag}>{item.condition || 'Used'}</Text>
                      </View>

                      <View style={styles.cardMeta}>
                        <Text style={styles.cardSeller} numberOfLines={1}>
                          {item.seller?.full_name ?? 'Seller'}
                        </Text>
                        {item.location ? (
                          <Text style={styles.cardLocation} numberOfLines={1}>
                            <MapPin size={10} color="#64748B" /> {item.location}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Reanimated.View>
              )}
            />
          )}

          <View style={{ height: 40 }} />
        </View>
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
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
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

  pageWrapper: {
    width: '100%',
    alignSelf: 'center',
  },

  // Flagship Top Bar
  flagshipHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  headerIconBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', height: 44 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryRail: {
    gap: 8,
    paddingRight: 8,
    paddingVertical: 2,
  },
  categoryRailItem: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryRailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  quickRow: { gap: 8, paddingVertical: 6 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickChipText: { color: '#2563EB', fontSize: 12, fontWeight: '600' },

  // Trust Strip
  trustSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  trustCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  trustIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustTitle: { fontSize: 11, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  trustSub: { fontSize: 9, color: '#64748B', fontWeight: '500' },

  // Flash Deals Strip
  flashStrip: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  flashGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  flashLeft: { flexDirection: 'row', alignItems: 'center' },
  flashBadgeText: { color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  flashRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  flashTimerText: { color: 'white', fontSize: 11, fontWeight: '600' },
  flashTimerDigits: { fontWeight: '900', color: '#FEF08A' },

  // Deal banner
  bannerSection: { marginTop: 16, paddingHorizontal: 16 },
  bannerRow: { gap: 12, paddingRight: 16 },
  bannerCard: {
    height: 110,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
    overflow: 'hidden',
  },
  bannerEmoji: { fontSize: 36 },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: 'white', marginBottom: 4 },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17 },
  bannerCta: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  bannerCtaText: { color: 'white', fontSize: 13, fontWeight: '700' },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  bannerDotActive: { width: 18, backgroundColor: '#2563EB' },

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

  // Category grid (responsive flex basis)
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  catGridCard: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 8,
    flexGrow: 1,
  },
  catGridIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catGridLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

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
  trendPriceText: { color: 'white', fontSize: 11, fontWeight: '800' },
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
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
  imgPriceText: { color: 'white', fontSize: 11, fontWeight: '800' },
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
  cardPromotedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  cardPromotedBadgeText: { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 4, lineHeight: 18 },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  conditionTag: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  cardMeta: { gap: 2, marginTop: 4 },
  cardSeller: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  cardLocation: { fontSize: 10, color: '#64748B', fontWeight: '600' },

  // Empty
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Trending searches
  trendingSearchRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  trendingSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  trendingSearchEmoji: { fontSize: 13 },
  trendingSearchText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },

  // Live Strip
  liveStripCard: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  liveStripGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  liveStripLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveStripPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveStripDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
  },
  liveStripPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  liveStripTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: 'white',
  },
  liveStripSub: {
    fontSize: 10,
    color: '#CBD5E1',
    marginTop: 1,
  },
  liveStripBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  liveStripBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'white',
  },
});