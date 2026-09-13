import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowUpRight, Bell, Package, Plus, Search, ShieldCheck, Truck, Video, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
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
import { ProductCard, formatEGP } from '../../src/components/ProductCard';
import { color, font, radius, space, weight } from '../../src/design/tokens';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { displayName } from '../../src/services/lib/displayName';
import { getUnreadNotificationCount } from '../../src/services/lib/notificationService';
import { productService, type Product } from '../../src/services/lib/products';
import { getUserOrders, type MarketplaceOrder } from '../../src/services/lib/orderService';
import { getActiveLiveSessions, isGenuinelyLive, type LiveSession } from '../../src/services/lib/liveService';
import { useAuth } from '../../hooks/useAuth';
import { PAYMENTS_ENABLED } from '../../src/services/lib/platformCommerce';

/**
 * Home, rebuilt around the product instead of around the marketplace.
 *
 * The previous screen stacked five bands of chrome before the first listing:
 * logo bar, search bar, category chips, a Live row, a trust strip, and a promo
 * carousel with a fake countdown. All of it was *about* Egbay; none of it was
 * *from* Egbay. A first-time visitor scrolled through a pitch to reach the
 * inventory.
 *
 * Now the best listing is the page. The escrow promise is written on the
 * hero, where it is attached to a thing you might buy, rather than in a strip
 * above everything. Categories are photo tiles you browse by looking.
 * Search collapses to an icon until asked for. The feed is a two-lane
 * masonry with the "sell" invitation folded in as a card among the listings.
 */

const CATEGORY_LABEL_AR: Record<string, string> = {
  Electronics: 'إلكترونيات', Fashion: 'أزياء', Home: 'منزل', Toys: 'ألعاب',
  Sports: 'رياضة', Books: 'كتب', Automotive: 'سيارات', Beauty: 'تجميل', General: 'عام',
};

export default function HomeScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [liveNow, setLiveNow] = useState<LiveSession | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    try {
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

  const loadUnread = useCallback(async () => {
    try { setUnreadCount(await getUnreadNotificationCount()); } catch { setUnreadCount(0); }
  }, []);

  // What the hero shows depends on the viewer's state, so the home loads the
  // two things that can change it: their orders, and whether anyone is live.
  const loadContext = useCallback(async () => {
    // Classifieds mode: no orders and no live sessions exist right now, so
    // don't even fetch (see PLAN-CLASSIFIEDS-MODE.md).
    if (!PAYMENTS_ENABLED) { setOrders([]); setLiveNow(null); return; }
    try {
      const [o, l] = await Promise.all([
        user ? getUserOrders(user.id) : Promise.resolve([]),
        getActiveLiveSessions().catch(() => [] as LiveSession[]),
      ]);
      setOrders(o);
      setLiveNow(l.find(isGenuinelyLive) ?? null);
    } catch {
      setOrders([]); setLiveNow(null);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadProducts(); loadUnread(); loadContext(); }, [loadProducts, loadUnread, loadContext]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  const toggleWishlist = async (product: Product) => {
    const was = wishlistIds.has(product.id);
    setWishlistIds(prev => { const n = new Set(prev); was ? n.delete(product.id) : n.add(product.id); return n; });
    try {
      was ? await productService.removeFromWishlist(product.id) : await productService.addToWishlist(product.id);
    } catch {
      setWishlistIds(prev => { const n = new Set(prev); was ? n.add(product.id) : n.delete(product.id); return n; });
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  /**
   * The hero shows the most important thing for this viewer right now, in
   * priority order -- not simply whatever was uploaded last:
   *   1. a stream that is genuinely live
   *   2. an order of theirs on its way (buyer side)
   *   3. a sale of theirs waiting to be shipped (seller side)
   *   4. otherwise, the newest listings with photographs, swipeable
   * That is what the top of a marketplace is for: Uber shows your ride,
   * Amazon shows your delivery. Nothing matters more to a buyer than where
   * their money went, and nothing matters more to supply than a seller
   * learning they are holding someone up.
   */
  const incoming = useMemo(() =>
    user ? orders.find(o => o.buyer_id === user.id && (o.status === 'shipped' || o.status === 'out_for_delivery')) : undefined,
  [orders, user]);
  const toShip = useMemo(() =>
    user ? orders.find(o => o.seller_id === user.id && o.status === 'escrow_secured') : undefined,
  [orders, user]);
  const heroListings = useMemo(() => products.filter(p => p.images?.[0]).slice(0, 3), [products]);
  const hero = heroListings[0];
  const heroW = Math.min(width, 520);

  // Categories come from live stock: a tile per category, using that
  // category's newest photo as its cover, with a real count. Empties never
  // appear because there is nothing to make a tile from.
  const categories = useMemo(() => {
    const m = new Map<string, { cover?: string; n: number }>();
    for (const p of products) {
      const c = (p as any).category as string | undefined;
      if (!c) continue;
      const cur = m.get(c) ?? { n: 0 };
      cur.n += 1;
      if (!cur.cover && p.images?.[0]) cur.cover = p.images[0];
      m.set(c, cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n);
  }, [products]);

  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(p => p.id !== hero?.id)
      .filter(p => !category || (p as any).category === category)
      .filter(p => !q || p.title.toLowerCase().includes(q));
  }, [products, hero, category, query]);

  // Two masonry lanes balanced by estimated height; every third card is tall.
  const lanes = useMemo(() => {
    const L: { item: Product; tall: boolean }[][] = [[], []];
    const h = [0, 0];
    feed.forEach((item, i) => {
      const tall = i % 3 === 0;
      const k = h[0] <= h[1] ? 0 : 1;
      L[k].push({ item, tall });
      h[k] += tall ? 1.3 : 1;
    });
    return L;
  }, [feed]);

  const laneWidth = (Math.min(width, 520) - space.lg * 2 - 14) / 2;
  const tileLabel = (name: string) => (isArabic ? CATEGORY_LABEL_AR[name] ?? name : name);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.text} />}
      >
        {/* ── Top bar, floating over the hero ── */}
        <View style={[s.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={s.wordmark}>
            <Text style={[s.wm, { color: '#2563EB' }]}>e</Text><Text style={[s.wm, { color: '#EF4444' }]}>g</Text>
            <Text style={[s.wm, { color: '#F59E0B' }]}>b</Text><Text style={[s.wm, { color: '#10B981' }]}>a</Text><Text style={[s.wm, { color: '#2563EB' }]}>y</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setSearchOpen(true)} accessibilityLabel="Search" hitSlop={4}>
              <Search size={20} color={color.text} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/notifications' as any)} accessibilityLabel="Notifications" hitSlop={4}>
              <Bell size={20} color={color.text} />
              {unreadCount > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero: the most important thing right now ── */}
        {liveNow ? (
          <TouchableOpacity activeOpacity={0.95} onPress={() => router.push(`/live/${liveNow.agora_channel}` as any)} style={[s.hero, s.heroDark, { height: heroW * 1.05 }]}>
            {!!liveNow.thumbnail_url && <Image source={{ uri: liveNow.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']} locations={[0.3, 0.6, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.heroBody}>
              <View style={s.livePill}><View style={s.liveDot} /><Text style={s.livePillText}>{isArabic ? 'مباشر الآن' : 'LIVE NOW'}</Text></View>
              <Text style={s.heroTitle} numberOfLines={2}>{isArabic ? liveNow.title_ar || liveNow.title : liveNow.title}</Text>
              <View style={s.heroRow}>
                <Text style={[s.heroMeta, { flex: 1 }]} numberOfLines={1}>
                  {displayName(liveNow.seller?.full_name, 'Seller')} · {liveNow.current_viewers} {isArabic ? 'يشاهدون' : 'watching'}
                </Text>
                <View style={s.heroArrow}><Video size={22} color={color.text} /></View>
              </View>
            </View>
          </TouchableOpacity>
        ) : incoming ? (
          <TouchableOpacity activeOpacity={0.95} onPress={() => router.push(`/order/${incoming.id}` as any)} style={[s.hero, s.heroDark, { height: heroW * 0.9 }]}>
            {!!(incoming.product?.images?.[0]) && <Image source={{ uri: incoming.product!.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.heroBody}>
              <View style={s.statusPill}><Truck size={13} color={color.text} /><Text style={s.statusPillText}>{isArabic ? 'في الطريق إليك' : 'ON ITS WAY'}</Text></View>
              <Text style={s.heroTitle} numberOfLines={2}>{incoming.product?.title || (isArabic ? 'طلبك' : 'Your order')}</Text>
              <View style={s.rail}>
                {[1, 2, 3, 4].map(i => <View key={i} style={[s.seg, (incoming.status === 'out_for_delivery' ? 3 : 2) >= i && s.segDone]} />)}
              </View>
              <View style={s.heroRow}>
                <Text style={[s.heroMeta, { flex: 1 }]} numberOfLines={1}>
                  {incoming.status === 'out_for_delivery'
                    ? (isArabic ? 'خرج للتوصيل اليوم — أموالك في الضمان حتى تفحصه' : 'Out for delivery today — your money stays in escrow until you inspect')
                    : (isArabic ? 'تم الشحن — سنخبرك عند الوصول' : 'Shipped — we will tell you when it arrives')}
                </Text>
                <View style={s.heroArrow}><ArrowUpRight size={22} color={color.text} /></View>
              </View>
            </View>
          </TouchableOpacity>
        ) : toShip ? (
          <TouchableOpacity activeOpacity={0.95} onPress={() => router.push(`/order/${toShip.id}` as any)} style={[s.hero, { height: heroW * 0.72, backgroundColor: color.ink, justifyContent: 'flex-end' }]}>
            <View style={s.heroBody}>
              <View style={s.statusPill}><Package size={13} color={color.text} /><Text style={s.statusPillText}>{isArabic ? 'لديك بيع' : 'YOU MADE A SALE'}</Text></View>
              <Text style={s.heroTitle} numberOfLines={2}>{toShip.product?.title || (isArabic ? 'طلب جديد' : 'New order')}</Text>
              <View style={s.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroPrice}>{formatEGP(toShip.amount)}</Text>
                  <Text style={s.heroMeta} numberOfLines={2}>
                    {isArabic ? 'المبلغ محفوظ في الضمان. اشحن الآن ليصلك بعد التأكيد.' : 'Paid and held in escrow. Ship it now to get paid on confirmation.'}
                  </Text>
                </View>
                <View style={s.heroArrow}><ArrowUpRight size={22} color={color.text} /></View>
              </View>
            </View>
          </TouchableOpacity>
        ) : heroListings.length > 0 ? (
          <View>
            <ScrollView
              ref={heroRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / heroW))}
            >
              {heroListings.map((item, i) => (
                <TouchableOpacity key={item.id} activeOpacity={0.95} onPress={() => router.push(`/products/${item.id}` as any)} style={[s.hero, { width: heroW, height: heroW * 1.25 }]}>
                  <Image source={{ uri: item.images![0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)']} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />
                  <View style={s.heroBody}>
                    <Text style={s.heroKicker}>
                      {i === 0 ? (isArabic ? 'أُضيف حديثاً' : 'Just listed') : (isArabic ? 'جديد' : 'New')} · {tileLabel((item as any).category ?? '')}
                    </Text>
                    <Text style={s.heroTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={s.heroRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.heroPrice}>{formatEGP(item.price)}</Text>
                        <Text style={s.heroMeta} numberOfLines={1}>
                          {displayName(item.seller?.full_name, 'Seller')}
                          {PAYMENTS_ENABLED
                            ? ` · ${isArabic ? 'محفوظ في الضمان حتى الفحص' : 'held in escrow until you inspect'}`
                            : ` · ${isArabic ? 'راسل البائع للتفاصيل' : 'message the seller for details'}`}
                        </Text>
                      </View>
                      <View style={s.heroArrow}><ArrowUpRight size={22} color={color.text} /></View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {heroListings.length > 1 && (
              <View style={s.dots}>
                {heroListings.map((_, i) => <View key={i} style={[s.dot, heroIndex === i && s.dotOn]} />)}
              </View>
            )}
          </View>
        ) : (
          <View style={{ height: insets.top + 64 }} />
        )}

        {/* ── Categories as photo tiles ── */}
        {categories.length > 0 && (
          <View style={{ paddingTop: space.xl }}>
            <View style={s.sectionHead}>
              <Text style={s.h2}>{isArabic ? 'تصفّح' : 'Browse'}</Text>
              {!!category && (
                <TouchableOpacity onPress={() => setCategory(null)} style={s.clear} hitSlop={8}>
                  <X size={14} color={color.textMuted} />
                  <Text style={s.clearText}>{isArabic ? 'مسح' : 'Clear'}</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
              {categories.map(c => {
                const on = category === c.name;
                return (
                  <TouchableOpacity key={c.name} onPress={() => setCategory(on ? null : c.name)} activeOpacity={0.85} style={s.tile}>
                    <View style={[s.tileImgWrap, on && s.tileImgWrapOn]}>
                      {c.cover
                        ? <Image source={{ uri: c.cover }} style={s.tileImg} resizeMode="cover" />
                        : <View style={[s.tileImg, { backgroundColor: color.surfaceAlt }]} />}
                    </View>
                    <Text style={[s.tileName, on && { color: color.text }]} numberOfLines={1}>{tileLabel(c.name)}</Text>
                    <Text style={s.tileCount}>{c.n} {isArabic ? 'عنصر' : c.n === 1 ? 'item' : 'items'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Masonry feed ── */}
        <View style={{ paddingTop: space.xxl, paddingHorizontal: space.lg }}>
          <View style={[s.sectionHead, { paddingHorizontal: 0 }]}>
            <Text style={s.h2}>
              {category ? tileLabel(category) : isArabic ? 'كل المعروض' : 'Everything'}
              <Text style={s.h2Count}>  {feed.length}</Text>
            </Text>
          </View>

          {loading ? (
            <View style={s.lanes}>
              {[0, 1].map(l => (
                <View key={l} style={{ width: laneWidth, gap: 20 }}>
                  {[0, 1, 2].map(i => <View key={i} style={{ height: (i + l) % 2 ? 220 : 180, borderRadius: radius.lg, backgroundColor: color.surfaceAlt }} />)}
                </View>
              ))}
            </View>
          ) : feed.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{isArabic ? 'لا يوجد شيء هنا بعد' : 'Nothing here yet'}</Text>
              <Text style={s.emptySub}>{isArabic ? 'جرّب فئة أخرى.' : 'Try another category.'}</Text>
            </View>
          ) : (
            <View style={s.lanes}>
              {lanes.map((lane, li) => (
                <View key={li} style={{ width: laneWidth, gap: 20 }}>
                  {lane.map(({ item, tall }, idx) => (
                    <React.Fragment key={item.id}>
                      <ProductCard
                        item={item}
                        width={laneWidth}
                        imageHeight={tall ? laneWidth * 1.33 : laneWidth}
                        showEscrow={PAYMENTS_ENABLED}
                        isWishlisted={wishlistIds.has(item.id)}
                        onPress={() => router.push(`/products/${item.id}` as any)}
                        onToggleWishlist={() => toggleWishlist(item)}
                      />
                      {/* "Sell" is a card in the feed, where a scrolling seller
                          will actually see it -- not a banner above it. */}
                      {li === 1 && idx === 0 && (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(tabs)/sell' as any)} style={[s.sellCard, { width: laneWidth, height: laneWidth }]}>
                          <Plus size={28} color={color.textInverse} />
                          <View>
                            <Text style={s.sellTitle}>{isArabic ? 'بِع شيئاً اليوم' : 'Sell something today'}</Text>
                            <Text style={s.sellSub}>
                              {PAYMENTS_ENABLED
                                ? (isArabic ? 'المشتري يدفع قبل الشحن. عمولة ٣.٥٪' : 'Buyer pays before you ship. 3.5% fee.')
                                : (isArabic ? 'أضف صوراً وسعراً، والمشترون يراسلونك مباشرة' : 'Add photos and a price -- buyers message you directly')}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Search sheet ── */}
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
          <View style={s.searchRow}>
            <View style={s.searchField}>
              <Search size={20} color={color.textFaint} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={isArabic ? 'ابحث في إيجي باي' : 'Search Egbay'}
                placeholderTextColor={color.textFaint}
                style={s.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => setSearchOpen(false)}
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={color.textFaint} /></TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => { setSearchOpen(false); setQuery(''); }} style={s.cancel}>
              <Text style={s.cancelText}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.browseLabel}>{isArabic ? 'تصفّح' : 'BROWSE'}</Text>
          <View style={s.chipWrap}>
            {categories.map(c => (
              <TouchableOpacity key={c.name} style={s.chip} onPress={() => { setCategory(c.name); setSearchOpen(false); }}>
                <Text style={s.chipText}>{tileLabel(c.name)} <Text style={s.chipCount}>{c.n}</Text></Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.searchEscrow}>
            <ShieldCheck size={16} color={color.successDark} />
            <Text style={s.searchEscrowText}>
              {PAYMENTS_ENABLED
                ? (isArabic ? 'كل عملية شراء محفوظة في الضمان حتى تفحص المنتج.' : 'Every purchase is held in escrow until you inspect the item.')
                : (isArabic ? 'راسل البائع، اتفقا على السعر، والتقيا بأمان.' : 'Chat with the seller, agree on a price, meet safely.')}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.surface },

  topBar: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.92)', flexDirection: 'row', alignItems: 'center' },
  wm: { fontSize: 22, fontWeight: weight.heavy, letterSpacing: -1.3, lineHeight: 26 },
  iconBtn: { height: 40, width: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: color.textInverse, fontSize: font.caption2, fontWeight: weight.heavy },

  hero: { width: '100%', backgroundColor: color.surfaceAlt, justifyContent: 'flex-end' },
  heroBody: { padding: space.xl, paddingBottom: space.xxl },
  heroKicker: { color: 'rgba(255,255,255,0.7)', fontSize: font.caption, fontWeight: weight.bold, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: color.textInverse, fontSize: font.largeTitle, fontWeight: weight.heavy, letterSpacing: -1.4, lineHeight: 37, marginTop: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 12 },
  heroPrice: { color: color.textInverse, fontSize: font.title1, fontWeight: weight.heavy, letterSpacing: -1.1, lineHeight: 32 },
  heroMeta: { color: 'rgba(255,255,255,0.7)', fontSize: font.caption, marginTop: 4 },
  heroArrow: { height: 48, width: 48, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  heroDark: { backgroundColor: color.ink },
  livePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: color.danger, marginBottom: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.textInverse },
  livePillText: { color: color.textInverse, fontSize: font.caption2, fontWeight: weight.black, letterSpacing: 1 },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: color.surface, marginBottom: 8 },
  statusPillText: { color: color.text, fontSize: font.caption2, fontWeight: weight.black, letterSpacing: 1 },
  rail: { flexDirection: 'row', gap: 5, marginTop: 12, marginBottom: 4 },
  seg: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.25)' },
  segDone: { backgroundColor: color.textInverse },
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 20, backgroundColor: color.textInverse },

  sectionHead: { paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.md },
  h2: { fontSize: font.title3, fontWeight: weight.heavy, color: color.text, letterSpacing: -0.6 },
  h2Count: { fontSize: font.subhead, fontWeight: weight.bold, color: color.textFaint },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearText: { fontSize: font.footnote, fontWeight: weight.bold, color: color.textMuted },

  tileRow: { paddingHorizontal: space.lg, gap: 12 },
  tile: { width: 108 },
  tileImgWrap: { aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: color.surfaceAlt, borderWidth: 2, borderColor: 'transparent' },
  tileImgWrapOn: { borderColor: color.text },
  tileImg: { width: '100%', height: '100%' },
  tileName: { marginTop: 8, fontSize: font.subhead - 1, fontWeight: weight.bold, color: color.textSecondary },
  tileCount: { fontSize: font.caption, fontWeight: weight.semibold, color: color.textFaint },

  lanes: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  sellCard: { borderRadius: 22, backgroundColor: color.ink, padding: space.lg, justifyContent: 'space-between' },
  sellTitle: { color: color.textInverse, fontSize: font.headline, fontWeight: weight.heavy, letterSpacing: -0.4, lineHeight: 21 },
  sellSub: { color: 'rgba(255,255,255,0.65)', fontSize: font.caption, marginTop: 4, lineHeight: 16 },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: font.subhead, fontWeight: weight.bold, color: color.textSecondary },
  emptySub: { fontSize: font.footnote, color: color.textMuted, marginTop: 4 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg, paddingTop: space.md },
  searchField: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: color.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderWidth: 2, borderColor: color.text },
  searchInput: { flex: 1, fontSize: font.callout, color: color.text, paddingVertical: 0 },
  cancel: { height: 48, paddingHorizontal: 8, justifyContent: 'center' },
  cancelText: { fontSize: font.subhead, fontWeight: weight.bold, color: color.text },
  browseLabel: { paddingHorizontal: space.lg, marginTop: space.xxl, marginBottom: space.md, fontSize: font.caption, fontWeight: weight.bold, color: color.textFaint, letterSpacing: 1 },
  chipWrap: { paddingHorizontal: space.lg, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: color.surfaceAlt, justifyContent: 'center' },
  chipText: { fontSize: font.subhead - 1, fontWeight: weight.bold, color: color.text },
  chipCount: { color: color.textFaint },
  searchEscrow: { marginHorizontal: space.lg, marginTop: space.xxxl, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: radius.lg, backgroundColor: color.successSoft },
  searchEscrowText: { flex: 1, fontSize: font.footnote, fontWeight: weight.semibold, color: '#065F46', lineHeight: 18 },
});
