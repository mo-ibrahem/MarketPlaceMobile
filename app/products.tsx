import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productService, type Product } from '../src/services/lib/products';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'newest' | 'price_asc' | 'price_desc';
type ConditionFilter = 'New' | 'Used';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price ↑' },
  { key: 'price_desc', label: 'Price ↓' },
];

// ─── Products Screen ──────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const router = useRouter();
  const { category, search } = useLocalSearchParams<{ category?: string; search?: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [searchText, setSearchText] = useState(search ?? '');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [conditions, setConditions] = useState<Set<ConditionFilter>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  // Price range
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceOpen, setPriceOpen] = useState(false);
  const [appliedMin, setAppliedMin] = useState('');
  const [appliedMax, setAppliedMax] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productService.getProducts({ category, search });
      const list = data || [];
      setProducts(list);
      setWishlistIds(new Set(list.filter(p => p.isWishlisted).map(p => p.id)));
    } catch (e) {
      console.error('[Products] fetch failed', e);
    }
  }, [category, search]);

  useEffect(() => {
    setLoading(true);
    fetchProducts().finally(() => setLoading(false));
  }, [fetchProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  // ── Client-side filter + sort ─────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }

    if (conditions.size > 0) {
      list = list.filter(p => conditions.has(p.condition as ConditionFilter));
    }

    // Price range
    if (appliedMin !== '') list = list.filter(p => Number(p.price) >= Number(appliedMin));
    if (appliedMax !== '') list = list.filter(p => Number(p.price) <= Number(appliedMax));

    if (sortBy === 'price_asc') list.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === 'price_desc') list.sort((a, b) => Number(b.price) - Number(a.price));

    return list;
  }, [products, searchText, conditions, sortBy, appliedMin, appliedMax]);

  const hasFilters =
    conditions.size > 0 ||
    sortBy !== 'newest' ||
    appliedMin !== '' ||
    appliedMax !== '' ||
    searchText !== (search ?? '');

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleCondition = (c: ConditionFilter) => {
    setConditions(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchText(search ?? '');
    setSortBy('newest');
    setConditions(new Set());
    setMinPrice('');
    setMaxPrice('');
    setAppliedMin('');
    setAppliedMax('');
    setPriceOpen(false);
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

  // ── Render ────────────────────────────────────────────────────────────────

  const navTitle = category ? category : search ? 'Search Results' : 'All Products';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: navTitle }} />

      {/*
       * ── FIXED HEADER (search + filters + count) ──────────────────────────
       * Wrapped in a plain View with no flex so it always takes its natural
       * height and is never squeezed by the list below.
       */}
      <View>
        {/* Search bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search color="#9CA3AF" size={16} />
            <TextInput
              style={styles.searchInput}
              placeholder={category ? `Search in ${category}…` : 'Search products…'}
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color="#9CA3AF" size={14} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chip strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {SORT_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.key}
              style={[styles.chip, sortBy === o.key && styles.chipActive]}
              onPress={() => setSortBy(o.key)}
            >
              <Text style={[styles.chipText, sortBy === o.key && styles.chipTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.chipDivider} />

          {/* Condition */}
          {(['New', 'Used'] as ConditionFilter[]).map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, conditions.has(c) && styles.chipActive]}
              onPress={() => toggleCondition(c)}
            >
              <Text style={[styles.chipText, conditions.has(c) && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}

          {/* Price filter chip */}
          <TouchableOpacity
            style={[styles.chip, (priceOpen || appliedMin || appliedMax) ? styles.chipActive : undefined]}
            onPress={() => setPriceOpen(v => !v)}
          >
            <Text style={[styles.chipText, (priceOpen || appliedMin || appliedMax) ? styles.chipTextActive : undefined]}>
              {appliedMin || appliedMax
                ? `$${appliedMin || '0'} – $${appliedMax || '∞'}`
                : 'Price'}
            </Text>
          </TouchableOpacity>

          {/* Clear all */}
          {hasFilters && (
            <TouchableOpacity style={styles.clearChip} onPress={clearFilters}>
              <X color="#EF4444" size={11} />
              <Text style={styles.clearChipText}>Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Price range panel */}
        {priceOpen && (
          <View style={styles.pricePanel}>
            <View style={styles.priceInputRow}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceInputLabel}>Min $</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
              </View>
              <View style={styles.priceDash} />
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceInputLabel}>Max $</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Any"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>
              <TouchableOpacity
                style={styles.priceApplyBtn}
                onPress={() => { setAppliedMin(minPrice); setAppliedMax(maxPrice); setPriceOpen(false); }}
              >
                <Text style={styles.priceApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Result count */}
        {!loading && (
          <Text style={styles.resultCount}>
            {filteredProducts.length}{' '}
            {filteredProducts.length === 1 ? 'item' : 'items'} found
          </Text>
        )}
      </View>

      {/*
       * ── LIST AREA ──────────────────────────────────────────────────────────
       * flex: 1 ensures this takes ALL remaining height after the header View
       * above. Without this, FlatList tries to size itself to its full content
       * which can push the header off screen on Android.
       */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <SkeletonGrid />
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
            }
            renderItem={({ item }) => (
              <ProductCard
                item={item}
                isWishlisted={wishlistIds.has(item.id)}
                onPress={() => router.push(`/products/${item.id}` as any)}
                onToggleWishlist={() => toggleWishlist(item)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  item,
  isWishlisted,
  onPress,
  onToggleWishlist,
}: {
  item: Product;
  isWishlisted: boolean;
  onPress: () => void;
  onToggleWishlist: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardImgWrapper}>
        <Image
          source={{
            uri: item.images?.[0] || 'https://placehold.co/400x300/F1F5F9/64748B?text=Item',
          }}
          style={styles.cardImg}
        />

        <View style={styles.cardPricePill}>
          <Text style={styles.cardPriceText}>${Number(item.price).toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.cardHeart} onPress={onToggleWishlist}>
          <Heart
            size={14}
            color={isWishlisted ? '#EF4444' : 'white'}
            fill={isWishlisted ? '#EF4444' : 'none'}
          />
        </TouchableOpacity>

        {item.condition === 'New' && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.sellerRow}>
          <View style={styles.sellerAvatar}>
            <Text style={styles.sellerInitial}>
              {(item.seller?.full_name ?? 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.sellerName} numberOfLines={1}>
            {item.seller?.full_name ?? 'Seller'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={[styles.card, { flex: 1 }]}>
      <Animated.View
        style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E2E8F0', opacity }}
      />
      <View style={{ padding: 10, gap: 8 }}>
        <Animated.View
          style={{ height: 13, backgroundColor: '#E2E8F0', borderRadius: 6, width: '88%', opacity }}
        />
        <Animated.View
          style={{ height: 11, backgroundColor: '#E2E8F0', borderRadius: 6, width: '55%', opacity }}
        />
      </View>
    </View>
  );
}

function SkeletonGrid() {
  return (
    <View style={{ padding: 12 }}>
      {[[0, 1], [2, 3], [4, 5]].map((pair, i) => (
        <View key={i} style={[styles.columnWrapper, { marginBottom: 12 }]}>
          {pair.map(k => <SkeletonCard key={k} />)}
        </View>
      ))}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{hasFilters ? '🔍' : '📦'}</Text>
      <Text style={styles.emptyTitle}>No products found</Text>
      <Text style={styles.emptySubtitle}>
        {hasFilters
          ? 'Try adjusting your search or clearing the filters.'
          : 'There are no listings here yet. Check back soon!'}
      </Text>
      {hasFilters && (
        <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
          <Text style={styles.clearBtnText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', height: 46 },

  // Filter strip
  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 2,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },
  chipDivider: { width: 1, height: 22, backgroundColor: '#E2E8F0', marginHorizontal: 2 },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  clearChipText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },

  // Result count
  resultCount: {
    fontSize: 12,
    color: '#94A3B8',
    paddingHorizontal: 20,
    marginBottom: 4,
    fontWeight: '600',
  },

  // Grid
  listContent: { padding: 12 },
  columnWrapper: { gap: 12 },

  // Card
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  cardImgWrapper: { position: 'relative' },
  cardImg: { width: '100%', aspectRatio: 4 / 3 },
  cardPricePill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardPriceText: { color: 'white', fontSize: 12, fontWeight: '800' },
  cardHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
    lineHeight: 18,
    minHeight: 36,
  },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerInitial: { fontSize: 10, fontWeight: '800', color: '#6366F1' },
  sellerName: { fontSize: 11, color: '#94A3B8', fontWeight: '500', flex: 1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  clearBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  clearBtnText: { color: '#2563EB', fontSize: 15, fontWeight: '800' },

  // Price range panel
  pricePanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInputWrap: { flex: 1 },
  priceInputLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 5, letterSpacing: 0.4 },
  priceInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  priceDash: { width: 12, height: 2, backgroundColor: '#CBD5E1', borderRadius: 1, marginTop: 18 },
  priceApplyBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 18,
  },
  priceApplyText: { color: 'white', fontSize: 13, fontWeight: '800' },
});