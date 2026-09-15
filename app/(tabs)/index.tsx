import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, MessageCircle, Plus, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { FeaturedProductCard, ProductCard, formatEGP } from '../../src/components/ProductCard';
import { categoryHues, color, font, radius, space, weight } from '../../src/design/tokens';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { getUnreadNotificationCount } from '../../src/services/lib/notificationService';
import { productService, type Product } from '../../src/services/lib/products';
import { getActiveLiveSessions, isGenuinelyLive, type LiveSession } from '../../src/services/lib/liveService';
import { getRecentReplies, type RecentReply } from '../../src/services/lib/homeActivity';
import { getAskCounts, getSellerReplyBadge } from '../../src/services/lib/reputationStats';
import { getOrCreateChatRoom, sendMessage } from '../../src/services/lib/chatService';
import { useAuth } from '../../hooks/useAuth';
import { LIVE_ENABLED } from '../../src/services/lib/platformCommerce';

/**
 * Home -- approved build (Claude Design project "Mobile app design brief",
 * Egbay Approved Build.dc.html, screens 7a/7b).
 *
 * The header is one of two real states, not a mood: if someone replied to
 * you recently it leads with that (up to two real messages, not staged
 * copy); otherwise it's the quiet state -- what's on the app right now and
 * an invitation to ask. Selling moved out of the tab bar into this header's
 * pill and a card folded into the feed; the tab bar is four flat tabs.
 *
 * One adaptation from the mockup, deliberately: the mockup shows exact
 * distances ("2.1 KM") and a district name in the header. This app has no
 * location data at all -- no GPS permission, no lat/lng on a listing, no
 * governorate on most profiles -- and inventing a plausible-looking number
 * would be exactly the kind of fabricated activity this project's rules
 * forbid. Distance is dropped; the district chip only renders when the
 * viewer's own profile actually has one.
 */

const CATEGORY_LABEL_AR: Record<string, string> = {
  Electronics: 'إلكترونيات', Fashion: 'أزياء', Home: 'منزل', Toys: 'ألعاب',
  Sports: 'رياضة', Books: 'كتب', Automotive: 'سيارات', Beauty: 'تجميل', General: 'عام',
};

function timeAgo(iso: string, isArabic: boolean): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return isArabic ? `منذ ${min} د` : `${min}M`;
  const hr = Math.round(min / 60);
  if (hr < 24) return isArabic ? `منذ ${hr} س` : `${hr}H`;
  return isArabic ? `منذ ${Math.round(hr / 24)} ي` : `${Math.round(hr / 24)}D`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveNow, setLiveNow] = useState<LiveSession | null>(null);
  const [replies, setReplies] = useState<RecentReply[]>([]);
  const [askCounts, setAskCounts] = useState<Record<string, number>>({});
  const [sortByAsked, setSortByAsked] = useState(false);
  const [leadReplyBadge, setLeadReplyBadge] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    try {
      const data = await productService.getProducts();
      const list = data || [];
      setProducts(list);
      setWishlistIds(new Set(list.filter(p => p.isWishlisted).map(p => p.id)));
      getAskCounts(list.slice(0, 40).map(p => p.id)).then(setAskCounts).catch(() => {});
    } catch (e) {
      console.error('[Home] failed to load products', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContext = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([
        LIVE_ENABLED ? getActiveLiveSessions().catch(() => [] as LiveSession[]) : Promise.resolve([] as LiveSession[]),
        user ? getRecentReplies(2).catch(() => [] as RecentReply[]) : Promise.resolve([] as RecentReply[]),
      ]);
      setLiveNow(l.find(isGenuinelyLive) ?? null);
      setReplies(r);
    } catch {
      setLiveNow(null); setReplies([]);
    }
  }, [user]);

  const loadUnread = useCallback(async () => {
    try { setUnreadCount(await getUnreadNotificationCount()); } catch { setUnreadCount(0); }
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); loadContext(); loadUnread(); }, [loadProducts, loadContext, loadUnread]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProducts(), loadContext()]);
    setRefreshing(false);
  }, [loadProducts, loadContext]);

  /**
   * The design's rule: every listing surface carries a tap-to-send question
   * chip, and it sends the message rather than opening a blank composer.
   */
  const askAboutListing = useCallback(async (product: Product) => {
    if (!user) { router.push('/login' as any); return; }
    if (!product.seller_id || product.seller_id === user.id) return;
    setAsking(product.id);
    try {
      const roomId = await getOrCreateChatRoom(product.seller_id, product.id);
      await sendMessage(roomId, isArabic ? 'هل ما زال متاحاً؟' : 'Is it still available?');
      router.push(`/chat/${roomId}` as any);
    } catch (e) {
      console.error('[Home] ask failed', e);
    } finally {
      setAsking(null);
    }
  }, [user, router, isArabic]);

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

  // Categories come from live stock: a tile per category with a real count.
  // Empties never appear because there is nothing to make a tile from.
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const c = (p as any).category as string | undefined;
      if (c) m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  }, [products]);

  /**
   * The quiet state leads with one listing at full width (7b). It is the
   * most asked-about item with a photo -- a real signal, not the newest
   * upload -- and it only appears when there is no reply digest above it
   * and no category filter narrowing the page.
   */
  const lead = useMemo(() => {
    if (replies.length > 0 || category || query.trim()) return null;
    const withPhotos = products.filter(p => p.images?.[0]);
    if (withPhotos.length < 3) return null;
    return [...withPhotos].sort((a, b) =>
      (askCounts[b.id] ?? 0) - (askCounts[a.id] ?? 0) ||
      (b.view_count ?? 0) - (a.view_count ?? 0)
    )[0] ?? null;
  }, [products, askCounts, replies.length, category, query]);

  useEffect(() => {
    let cancelled = false;
    const sellerId = lead?.seller_id;
    (async () => {
      const badge = sellerId ? await getSellerReplyBadge(sellerId).catch(() => null) : null;
      if (!cancelled) setLeadReplyBadge(badge);
    })();
    return () => { cancelled = true; };
  }, [lead?.seller_id]);

  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products
      .filter(p => p.id !== lead?.id)
      .filter(p => !category || (p as any).category === category)
      .filter(p => !q || p.title.toLowerCase().includes(q));
    if (!sortByAsked) return list;
    return [...list].sort((a, b) => (askCounts[b.id] ?? 0) - (askCounts[a.id] ?? 0));
  }, [products, lead, category, query, sortByAsked, askCounts]);

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
  const askBadge = (id: string) => {
    const n = askCounts[id];
    if (!n || n < 2) return undefined;
    return isArabic ? `${n} يسألون عنه` : `${n} asking about it`;
  };

  const T = isArabic
    ? {
        sell: 'بيع', quietHeadline: (n: number) => `${n} شيء معروض على إيجي باي`,
        quietSub: 'اسأل البائع في نقرة واحدة. الردود تظهر هنا.',
        replyHeadline: (n: number) => n === 1 ? 'شخص واحد رد بينما كنت غائباً' : `${n} ردوا بينما كنت غائباً`,
        mostAsked: 'الأكثر سؤالاً', newest: 'الأحدث', allListings: 'كل الإعلانات',
        sellCardTitle: 'بيع على إيجي باي؟', sellCardSub: 'اعرض منتجك وتحدث مع المشترين مباشرة.',
        empty: 'لا يوجد إعلانات', emptySub: 'كن أول من يبيع هنا.',
      }
    : {
        sell: 'Sell', quietHeadline: (n: number) => `${n} things for sale on Egbay`,
        quietSub: 'Ask a seller anything in one tap. Replies land here.',
        replyHeadline: (n: number) => n === 1 ? '1 person replied while you were away' : `${n} replied while you were away`,
        mostAsked: 'Most asked about', newest: 'Newest', allListings: 'All listings',
        sellCardTitle: 'Sell on Egbay?', sellCardSub: 'Show your item and talk to buyers directly.',
        empty: 'No listings yet', emptySub: 'Be the first to sell here.',
      };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.text} />}
      >
        {/* ── Header: ink panel, activity digest or quiet state ── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerTop}>
            <View style={s.wordmarkRow}>
              <View style={s.wordmark}>
                <Text style={[s.wm, { color: '#60A5FA' }]}>e</Text><Text style={[s.wm, { color: '#F87171' }]}>g</Text>
                <Text style={[s.wm, { color: '#FBBF24' }]}>b</Text><Text style={[s.wm, { color: '#34D399' }]}>a</Text>
                <Text style={[s.wm, { color: '#60A5FA' }]}>y</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={s.sellPill} onPress={() => router.push('/(tabs)/sell' as any)}>
                <Plus size={16} color={color.text} strokeWidth={2.6} />
                <Text style={s.sellPillText}>{T.sell}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtnDark} onPress={() => setSearchOpen(true)} accessibilityLabel="Search" hitSlop={4}>
                <Search size={18} color={color.textInverse} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtnDark} onPress={() => router.push('/notifications' as any)} accessibilityLabel="Notifications" hitSlop={4}>
                <Bell size={18} color={color.textInverse} />
                {unreadCount > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {liveNow && (
            <TouchableOpacity style={s.liveBanner} onPress={() => router.push(`/live/${liveNow.agora_channel}` as any)} activeOpacity={0.85}>
              <View style={s.liveDot} />
              <Text style={s.liveBannerText} numberOfLines={1}>
                {isArabic ? liveNow.title_ar || liveNow.title : liveNow.title}
              </Text>
              <Text style={s.liveBannerCta}>{isArabic ? 'شاهد ←' : 'Watch →'}</Text>
            </TouchableOpacity>
          )}

          {replies.length > 0 ? (
            <>
              <Text style={s.headline}>{T.replyHeadline(replies.length)}</Text>
              <View style={{ gap: 8, marginTop: 14 }}>
                {replies.map(r => (
                  <TouchableOpacity key={r.room_id} style={s.replyRow} onPress={() => router.push(`/chat/${r.room_id}` as any)} activeOpacity={0.85}>
                    <Image
                      source={{ uri: r.other_user_avatar_url || 'https://placehold.co/100x100/1E293B/94A3B8?text=%20' }}
                      style={s.replyAvatar}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={s.replyTopRow}>
                        <Text style={s.replyName}>{r.other_user_name}</Text>
                        <Text style={s.replyTime}>{timeAgo(r.created_at, isArabic)}</Text>
                      </View>
                      <Text style={s.replyMsg} numberOfLines={1}>
                        {r.is_offer && r.offer_amount_egp ? `${isArabic ? 'عرض' : 'Offer'}: ${formatEGP(r.offer_amount_egp)}` : `"${r.message}"`}
                      </Text>
                      {!!r.product_title && <Text style={s.replyMeta} numberOfLines={1}>{r.product_title.toUpperCase()}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={s.headline}>{T.quietHeadline(products.length)}</Text>
              <Text style={s.headlineSub}>{T.quietSub}</Text>
            </>
          )}
        </View>

        {/* ── Category tiles ── */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.lg }} contentContainerStyle={s.tileRow}>
            <TouchableOpacity
              style={[s.catTile, { backgroundColor: color.surfaceAlt }, !category && s.catTileOn]}
              onPress={() => setCategory(null)}
            >
              <Text style={[s.catTileCount, { color: color.text }]}>{products.length}</Text>
              <Text style={[s.catTileLabel, { color: color.text }]}>{isArabic ? 'الكل' : 'All'}</Text>
            </TouchableOpacity>
            {categories.map((c, i) => {
              const hue = categoryHues[i % categoryHues.length];
              const on = category === c.name;
              return (
                <TouchableOpacity
                  key={c.name}
                  style={[s.catTile, { backgroundColor: hue.bg }, on && s.catTileOn]}
                  onPress={() => setCategory(on ? null : c.name)}
                >
                  <Text style={[s.catTileCount, { color: hue.ink }]}>{c.n}</Text>
                  <Text style={[s.catTileLabel, { color: hue.ink }]} numberOfLines={1}>{tileLabel(c.name)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Feed ── */}
        <View style={s.sectionHead}>
          <Text style={s.h2}>{category ? tileLabel(category) : T.allListings}</Text>
          <TouchableOpacity onPress={() => setSortByAsked(v => !v)}>
            <Text style={s.sortLink}>{sortByAsked ? T.newest : T.mostAsked}</Text>
          </TouchableOpacity>
        </View>

        {!!lead && (
          <View style={s.leadWrap}>
            <FeaturedProductCard
              item={lead}
              width={Math.min(width, 520) - space.lg * 2}
              isWishlisted={wishlistIds.has(lead.id)}
              onPress={() => router.push(`/products/${lead.id}` as any)}
              onToggleWishlist={() => toggleWishlist(lead)}
              onAsk={() => askAboutListing(lead)}
              askLabel={asking === lead.id ? (isArabic ? 'جارٍ الإرسال…' : 'Sending…') : (isArabic ? 'هل ما زال متاحاً؟' : 'Is it still available?')}
              trustLine={leadReplyBadge ?? askBadge(lead.id)}
              metaRight={lead.condition || undefined}
            />
          </View>
        )}

        {!loading && feed.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{T.empty}</Text>
            <Text style={s.emptySub}>{T.emptySub}</Text>
          </View>
        ) : (
          <View style={[s.lanes, { paddingHorizontal: space.lg }]}>
            {lanes.map((lane, li) => (
              <View key={li} style={{ gap: 14, width: laneWidth }}>
                {lane.map(({ item, tall }, i) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    width={laneWidth}
                    imageHeight={tall ? laneWidth * 1.25 : laneWidth}
                    isWishlisted={wishlistIds.has(item.id)}
                    onPress={() => router.push(`/products/${item.id}` as any)}
                    onToggleWishlist={() => toggleWishlist(item)}
                    trustLine={askBadge(item.id)}
                    metaRight={item.condition || undefined}
                    /* One ask chip per lane, on the lead card -- the design
                       puts it on the prominent tile, not on every tile. */
                    askLabel={i === 0 && item.seller_id !== user?.id
                      ? (asking === item.id
                          ? (isArabic ? 'جارٍ الإرسال…' : 'Sending…')
                          : (isArabic ? 'هل ما زال متاحاً؟' : 'Still available?'))
                      : undefined}
                    onAsk={i === 0 ? () => askAboutListing(item) : undefined}
                  />
                ))}
                {li === 1 && (
                  <TouchableOpacity style={s.sellCard} onPress={() => router.push('/(tabs)/sell' as any)} activeOpacity={0.9}>
                    <View>
                      <Text style={s.sellCardTitle}>{T.sellCardTitle}</Text>
                      <Text style={s.sellCardSub}>{T.sellCardSub}</Text>
                    </View>
                    <View style={s.sellCardIcon}><Plus size={18} color={color.textInverse} /></View>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
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
            <MessageCircle size={16} color={color.successDark} />
            <Text style={s.searchEscrowText}>
              {isArabic ? 'راسل البائع، اتفقا على السعر، والتقيا بأمان.' : 'Chat with the seller, agree on a price, meet safely.'}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.surface },

  header: { backgroundColor: color.ink, paddingHorizontal: space.lg, paddingBottom: space.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  wm: { fontSize: 20, fontWeight: weight.heavy, letterSpacing: -1.2 },

  sellPill: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.textInverse, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellPillText: { fontSize: font.footnote + 0.5, fontWeight: weight.heavy, color: color.text, letterSpacing: -0.2 },
  iconBtnDark: { height: 36, width: 36, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 3, borderRadius: radius.pill, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: color.ink },
  badgeText: { color: color.textInverse, fontSize: 9, fontWeight: weight.heavy },

  liveBanner: { marginTop: 14, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.danger },
  liveBannerText: { flex: 1, color: color.textInverse, fontSize: font.footnote, fontWeight: weight.bold },
  liveBannerCta: { color: '#FCA5A5', fontSize: font.caption2, fontWeight: weight.bold },

  headline: { color: color.textInverse, fontSize: 24, fontWeight: weight.heavy, letterSpacing: -1, marginTop: 16, lineHeight: 29 },
  headlineSub: { color: 'rgba(255,255,255,0.8)', fontSize: font.subhead - 1, marginTop: 8, lineHeight: 19 },

  replyRow: { flexDirection: 'row', gap: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 11 },
  replyAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.inkAlt },
  replyTopRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  replyName: { fontSize: font.subhead - 1, fontWeight: weight.heavy, color: color.textInverse },
  replyTime: { fontSize: 10, fontWeight: weight.bold, color: 'rgba(255,255,255,0.6)' },
  replyMsg: { fontSize: font.subhead - 1, color: color.textInverse, marginTop: 3, lineHeight: 19 },
  replyMeta: { fontSize: 10, fontWeight: weight.bold, letterSpacing: 1, color: 'rgba(255,255,255,0.6)', marginTop: 5 },

  tileRow: { paddingHorizontal: space.lg, gap: 8 },
  catTile: { width: 86, height: 70, borderRadius: 16, padding: 10, justifyContent: 'space-between' },
  catTileOn: { outlineWidth: 2, outlineColor: color.action, outlineOffset: 2, borderWidth: 2, borderColor: color.action },
  catTileCount: { fontSize: 9, fontWeight: weight.heavy, letterSpacing: 1 },
  catTileLabel: { fontSize: font.subhead - 2, fontWeight: weight.heavy, letterSpacing: -0.3, lineHeight: 15 },

  sectionHead: { paddingHorizontal: space.lg, paddingTop: space.xl, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.md },
  h2: { fontSize: font.title1, fontWeight: weight.heavy, color: color.text, letterSpacing: -1 },
  sortLink: { fontSize: font.footnote, fontWeight: weight.bold, color: color.primary },

  leadWrap: { paddingHorizontal: space.lg, paddingBottom: 18, marginBottom: 18, borderBottomWidth: 1, borderBottomColor: color.border },
  lanes: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  sellCard: { borderRadius: 22, backgroundColor: color.ink, padding: space.lg, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sellCardTitle: { color: color.textInverse, fontSize: font.headline, fontWeight: weight.heavy, letterSpacing: -0.4, lineHeight: 21 },
  sellCardSub: { color: 'rgba(255,255,255,0.65)', fontSize: font.caption, marginTop: 4, lineHeight: 16 },
  sellCardIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

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
