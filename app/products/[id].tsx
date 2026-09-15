import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Heart,
  MessageCircle,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
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
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { getProductBoostInfo } from '../../src/services/lib/boostService';
import { DIGITAL_PURCHASES_ENABLED, PAYMENTS_ENABLED } from '../../src/services/lib/platformCommerce';
import { isBackendMissing, reportContent, SAFETY_EMAIL } from '../../src/services/lib/moderationService';
import { getOrCreateChatRoom, sendMessage, sendOffer } from '../../src/services/lib/chatService';
import { getSellerReplyBadge } from '../../src/services/lib/reputationStats';
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
  const [replyBadge, setReplyBadge] = useState<string | null>(null);
  const [comparable, setComparable] = useState<{ min: number; max: number; count: number } | null>(null);
  const [askSending, setAskSending] = useState<string | null>(null);

  // Offer Modal State
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount,       setOfferAmount]       = useState('');
  const [isSendingOffer,    setIsSendingOffer]    = useState(false);

  // Safety Guide Modal State
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [trustModalVisible, setTrustModalVisible] = useState(false);

  // Heart scale animation
  const [heartScale] = useState(() => new Animated.Value(1));
  const heroRef = useRef<FlatList>(null);

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
        productService.getComparablePriceRange(data.category, id).then(setComparable).catch(() => {});
      }
      if (data?.seller_id) {
        getSellerReplyBadge(data.seller_id).then(setReplyBadge).catch(() => {});
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
      // A structured offer (approved build) -- accept/decline live on the
      // message itself, not a plain-text guess the seller has to parse.
      await sendOffer(roomId, Number(offerAmount));
      setOfferModalVisible(false);
      Toast.show({ type: 'success', text1: t('products.offerSent') });
      router.push(`/chat/${roomId}`);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to send offer', text2: e.message });
    } finally {
      setIsSendingOffer(false);
    }
  };

  /**
   * "Ask in one tap" -- approved build's conversation rule: every listing
   * surface carries a chip that sends immediately, never an empty composer.
   */
  const handleAskChip = async (text: string) => {
    if (!user) { router.push('/login'); return; }
    if (!product || user.id === product.seller_id) return;
    setAskSending(text);
    try {
      const roomId = await getOrCreateChatRoom(product.seller_id, product.id);
      await sendMessage(roomId, text);
      router.push(`/chat/${roomId}`);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not send', text2: e.message });
    } finally {
      setAskSending(null);
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
  // The sell form appends "\n\n📍 {location}\n📦 Stock: N" to the description
  // it saves (see app/(tabs)/sell.tsx). Parsed back out here so the location
  // renders as its own WHERE row instead of raw tag text sitting inside the
  // description paragraph.
  const locationMatch = product.description?.match(/^📍 (.+)$/m);
  const locationTag = locationMatch?.[1]?.trim();
  const cleanDescription = (product.description ?? '')
    .replace(/\n*📍 .+$/m, '')
    .replace(/\n*📦 Stock: \d+$/m, '')
    .trim();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.pageWrapper, { maxWidth: contentWidth }]}>

        {/* ── Photo ──
            Approved build 3a: the photo carries only three floating white
            circles and a strip of thumbnails; no dark scrim, no counter pill,
            no dots. The thumbnails are the page indicator. */}
        <View style={[styles.hero, { width: contentWidth, height: carouselHeight }]}>
          <FlatList
            ref={heroRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={e => {
              setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / contentWidth));
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={[styles.heroImage, { width: contentWidth, height: carouselHeight }]} />
            )}
          />

          <TouchableOpacity style={[styles.circleBtn, styles.heroBack]} hitSlop={6} onPress={() => router.back()}>
            <ArrowLeft color="#0F172A" size={20} />
          </TouchableOpacity>

          <View style={styles.heroTopRight}>
            <TouchableOpacity style={styles.circleBtn} hitSlop={6} onPress={handleShare}>
              <Share2 color="#0F172A" size={18} />
            </TouchableOpacity>
            {!isOwner && (
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <TouchableOpacity style={styles.circleBtn} hitSlop={6} onPress={handleWishlist}>
                  <Heart
                    size={18}
                    color={isWishlisted ? '#EF4444' : '#0F172A'}
                    fill={isWishlisted ? '#EF4444' : 'none'}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {images.length > 1 && (
            <View style={styles.heroThumbs}>
              {images.slice(0, 4).map((img, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.85}
                  onPress={() => {
                    setActiveIndex(i);
                    heroRef.current?.scrollToOffset({ offset: i * contentWidth, animated: true });
                  }}
                >
                  <Image
                    source={{ uri: img }}
                    style={[styles.heroThumb, i === activeIndex && styles.heroThumbOn]}
                  />
                </TouchableOpacity>
              ))}
              {images.length > 4 && (
                <View style={[styles.heroThumb, styles.heroThumbMore]}>
                  <Text style={styles.heroThumbMoreText}>+{images.length - 4}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

          {/* Metadata, then the price as the largest thing on the page, then
              the title -- the approved build's hierarchy rule. It used to be
              coloured condition badges, an emoji date, title, then price. */}
          <View style={styles.headBlock}>
            <Text style={styles.kicker}>
              {`${product.condition || 'Used'}${(product as any).created_at ? ` · ${isRTL ? 'نُشر' : 'LISTED'} ${timeAgo((product as any).created_at)}` : ''}`.toUpperCase()}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{Math.round(Number(product.price)).toLocaleString('en-EG')}</Text>
              <Text style={styles.priceCurrency}>EGP</Text>
            </View>
            <Text style={styles.title}>{product.title}</Text>

            {(() => {
              const boost = getProductBoostInfo(product);
              if (!boost.isPromoted || !boost.pkg) return null;
              return (
                <View style={styles.promotedPill}>
                  <Text style={styles.promotedPillText}>{boost.pkg.badgeText.toUpperCase()}</Text>
                </View>
              );
            })()}
          </View>

          {/* Owner boost CTA -- kept (payments + non-iOS only, 3.1.3(g)), but
              restyled from a navy gradient card into a plain hairline row. */}
          {PAYMENTS_ENABLED && DIGITAL_PURCHASES_ENABLED && isOwner && (
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push(`/boost/${product.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.linkRowLeft}>
                <Sparkles size={18} color="#0F172A" />
                <Text style={styles.linkRowText}>{isRTL ? 'روّج هذا الإعلان' : 'Promote this listing'}</Text>
              </View>
              <ChevronRight size={16} color="#CBD5E1" />
            </TouchableOpacity>
          )}

          {/* ── Seller ── */}
          <TouchableOpacity
            style={styles.sellerRow}
            activeOpacity={0.8}
            onPress={() => product.seller_id && router.push(`/seller/${product.seller_id}` as any)}
          >
            {product.seller?.avatar_url ? (
              <Image source={{ uri: product.seller.avatar_url }} style={styles.sellerAvatar} />
            ) : (
              <View style={[styles.sellerAvatar, styles.sellerAvatarFallback]}>
                <Text style={styles.sellerInitial}>{sellerInitial}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
                {product.seller?.is_verified_seller && <ShieldCheck size={13} color="#059669" />}
              </View>
              <View style={styles.sellerMetaRow}>
                {!!replyBadge && (
                  <>
                    <View style={styles.greenDot} />
                    <Text style={styles.sellerTrust}>{replyBadge}</Text>
                    <Text style={styles.sellerDot}>·</Text>
                  </>
                )}
                {PAYMENTS_ENABLED && sellerRating?.rating_count ? (
                  <StarRating
                    value={sellerRating?.rating_avg ?? null}
                    count={sellerRating?.rating_count ?? 0}
                    size={12}
                    isRTL={isRTL}
                  />
                ) : (
                  <Text style={styles.sellerMetaText}>
                    {sellerListingsCount != null
                      ? (isRTL ? `${sellerListingsCount} إعلان` : `${sellerListingsCount} listing${sellerListingsCount === 1 ? '' : 's'}`)
                      : (isRTL ? 'بائع' : 'Seller')}
                  </Text>
                )}
              </View>
            </View>
            <ChevronRight color="#CBD5E1" size={18} />
          </TouchableOpacity>

          {/* ── Ask in one tap ── */}
          {!isOwner && (
            <View style={styles.askSection}>
              <Text style={styles.sectionKicker}>{isRTL ? 'اسأل في نقرة واحدة' : 'ASK IN ONE TAP'}</Text>
              <View style={styles.askRow}>
                <TouchableOpacity
                  style={styles.askChipPrimary}
                  disabled={askSending !== null}
                  onPress={() => handleAskChip(isRTL ? 'هل ما زال متاحاً؟' : 'Is it still available?')}
                >
                  {askSending ? <ActivityIndicator size="small" color="white" /> : (
                    <Text style={styles.askChipPrimaryText}>{isRTL ? 'هل ما زال متاحاً؟' : 'Is it still available?'}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.askChip} onPress={handleOpenOfferModal}>
                  <Text style={styles.askChipText}>
                    {isRTL
                      ? `هل تقبل ${Math.round(Number(product.price) * 0.9).toLocaleString('en-EG')}؟`
                      : `Would you take ${Math.round(Number(product.price) * 0.9).toLocaleString('en-EG')}?`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.askChip}
                  disabled={askSending !== null}
                  onPress={() => handleAskChip(isRTL ? 'هل يمكنني رؤيته اليوم؟' : 'Can I see it today?')}
                >
                  <Text style={styles.askChipText}>{isRTL ? 'هل يمكنني رؤيته اليوم؟' : 'Can I see it today?'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Data rows ──
              Location is a real string the seller typed on the sell form,
              parsed back out of the tag it was saved with. Distance is not
              shown -- see the note at the top of app/(tabs)/index.tsx. */}
          <View style={styles.dataRows}>
            <View style={styles.dataRow}>
              <Text style={styles.dataRowLabel}>{isRTL ? 'الحالة' : 'CONDITION'}</Text>
              <Text style={styles.dataRowValue}>{product.condition || 'Used'}</Text>
            </View>
            {!!locationTag && (
              <View style={styles.dataRow}>
                <Text style={styles.dataRowLabel}>{isRTL ? 'الموقع' : 'WHERE'}</Text>
                <Text style={styles.dataRowValue}>{locationTag}</Text>
              </View>
            )}
            <View style={styles.dataRow}>
              <Text style={styles.dataRowLabel}>{isRTL ? 'التسليم' : 'HANDOVER'}</Text>
              <Text style={styles.dataRowValue}>{isRTL ? 'مقابلة شخصية أو شحن' : 'Meet up, or shipping'}</Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowLast]}>
              <Text style={styles.dataRowLabel}>{isRTL ? 'المشاهدات' : 'VIEWS'}</Text>
              <Text style={styles.dataRowValue}>{product.view_count ?? 0}</Text>
            </View>
          </View>

          {/* Real active-listing range -- never sold-price history this app
              does not track (see getComparablePriceRange). */}
          {!!comparable && (
            <View style={styles.comparableBox}>
              <View style={styles.trustLine}>
                <View style={styles.greenDot} />
                <Text style={styles.trustLineText}>{isRTL ? 'ضمن نطاق السوق' : 'Priced in range'}</Text>
              </View>
              <Text style={styles.comparableText}>
                {isRTL
                  ? `${comparable.count} إعلان مشابه في ${product.category} يتراوح سعرها بين ${formatEGP(comparable.min)} و${formatEGP(comparable.max)} حالياً.`
                  : `${comparable.count} similar ${product.category} listings are currently priced between ${formatEGP(comparable.min)} and ${formatEGP(comparable.max)}.`}
              </Text>
            </View>
          )}

          {/* ── Description ── */}
          <View style={styles.descBlock}>
            <Text style={styles.description}>{cleanDescription || (isRTL ? 'لا يوجد وصف.' : 'No description provided.')}</Text>
          </View>

          {/* Reviews require a completed order, which cannot happen while
              payments are paused (see PLAN-CLASSIFIEDS-MODE.md). */}
          {PAYMENTS_ENABLED && (
            <View style={styles.reviewsBlock}>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>{isRTL ? 'التقييمات' : 'Reviews'}</Text>
                {productReviews.length > 0 && <Text style={styles.sectionCount}>{productReviews.length}</Text>}
              </View>
              <ReviewList
                reviews={productReviews}
                isRTL={isRTL}
                emptyText={isRTL ? 'لا توجد تقييمات على هذا المنتج بعد.' : 'No reviews on this item yet.'}
              />
            </View>
          )}

          {/* ── Others like this ── */}
          {similarProducts.length > 0 && (
            <View style={styles.similarSection}>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>{isRTL ? 'إعلانات مشابهة' : 'Others like this'}</Text>
                <TouchableOpacity onPress={() => router.push(`/products?category=${encodeURIComponent(product.category)}` as any)}>
                  <Text style={styles.seeAll}>{isRTL ? 'عرض الكل' : 'See all'}</Text>
                </TouchableOpacity>
              </View>
              {similarProducts.slice(0, 4).map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.similarRow}
                  onPress={() => router.push(`/products/${item.id}` as any)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: item.images?.[0] || 'https://placehold.co/300x300/F1F5F9/64748B?text=Item' }}
                    style={styles.similarThumb}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.similarTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.similarMeta} numberOfLines={1}>{item.category}</Text>
                  </View>
                  <Text style={styles.similarPrice}>{Math.round(item.price).toLocaleString('en-EG')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Safety + report, the two quiet links the design ends on. */}
          <TouchableOpacity style={styles.quietLink} onPress={() => router.push('/safety' as any)} activeOpacity={0.7}>
            <ShieldAlert size={14} color="#94A3B8" />
            <Text style={styles.quietLinkText}>{isRTL ? 'نصائح للبيع والشراء بأمان' : 'Safety tips for buying and selling'}</Text>
          </TouchableOpacity>

          {/* Guideline 1.2: writes a content_reports row; no "submitted" toast
              unless the RPC actually resolved. */}
          <TouchableOpacity
            style={styles.quietLink}
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
                isRTL ? 'ما سبب الإبلاغ؟' : 'Why are you reporting it?',
                [
                  { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                  ...['Prohibited item', 'Scam or fraud', 'Misleading listing', 'Offensive content'].map(reason => ({
                    text: reason,
                    onPress: () => send(reason),
                  })),
                ],
              );
            }}
            activeOpacity={0.7}
          >
            <Flag size={14} color="#94A3B8" />
            <Text style={styles.quietLinkText}>{isRTL ? 'الإبلاغ عن مخالفة' : 'Report this listing'}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Bottom bar: one ink action, one outlined circle ──
            The price is no longer repeated here: it is the largest thing at
            the top of the page, per the approved build's hierarchy rule. */}
        <View style={styles.bottomBar}>
          {isOwner ? (
            <TouchableOpacity
              style={styles.primaryPill}
              onPress={() => router.push(`/products/edit/${product.id}` as any)}
              activeOpacity={0.9}
            >
              <Edit3 size={18} color="white" />
              <Text style={styles.primaryPillText}>{isRTL ? 'تعديل الإعلان' : 'Edit listing'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryPill}
                onPress={PAYMENTS_ENABLED ? handleBuyNow : handleContact}
                disabled={isBuying}
                activeOpacity={0.9}
              >
                {isBuying ? (
                  <ActivityIndicator color="white" size="small" />
                ) : PAYMENTS_ENABLED ? (
                  <>
                    <ShoppingBag size={18} color="white" />
                    <Text style={styles.primaryPillText}>{isRTL ? 'اشترِ الآن' : 'Buy now'}</Text>
                  </>
                ) : (
                  <>
                    <MessageCircle size={18} color="white" />
                    <Text style={styles.primaryPillText}>
                      {isRTL ? `راسل ${sellerName.split(' ')[0]}` : `Message ${sellerName.split(' ')[0]}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {PAYMENTS_ENABLED && (
                <TouchableOpacity style={styles.circleOutline} onPress={handleContact} activeOpacity={0.85}>
                  <MessageCircle size={20} color="#0F172A" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.circleOutline} onPress={handleOpenOfferModal} activeOpacity={0.85}>
                <Tag size={20} color="#0F172A" />
              </TouchableOpacity>
            </>
          )}
        </View>


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
              style={[styles.sendOfferBtn, styles.sendOfferGradient]}
              onPress={handleSendOffer}
              disabled={isSendingOffer}
              activeOpacity={0.85}
            >
              {isSendingOffer ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Tag size={18} color="white" />
                  <Text style={styles.sendOfferText}>{t('products.sendOffer')}</Text>
                </>
              )}
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
  // ── Approved build (3a) ──────────────────────────────────────────────
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  pageWrapper: { flex: 1, width: '100%', alignSelf: 'center' },

  hero: { position: 'relative', backgroundColor: '#E2E8F0' },
  heroImage: { resizeMode: 'cover' },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBack: { position: 'absolute', top: 56, left: 16 },
  heroTopRight: { position: 'absolute', top: 56, right: 16, flexDirection: 'row', gap: 8 },
  heroThumbs: { position: 'absolute', left: 16, bottom: 12, flexDirection: 'row', gap: 8 },
  heroThumb: { width: 52, height: 52, borderRadius: 10, opacity: 0.85, backgroundColor: '#CBD5E1' },
  heroThumbOn: { opacity: 1, borderWidth: 2, borderColor: '#FFFFFF' },
  heroThumbMore: { backgroundColor: 'rgba(15,23,42,0.72)', alignItems: 'center', justifyContent: 'center', opacity: 1 },
  heroThumbMoreText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  headBlock: { paddingHorizontal: 20, paddingTop: 20 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#94A3B8' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  price: { fontSize: 40, fontWeight: '800', letterSpacing: -2, color: '#0F172A', lineHeight: 42 },
  priceCurrency: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  title: { fontSize: 19, fontWeight: '600', color: '#0F172A', lineHeight: 26, marginTop: 10 },
  promotedPill: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F1F5F9' },
  promotedPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#0F172A' },

  linkRow: {
    marginHorizontal: 20, marginTop: 18, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  linkRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkRowText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },

  sellerRow: {
    marginHorizontal: 20, marginTop: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
  sellerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { fontSize: 17, fontWeight: '800', color: '#64748B' },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sellerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  sellerTrust: { fontSize: 12, fontWeight: '700', color: '#059669' },
  sellerDot: { color: '#CBD5E1' },
  sellerMetaText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },

  askSection: { paddingHorizontal: 20, paddingTop: 16 },
  sectionKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#94A3B8', marginBottom: 10 },
  askRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  askChipPrimary: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  askChipPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  askChip: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  askChipText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  dataRows: { marginHorizontal: 20, marginTop: 20 },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  dataRowLast: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  dataRowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#94A3B8' },
  dataRowValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  comparableBox: { marginHorizontal: 20, marginTop: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14 },
  trustLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustLineText: { fontSize: 13, fontWeight: '800', color: '#059669' },
  comparableText: { fontSize: 13, color: '#475569', lineHeight: 19, marginTop: 6 },

  descBlock: { padding: 20 },
  description: { fontSize: 15, color: '#475569', lineHeight: 24 },

  reviewsBlock: { paddingHorizontal: 20, paddingBottom: 8 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },
  sectionCount: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  seeAll: { fontSize: 13, fontWeight: '700', color: '#2563EB' },

  similarSection: { paddingHorizontal: 20, paddingBottom: 8 },
  similarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  similarThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#E2E8F0' },
  similarTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  similarMeta: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  similarPrice: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },

  quietLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  quietLinkText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },

  bottomBar: {
    borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  primaryPill: {
    flex: 1, height: 52, borderRadius: 999, backgroundColor: '#0F172A',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  primaryPillText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  circleOutline: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Retained: modals and loading ─────────────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },


  // Carousel


  // Content

  // Boost & Promoted styles




  // Seller card




  // Guarantee Card

  // Delivery Section

  // Location badge

  // Trust badges

  // Safety Card




  // Description

  // Similar Products

  // Report Listing (Apple UGC)

  // Safety tips link (below seller card)

  // Bottom sticky bar

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
    // Approved build: no gradients -- ink, the same action colour as the
    // rest of the app. This used to be #7C3AED -> #2563EB, one of the
    // colours the design explicitly retires.
    backgroundColor: '#0F172A',
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
