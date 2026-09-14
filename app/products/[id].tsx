import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Package,
  Percent,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Truck,
  X,
  Zap,
  Flag,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { getProductBoostInfo } from '../../src/services/lib/boostService';
import { DIGITAL_PURCHASES_ENABLED, PAYMENTS_ENABLED } from '../../src/services/lib/platformCommerce';
import { isBackendMissing, reportContent, SAFETY_EMAIL } from '../../src/services/lib/moderationService';
import { getOrCreateChatRoom, sendMessage } from '../../src/services/lib/chatService';
import { productService, type Product } from '../../src/services/lib/products';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { displayName } from '../../src/services/lib/displayName';
import { StarRating } from '../../src/components/StarRating';
import { ReviewList } from '../../src/components/ReviewList';
import {
  getProductReviews,
  getSellerRating,
  type Review,
  type SellerRating,
} from '../../src/services/lib/reviewService';
import { supabase } from '../../src/services/lib/supabase';
import EscrowTrustModal from '../../src/components/EscrowTrustModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEGP(price: number | string): string {
  const n = Math.round(Number(price));
  return `EGP ${n.toLocaleString('en-EG')}`;
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { width } = useWindowDimensions();

  const contentWidth = Math.min(width, 760);
  const carouselHeight = Math.min(contentWidth * 0.85, 480);

  const [product,         setProduct]         = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [isBuying,        setIsBuying]        = useState(false);
  const [isWishlisted,    setIsWishlisted]    = useState(false);
  const [activeIndex,     setActiveIndex]     = useState(0);
  const [productReviews,  setProductReviews]  = useState<Review[]>([]);
  const [sellerRating,    setSellerRating]    = useState<SellerRating | null>(null);
  // Classifieds mode has no orders, so no reviews can exist -- the seller
  // card shows a listings count instead of a rating (see PLAN-CLASSIFIEDS-MODE.md).
  const [sellerListingsCount, setSellerListingsCount] = useState<number | null>(null);

  // Offer Modal State
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount,       setOfferAmount]       = useState('');
  const [isSendingOffer,    setIsSendingOffer]    = useState(false);

  // Safety Guide Modal State
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [trustModalVisible, setTrustModalVisible] = useState(false);

  // Heart scale animation
  const [heartScale] = useState(() => new Animated.Value(1));

  const loadProduct = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await productService.getProductById(id);
      setProduct(data);
      setIsWishlisted(data?.isWishlisted ?? false);

      if (data?.category) {
        const similar = await productService.getSimilarProducts(data.category, id, 6);
        setSimilarProducts(similar);
      }

      // Real engagement signal for the home hero's "Trending" ranking (see
      // (tabs)/index.tsx) -- fire-and-forget, never blocks the listing from
      // rendering. Skipped for the owner viewing their own listing so a
      // seller can't inflate their own item's rank by repeatedly opening it.
      if (data && data.seller_id !== user?.id) {
        supabase.rpc('increment_product_view', { p_product_id: id }).then(({ error }) => {
          if (error) console.warn('[ProductDetail] view count increment failed:', error);
        });
      }

      if (PAYMENTS_ENABLED) {
        // Reviews are supporting detail -- a failure here must not blank the
        // listing, so they load beside the product rather than gating it.
        getProductReviews(id).then(setProductReviews).catch(err =>
          console.warn('[ProductDetail] product reviews failed:', err));
        if (data?.seller_id) {
          getSellerRating(data.seller_id).then(setSellerRating).catch(err =>
            console.warn('[ProductDetail] seller rating failed:', err));
        }
      } else if (data?.seller_id) {
        productService.getProductsBySeller(data.seller_id)
          .then(list => setSellerListingsCount(list.length))
          .catch(err => console.warn('[ProductDetail] seller listings count failed:', err));
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load product.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading state belongs to the request for the new product/user.
    if (id) loadProduct();
  }, [id, user]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleBuyNow = () => {
    if (!user) { router.push('/login'); return; }
    if (!product) return;
    if (user.id === product.seller_id) {
      Toast.show({ type: 'info', text1: 'This is your own listing.' });
      return;
    }
    router.push({
      pathname: '/checkout',
      params: { productId: product.id },
    } as any);
  };

  const handleWishlist = async () => {
    if (!user) { router.push('/login'); return; }
    if (!product) return;

    // Animate the heart
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const was = isWishlisted;
    setIsWishlisted(!was);
    try {
      was
        ? await productService.removeFromWishlist(product.id)
        : await productService.addToWishlist(product.id);
      Toast.show({ type: 'success', text1: was ? 'Removed from wishlist' : '❤️ Added to wishlist' });
    } catch {
      setIsWishlisted(was); // revert
      Toast.show({ type: 'error', text1: 'Could not update wishlist.' });
    }
  };

  const handleContact = async () => {
    if (!user) { router.push('/login'); return; }
    if (!product?.seller_id) return;
    if (user.id === product.seller_id) {
      Toast.show({ type: 'info', text1: 'This is your own listing.' }); return;
    }
    try {
      const roomId = await getOrCreateChatRoom(product.seller_id, product.id);
      router.push(`/chat/${roomId}`);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not start chat.' });
    }
  };

  const handleOpenOfferModal = () => {
    if (!user) { router.push('/login'); return; }
    if (!product?.seller_id) return;
    if (user.id === product.seller_id) {
      Toast.show({ type: 'info', text1: 'This is your own listing.' }); return;
    }
    // Default offer is 10% below list price
    const defaultOffer = Math.round(Number(product.price) * 0.9);
    setOfferAmount(String(defaultOffer));
    setOfferModalVisible(true);
  };

  const handleSendOffer = async () => {
    if (!product || !offerAmount || isNaN(Number(offerAmount))) {
      Toast.show({ type: 'error', text1: 'Please enter a valid offer amount.' });
      return;
    }
    try {
      setIsSendingOffer(true);
      const roomId = await getOrCreateChatRoom(product.seller_id, product.id);
      const offerMsg = `🏷️ [OFFER / عرض شراء]\nI would like to offer ${formatEGP(offerAmount)} for "${product.title}" (Listed at ${formatEGP(product.price)}).`;
      await sendMessage(roomId, offerMsg);
      setOfferModalVisible(false);
      Toast.show({ type: 'success', text1: t('products.offerSent') });
      router.push(`/chat/${roomId}`);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to send offer', text2: e.message });
    } finally {
      setIsSendingOffer(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    await Share.share({ message: `Check out "${product.title}" on EgyBay! https://egbay.app/products/${product.id}` });
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: '#94A3B8' }}>Loading…</Text>
      </View>
    );
  }

  const isOwner = user?.id === product.seller_id;
  const images  = product.images?.length ? product.images : ['https://placehold.co/600x600/F1F5F9/64748B?text=Item'];
  const sellerName    = displayName(product.seller?.full_name, 'Seller');
  const sellerInitial = sellerName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.pageWrapper, { maxWidth: contentWidth }]}>

        {/* ── Image carousel (responsive width/height) ── */}
        <View style={[styles.carousel, { width: contentWidth, height: carouselHeight }]}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={e => {
              setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / contentWidth));
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={[styles.carouselImage, { width: contentWidth, height: carouselHeight }]} />
            )}
          />

          {/* Gradient top overlay for back/share/heart visibility */}
          <LinearGradient
            colors={['rgba(0,0,0,0.48)', 'transparent']}
            style={styles.carouselTopGradient}
          />

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} onPress={() => router.back()}>
            <ArrowLeft color="white" size={22} />
          </TouchableOpacity>

        {/* Share + Wishlist (top right) */}
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.overlayBtn} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} onPress={handleShare}>
            <Share2 color="white" size={18} />
          </TouchableOpacity>
          {!isOwner && (
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <TouchableOpacity style={styles.overlayBtn} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} onPress={handleWishlist}>
                <Heart
                  size={18}
                  color={isWishlisted ? '#F87171' : 'white'}
                  fill={isWishlisted ? '#F87171' : 'none'}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* Image counter pill */}
        {images.length > 1 && (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{activeIndex + 1} / {images.length}</Text>
          </View>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        <View style={styles.content}>
          {/* Promoted Badge if active */}
          {(() => {
            const boost = getProductBoostInfo(product);
            if (!boost.isPromoted || !boost.pkg) return null;
            return (
              <View style={[styles.promotedPill, { backgroundColor: boost.pkg.id === 'urgent' ? '#FEF3C7' : '#EFF6FF', borderColor: boost.pkg.id === 'urgent' ? '#F59E0B' : '#3B82F6' }]}>
                <Text style={{ fontSize: 13 }}>{boost.pkg.badgeEmoji}</Text>
                <Text style={[styles.promotedPillText, { color: boost.pkg.id === 'urgent' ? '#B45309' : '#1D4ED8' }]}>
                  {boost.pkg.badgeText}
                </Text>
              </View>
            );
          })()}

          {/* Owner Boost CTA Card.
              Hidden entirely while PAYMENTS_ENABLED is false -- boosts are a
              paid digital feature with no purchase path at all right now
              (see PLAN-CLASSIFIEDS-MODE.md). Hidden on iOS even once payments
              are back: 3.1.3(g) requires in-app purchase for it, and until
              boosts go through StoreKit, iOS must not offer -- or point at --
              buying one. */}
          {PAYMENTS_ENABLED && DIGITAL_PURCHASES_ENABLED && user?.id === product.seller_id && (
            <TouchableOpacity
              style={styles.ownerBoostBanner}
              onPress={() => router.push(`/boost/${product.id}` as any)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ownerBoostGradient}
              >
                <View style={styles.ownerBoostLeft}>
                  <Sparkles size={20} color="#F59E0B" />
                  <View>
                    <Text style={styles.ownerBoostTitle}>Promote This Listing ⚡</Text>
                    <Text style={styles.ownerBoostSub}>Get up to 10x more buyers across Egypt</Text>
                  </View>
                </View>
                <View style={styles.ownerBoostBtn}>
                  <Text style={styles.ownerBoostBtnText}>Boost →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Title row + badges */}
          <Reanimated.View entering={FadeInDown.duration(350).delay(50)}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, product.condition === 'New' ? styles.badgeNew : styles.badgeUsed]}>
                <Text style={[styles.badgeText, product.condition === 'New' ? styles.badgeTextNew : styles.badgeTextUsed]}>
                  {product.condition ?? 'Used'}
                </Text>
              </View>
              {(product as any).created_at && (
                <Text style={styles.listedDate}>🕐 Listed {timeAgo((product as any).created_at)}</Text>
              )}
            </View>

            <Text style={styles.title}>{product.title}</Text>

            {/* Price */}
            <Text style={styles.price}>{formatEGP(product.price)}</Text>
          </Reanimated.View>

          {/* ── Seller card ── */}
          <Reanimated.View entering={FadeInDown.duration(350).delay(100)}>
            <View style={styles.sellerCard}>
              <View style={styles.sellerAvatarWrap}>
                {product.seller?.avatar_url ? (
                  <Image source={{ uri: product.seller.avatar_url }} style={styles.sellerAvatar} />
                ) : (
                  <View style={styles.sellerAvatarFallback}>
                    <Text style={styles.sellerInitial}>{sellerInitial}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName}>{sellerName}</Text>
                <View style={styles.sellerMeta}>
                  {product.seller?.is_verified_seller && (
                    <>
                      <ShieldCheck size={12} color="#10B981" />
                      <Text style={styles.sellerMetaText}>Verified Seller</Text>
                      <Text style={styles.sellerDot}>·</Text>
                    </>
                  )}
                  <ShoppingBag size={12} color="#94A3B8" />
                  <Text style={styles.sellerMetaText}>Egypt</Text>
                </View>
                {/* Real rating from the reviews aggregate. The previous pills
                    showed a hardcoded "18 items sold" for every seller and an
                    unconditional "Verified Seller" badge -- both were invented.
                    Classifieds mode has no orders, so no reviews can exist --
                    a listings count stands in for the rating instead. */}
                {PAYMENTS_ENABLED ? (
                  <View style={styles.sellerMetricsRow}>
                    <StarRating
                      value={sellerRating?.rating_avg ?? null}
                      count={sellerRating?.rating_count ?? 0}
                      size={13}
                      isRTL={isRTL}
                    />
                  </View>
                ) : sellerListingsCount != null && (
                  <View style={styles.sellerMetricsRow}>
                    <Text style={styles.sellerMetaText}>
                      {isRTL
                        ? `${sellerListingsCount} إعلان`
                        : `${sellerListingsCount} listing${sellerListingsCount === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                )}
              </View>
              <ChevronRight color="#CBD5E1" size={18} />
            </View>
          </Reanimated.View>

          {/* Safety tips: meet in public, inspect before paying -- worth
              surfacing on every listing, not just while payments are paused. */}
          <TouchableOpacity
            style={styles.safetyLink}
            onPress={() => router.push('/safety' as any)}
            activeOpacity={0.7}
          >
            <ShieldAlert size={13} color="#94A3B8" />
            <Text style={styles.safetyLinkText}>
              {isRTL ? 'نصائح للبيع والشراء بأمان' : 'Safety tips for buying and selling'}
            </Text>
          </TouchableOpacity>

          {/* Location badge */}
          {(product as any).location && (
            <Reanimated.View entering={FadeInDown.duration(350).delay(140)} style={styles.locationBadge}>
              <MapPin size={14} color="#6366F1" />
              <Text style={styles.locationText}>{(product as any).location}, Egypt</Text>
            </Reanimated.View>
          )}

          {/* Talking to the seller and negotiating are both actions on a
              *person*, so they sit with the seller rather than competing with
              Buy in the sticky bar. */}
          {!isOwner && (
            <Reanimated.View entering={FadeInDown.duration(350).delay(150)} style={styles.sellerActions}>
              {/* While payments are paused, the sticky bar's main action IS
                  "Message seller" (see below), so repeating it here would be
                  a second identical CTA. Share fills the slot instead. */}
              {PAYMENTS_ENABLED ? (
                <TouchableOpacity style={styles.ghostBtn} onPress={handleContact} activeOpacity={0.85}>
                  <MessageCircle size={17} color="#0F172A" />
                  <Text style={styles.ghostBtnText}>{isRTL ? 'راسل البائع' : 'Message seller'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.ghostBtn} onPress={handleShare} activeOpacity={0.85}>
                  <Share2 size={16} color="#0F172A" />
                  <Text style={styles.ghostBtnText}>{isRTL ? 'مشاركة' : 'Share'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.ghostBtn} onPress={handleOpenOfferModal} activeOpacity={0.85}>
                <Tag size={16} color="#0F172A" />
                <Text style={styles.ghostBtnText}>{isRTL ? 'قدّم عرضاً' : 'Make an offer'}</Text>
              </TouchableOpacity>
            </Reanimated.View>
          )}

          {/* ── EgyBay Escrow & Money Back Guarantee Card ──
              Classifieds mode: there is no escrow to promise right now (see
              PLAN-CLASSIFIEDS-MODE.md). */}
          {PAYMENTS_ENABLED && (
          <Reanimated.View entering={FadeInDown.duration(350).delay(180)}>
            <TouchableOpacity
              style={styles.guaranteeCard}
              onPress={() => setTrustModalVisible(true)}
              activeOpacity={0.85}
            >
              <View style={styles.guaranteeIconWrap}>
                <ShieldCheck color="#2563EB" size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={styles.guaranteeTitle}>
                    {isRTL ? 'ضمان إيجي باي لحماية أموالك 🛡️' : 'EgyBay escrow protection 🛡️'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '800' }}>
                    {isRTL ? 'كيف نحميك؟ ←' : 'How it works →'}
                  </Text>
                </View>
                <Text style={styles.guaranteeDesc}>
                  {isRTL
                    ? 'أموالك في أمان تام ولا تُحوّل للبائع إلا بعد استلامك ومعاينتك للمنتج 100%.'
                    : 'Your money is held safely and is never released to the seller until you have received and inspected the item.'}
                </Text>
              </View>
            </TouchableOpacity>
          </Reanimated.View>
          )}

          {/* ── Delivery & Handover Options Strip ── */}
          <Reanimated.View entering={FadeInDown.duration(350).delay(220)} style={styles.deliverySection}>
            <Text style={styles.deliveryHeaderTitle}>{t('products.deliveryOptions')}</Text>
            <View style={styles.deliveryOptionRow}>
              <View style={styles.deliveryOptionDot}>
                <Truck size={14} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliveryOptionName}>{t('products.expressShipping')}</Text>
                <Text style={styles.deliveryOptionSub}>Next-day delivery available</Text>
              </View>
            </View>
            <View style={[styles.deliveryOptionRow, { marginTop: 8 }]}>
              <View style={[styles.deliveryOptionDot, { backgroundColor: '#EFF6FF' }]}>
                <MapPin size={14} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliveryOptionName}>{t('products.meetupInPerson')}</Text>
                <Text style={styles.deliveryOptionSub}>Inspect item before paying cash</Text>
              </View>
            </View>
          </Reanimated.View>

          {/* Description */}
          <Reanimated.View entering={FadeInDown.duration(350).delay(260)}>
            <Text style={styles.sectionLabel}>{t('products.description')}</Text>
            <Text style={styles.description}>
              {product.description || 'No description provided.'}
            </Text>
          </Reanimated.View>

          {/* ── Reviews for this listing ──
              Classifieds mode: reviews require a completed order, and no
              orders exist right now (see PLAN-CLASSIFIEDS-MODE.md). */}
          {PAYMENTS_ENABLED && (
          <View style={{ marginBottom: 24 }}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionLabel}>
                {isRTL ? 'تقييمات هذا المنتج' : 'Reviews for this item'}
              </Text>
              {productReviews.length > 0 && (
                <Text style={styles.reviewsCount}>
                  {productReviews.length}
                </Text>
              )}
            </View>
            <ReviewList
              reviews={productReviews}
              isRTL={isRTL}
              emptyText={
                isRTL
                  ? 'لا توجد تقييمات على هذا المنتج بعد.'
                  : 'No reviews on this item yet.'
              }
            />
          </View>
          )}

          {/* ── Similar Products Carousel (eBay style) ── */}
          {similarProducts.length > 0 && (
            <View style={styles.similarSection}>
              <View style={styles.similarHeader}>
                <Sparkles size={18} color="#6366F1" />
                <Text style={styles.similarTitle}>{t('products.similarItems')}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarRow}
              >
                {similarProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.similarCard}
                    onPress={() => router.push(`/products/${item.id}` as any)}
                    activeOpacity={0.88}
                  >
                    <Image
                      source={{ uri: item.images?.[0] || 'https://placehold.co/300x300/F1F5F9/64748B?text=Item' }}
                      style={styles.similarImg}
                    />
                    <View style={styles.similarBody}>
                      <Text style={styles.similarItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.similarItemPrice}>{formatEGP(item.price)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Guideline 1.2: writes a content_reports row; no "submitted" toast
              unless the RPC actually resolved. */}
          <TouchableOpacity
            style={styles.reportListingBtn}
            onPress={() => {
              const send = async (reason: string) => {
                try {
                  await reportContent('listing', product.id, reason);
                } catch (err: any) {
                  Alert.alert(
                    isRTL ? 'لم يتم إرسال البلاغ' : 'Report not sent',
                    isBackendMissing(err)
                      ? `Reporting is temporarily unavailable. Email ${SAFETY_EMAIL} and we will act within 24 hours.`
                      : (err?.message || 'Please try again.'),
                  );
                  return;
                }
                Toast.show({
                  type: 'success',
                  text1: isRTL ? 'تم إرسال البلاغ' : 'Report sent',
                  text2: isRTL ? 'سيراجعه فريق الأمان خلال ٢٤ ساعة' : 'Our safety team reviews reports within 24 hours.',
                });
              };
              Alert.alert(
                isRTL ? 'الإبلاغ عن الإعلان' : 'Report this listing',
                isRTL ? 'ما سبب البلاغ؟' : 'Why are you reporting it?',
                [
                  { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                  { text: 'Prohibited or counterfeit item', onPress: () => send('Prohibited or counterfeit item') },
                  { text: 'Scam or misleading', onPress: () => send('Scam or misleading') },
                  { text: 'Inappropriate content', onPress: () => send('Inappropriate content') },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Flag size={14} color="#94A3B8" />
            <Text style={styles.reportListingText}>
              {isRTL ? 'الإبلاغ عن مخالفة' : 'Report this listing'}
            </Text>
          </TouchableOpacity>

          {/* Bottom spacer for sticky bar */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ── Sticky bar: the price and the one action that matters ──
          Previously three CTAs of near-equal weight sat here -- Chat in
          indigo, Make an Offer in violet, Buy Now in green -- so nothing
          dominated and the screen asked the shopper to choose between three
          things instead of one. The price was not in the bar at all, even
          though it is the number a buyer checks immediately before committing.

          Chat and Make an Offer are not gone; they moved up beside the seller,
          which is where they belong contextually -- you message a *person* and
          you negotiate with a *person*. */}
      <Reanimated.View entering={FadeInUp.duration(350)} style={styles.bottomBar}>
        {isOwner ? (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaEdit]}
            onPress={() => router.push(`/products/edit/${product.id}` as any)}
          >
            <Edit3 size={18} color="white" />
            <Text style={styles.ctaBtnText}>Edit Listing</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.barRow}>
            <View style={styles.barPriceWrap}>
              <Text style={styles.barPriceLabel}>{isRTL ? 'السعر' : 'Price'}</Text>
              <Text style={styles.barPrice} numberOfLines={1}>{formatEGP(product.price)}</Text>
            </View>

            {/* Classifieds mode: there is no checkout right now, so the main
                action is starting the conversation, not buying (see
                PLAN-CLASSIFIEDS-MODE.md). */}
            {PAYMENTS_ENABLED ? (
              <TouchableOpacity
                style={styles.buyBtn}
                onPress={handleBuyNow}
                disabled={isBuying}
                activeOpacity={0.9}
              >
                {isBuying ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <ShoppingBag size={18} color="white" />
                    <Text style={styles.buyBtnText}>{isRTL ? 'اشترِ الآن' : 'Buy now'}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.buyBtn}
                onPress={handleContact}
                activeOpacity={0.9}
              >
                <MessageCircle size={18} color="white" />
                <Text style={styles.buyBtnText}>{isRTL ? 'راسل البائع' : 'Message seller'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Reanimated.View>

      {/* ════════════════ MAKE AN OFFER MODAL ════════════════ */}
      <Modal
        visible={offerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('products.makeOffer')}</Text>
                <Text style={styles.modalSub}>{t('products.makeOfferSubtitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Listed Price reference */}
            <View style={styles.modalPriceRef}>
              <Text style={styles.modalPriceRefLabel}>Listed Price:</Text>
              <Text style={styles.modalPriceRefValue}>{formatEGP(product.price)}</Text>
            </View>

            {/* Discount chips */}
            <Text style={styles.modalSectionLabel}>Quick Suggestions:</Text>
            <View style={styles.presetRow}>
              {[5, 10, 15, 20].map(pct => {
                const calculated = Math.round(Number(product.price) * (1 - pct / 100));
                const isSelected = offerAmount === String(calculated);
                return (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => setOfferAmount(String(calculated))}
                  >
                    <Text style={[styles.presetChipPct, isSelected && styles.presetChipTextActive]}>-{pct}%</Text>
                    <Text style={[styles.presetChipVal, isSelected && styles.presetChipTextActive]}>{calculated.toLocaleString('en-EG')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Offer Input */}
            <Text style={styles.modalSectionLabel}>{t('products.offerAmount')}</Text>
            <View style={styles.offerInputWrapper}>
              <View style={styles.offerInputPrefix}>
                <Text style={styles.offerPrefixText}>EGP</Text>
              </View>
              <TextInput
                style={styles.offerInput}
                keyboardType="numeric"
                value={offerAmount}
                onChangeText={setOfferAmount}
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={styles.sendOfferBtn}
              onPress={handleSendOffer}
              disabled={isSendingOffer}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendOfferGradient}
              >
                {isSendingOffer ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Tag size={18} color="white" />
                    <Text style={styles.sendOfferText}>{t('products.sendOffer')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════════ SAFE TRADING IN EGYPT MODAL ════════════════ */}
      <Modal
        visible={safetyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSafetyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={24} color="#10B981" />
                <Text style={styles.modalTitle}>{t('products.safetyTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setSafetyModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.safetyIntro}>{t('products.safetySubtitle')}</Text>

            <View style={styles.safetyTipBox}>
              <Text style={styles.safetyTipText}>{t('products.safetyTip1')}</Text>
            </View>
            <View style={styles.safetyTipBox}>
              <Text style={styles.safetyTipText}>{t('products.safetyTip2')}</Text>
            </View>
            <View style={styles.safetyTipBox}>
              <Text style={styles.safetyTipText}>{t('products.safetyTip3')}</Text>
            </View>
            <View style={styles.safetyTipBox}>
              <Text style={styles.safetyTipText}>{t('products.safetyTip4')}</Text>
            </View>

            <TouchableOpacity
              style={styles.safetyDoneBtn}
              onPress={() => setSafetyModalVisible(false)}
            >
              <Text style={styles.safetyDoneText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Escrow Trust Guarantee Modal */}
      <EscrowTrustModal visible={trustModalVisible} onClose={() => setTrustModalVisible(false)} />

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  pageWrapper: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },

  // Carousel
  carousel: { backgroundColor: '#1E293B', position: 'relative' },
  carouselImage: { resizeMode: 'cover' },
  carouselTopGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },

  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRight: {
    position: 'absolute',
    top: 48,
    right: 16,
    gap: 10,
    flexDirection: 'row',
  },
  overlayBtn: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterPill: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  counterText: { color: 'white', fontSize: 12, fontWeight: '700' },
  dots: {
    position: 'absolute',
    bottom: 14,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { width: 18, backgroundColor: 'white' },

  // Content
  content: { padding: 20 },

  // Boost & Promoted styles
  promotedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  promotedPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  ownerBoostBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  ownerBoostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  ownerBoostLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  ownerBoostTitle: { color: 'white', fontSize: 13, fontWeight: '800' },
  ownerBoostSub: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, marginTop: 1 },
  ownerBoostBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ownerBoostBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeNew: { backgroundColor: '#D1FAE5' },
  badgeUsed: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextNew: { color: '#065F46' },
  badgeTextUsed: { color: '#92400E' },
  listedDate: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', lineHeight: 30, marginBottom: 8 },
  price: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginBottom: 20, letterSpacing: -0.9 },

  // Seller card
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  sellerAvatarWrap: { position: 'relative' },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26 },
  sellerAvatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  sellerInitial: { fontSize: 20, fontWeight: '800', color: '#6366F1' },
  sellerOnlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#10B981', borderWidth: 2, borderColor: 'white',
  },
  sellerName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  sellerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  sellerMetaText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  sellerDot: { color: '#CBD5E1', fontSize: 12 },
  sellerMetricsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sellerMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sellerMetricText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  // Guarantee Card
  guaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  guaranteeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guaranteeTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 2 },
  guaranteeDesc: { fontSize: 11, color: '#3B82F6', lineHeight: 16, fontWeight: '500' },

  // Delivery Section
  deliverySection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  deliveryHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  deliveryOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deliveryOptionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryOptionName: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  deliveryOptionSub: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  starHalf: { fontSize: 11, color: '#F59E0B', fontWeight: '900', marginLeft: -2 },

  // Location badge
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  locationText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

  // Trust badges
  trustRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  trustBadge: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  trustLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textAlign: 'center' },

  // Safety Card
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 24,
  },
  safetyCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyCardTitle: { fontSize: 13, fontWeight: '800', color: '#0369A1', marginBottom: 2 },
  safetyCardSub: { fontSize: 11, color: '#0284C7' },

  reviewsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  reviewsCount: {
    fontSize: 11, fontWeight: '800', color: '#64748B',
    backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  barPriceWrap: { minWidth: 96 },
  barPriceLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  barPrice: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.6, marginTop: 1 },
  buyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 54, borderRadius: 999, backgroundColor: '#0F172A',
  },
  buyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  sellerActions: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, height: 46, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  ghostBtnText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  // Description
  sectionLabel: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  description: { fontSize: 15, color: '#475569', lineHeight: 24, marginBottom: 24 },

  // Similar Products
  similarSection: { marginTop: 10, marginBottom: 20 },
  similarHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  similarTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  similarRow: { gap: 12, paddingRight: 20 },
  similarCard: {
    width: 140,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  similarImg: { width: 140, height: 110, resizeMode: 'cover' },
  similarBody: { padding: 8 },
  similarItemTitle: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  similarItemPrice: { fontSize: 13, fontWeight: '800', color: '#2563EB' },

  // Report Listing (Apple UGC)
  reportListingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
  },
  reportListingText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  // Safety tips link (below seller card)
  safetyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  safetyLinkText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  // Bottom sticky bar
  bottomBar: {
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  ctaRow: { flexDirection: 'row', gap: 8 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flex: 1,
  },
  ctaBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  ctaContact: { backgroundColor: '#EEF2FF' },
  ctaOffer: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  ctaBuy: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaEdit: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  modalCloseBtn: { padding: 6 },
  modalSectionLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },

  // Offer Modal
  modalPriceRef: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  modalPriceRefLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  modalPriceRefValue: { fontSize: 14, color: '#0F172A', fontWeight: '800' },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  presetChipActive: { backgroundColor: '#F5F3FF', borderColor: '#7C3AED' },
  presetChipPct: { fontSize: 13, fontWeight: '800', color: '#7C3AED' },
  presetChipVal: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  presetChipTextActive: { color: '#7C3AED' },

  offerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#DDD6FE',
    marginBottom: 20,
    overflow: 'hidden',
  },
  offerInputPrefix: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#EDE9FE',
  },
  offerPrefixText: { fontSize: 15, fontWeight: '900', color: '#7C3AED' },
  offerInput: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1E293B', paddingHorizontal: 14 },

  sendOfferBtn: { borderRadius: 16, overflow: 'hidden' },
  sendOfferGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  sendOfferText: { color: 'white', fontSize: 16, fontWeight: '800' },

  // Safety Modal
  safetyIntro: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 20 },
  safetyTipBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  safetyTipText: { fontSize: 13, color: '#334155', lineHeight: 20, fontWeight: '500' },
  safetyDoneBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  safetyDoneText: { color: 'white', fontSize: 15, fontWeight: '800' },
});
