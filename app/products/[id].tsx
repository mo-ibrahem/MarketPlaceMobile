import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Heart,
  MessageCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { getOrCreateChatRoom } from '../../src/services/lib/chatService';
import { productService, type Product } from '../../src/services/lib/products';
import { supabase } from '../../src/services/lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  const [product,     setProduct]     = useState<Product | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [isBuying,    setIsBuying]    = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Heart scale animation
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (id) loadProduct();
  }, [id, user]);

  const loadProduct = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await productService.getProductById(id);
      setProduct(data);
      setIsWishlisted(data?.isWishlisted ?? false);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load product.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleBuyNow = async () => {
    if (!user || !product) {
      Toast.show({ type: 'error', text1: 'Please log in to purchase.' }); return;
    }
    setIsBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-key', {
        body: {
          product:     { id: product.id, title: product.title, description: product.description, price: product.price },
          userProfile: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || 'N/A', phone: user.phone || '0123456789' },
        },
      });
      if (error) throw error;
      router.push(`/payment?paymentToken=${data.paymentToken}` as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Payment Error', text2: e.message });
    } finally {
      setIsBuying(false);
    }
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
      const roomId = await getOrCreateChatRoom(product.seller_id);
      router.push(`/chat/${roomId}`);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not start chat.' });
    }
  };

  const handleShare = async () => {
    if (!product) return;
    await Share.share({ message: `Check out "${product.title}" on Egbay!` });
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
  const sellerName    = product.seller?.full_name ?? 'Seller';
  const sellerInitial = sellerName.charAt(0).toUpperCase();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>

      {/* ── Image carousel (full-width) ── */}
      <View style={styles.carousel}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          onMomentumScrollEnd={e => {
            setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
          }}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.carouselImage} />
          )}
        />

        {/* Gradient top overlay for back/share/heart visibility */}
        <LinearGradient
          colors={['rgba(0,0,0,0.48)', 'transparent']}
          style={styles.carouselTopGradient}
        />

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft color="white" size={22} />
        </TouchableOpacity>

        {/* Share + Wishlist (top right) */}
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.overlayBtn} onPress={handleShare}>
            <Share2 color="white" size={18} />
          </TouchableOpacity>
          {!isOwner && (
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <TouchableOpacity style={styles.overlayBtn} onPress={handleWishlist}>
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
          {/* Title row + badges */}
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
          <Text style={styles.price}>${Number(product.price).toFixed(2)}</Text>

          {/* ── Seller card ── */}
          <TouchableOpacity style={styles.sellerCard} activeOpacity={0.85}>
            <View style={styles.sellerAvatarWrap}>
              {product.seller?.avatar_url ? (
                <Image source={{ uri: product.seller.avatar_url }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarFallback}>
                  <Text style={styles.sellerInitial}>{sellerInitial}</Text>
                </View>
              )}
              <View style={styles.sellerOnlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{sellerName}</Text>
              <View style={styles.sellerMeta}>
                <ShieldCheck size={12} color="#10B981" />
                <Text style={styles.sellerMetaText}>Verified Seller</Text>
                <Text style={styles.sellerDot}>·</Text>
                <ShoppingBag size={12} color="#94A3B8" />
                <Text style={styles.sellerMetaText}>Egypt</Text>
              </View>
            </View>
            <ChevronRight color="#CBD5E1" size={18} />
          </TouchableOpacity>

          {/* Trust badges */}
          <View style={styles.trustRow}>
            <TrustBadge icon="🛡️" label="Secure Pay" />
            <TrustBadge icon="🔄" label="Easy Returns" />
            <TrustBadge icon="📦" label="Fast Delivery" />
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description}>
            {product.description || 'No description provided.'}
          </Text>

          {/* Bottom spacer for sticky bar */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ── Sticky bottom CTA bar ── */}
      <View style={styles.bottomBar}>
        {isOwner ? (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaEdit]}
            onPress={() => router.push(`/products/edit/${product.id}` as any)}
          >
            <Edit3 size={18} color="white" />
            <Text style={styles.ctaBtnText}>Edit Listing</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ctaRow}>
            <TouchableOpacity style={[styles.ctaBtn, styles.ctaContact]} onPress={handleContact}>
              <MessageCircle size={18} color="#6366F1" />
              <Text style={[styles.ctaBtnText, { color: '#6366F1' }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaBuy, { flex: 2 }]}
              onPress={handleBuyNow}
              disabled={isBuying}
            >
              {isBuying ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <ShoppingBag size={18} color="white" />
                  <Text style={styles.ctaBtnText}>Buy Now · ${Number(product.price).toFixed(2)}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Trust Badge ──────────────────────────────────────────────────────────────

function TrustBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.trustBadge}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  // Carousel
  carousel: { width: SCREEN_W, height: SCREEN_W * 0.85, backgroundColor: '#1E293B', position: 'relative' },
  carouselImage: { width: SCREEN_W, height: SCREEN_W * 0.85, resizeMode: 'cover' },
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
    left: SCREEN_W / 2 - 30,
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

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeNew: { backgroundColor: '#D1FAE5' },
  badgeUsed: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextNew: { color: '#065F46' },
  badgeTextUsed: { color: '#92400E' },
  listedDate: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', lineHeight: 30, marginBottom: 8 },
  price: { fontSize: 30, fontWeight: '800', color: '#2563EB', marginBottom: 20, letterSpacing: -0.5 },

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
  sellerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerMetaText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  sellerDot: { color: '#CBD5E1', fontSize: 12 },

  // Trust badges
  trustRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
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
  trustLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textAlign: 'center' },

  // Description
  sectionLabel: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  description: { fontSize: 15, color: '#475569', lineHeight: 24 },

  // Bottom sticky bar
  bottomBar: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flex: 1,
  },
  ctaBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  ctaContact: { backgroundColor: '#EEF2FF', flex: 1 },
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
});