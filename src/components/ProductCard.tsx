import { Heart, MapPin, ShieldCheck, Star } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { color, font, radius, shadow, space, tapSlop, weight } from '../design/tokens';
import { displayName } from '../services/lib/displayName';
import type { Product } from '../services/lib/products';

export function formatEGP(price: number | string): string {
  return `EGP ${Math.round(Number(price)).toLocaleString('en-EG')}`;
}

/**
 * The one product card.
 *
 * There were two implementations -- one in app/products.tsx and one inlined in
 * the home feed -- with separate styles that had already drifted apart (only
 * one showed a location, they used different heart sizes and price pills, and
 * the hardcoded "4.9" rating had to be removed from each of them separately).
 * A card is the single most repeated object in a marketplace; it should exist
 * once.
 *
 * `variant` covers the two shapes actually needed: a grid tile, and a narrower
 * tile for horizontal carousels.
 */
export function ProductCard({
  item,
  isWishlisted,
  onPress,
  onToggleWishlist,
  variant = 'grid',
  width,
  imageHeight,
  showEscrow = false,
}: {
  item: Product;
  isWishlisted?: boolean;
  onPress: () => void;
  onToggleWishlist?: () => void;
  variant?: 'grid' | 'carousel';
  width?: number;
  /** Masonry feeds pass alternating heights so lanes get visual rhythm. */
  imageHeight?: number;
  /** Escrow lives on the product, not in a strip above the feed. */
  showEscrow?: boolean;
}) {
  const rating = item.seller?.rating_count ? item.seller : null;

  return (
    <TouchableOpacity
      style={[s.card, variant === 'carousel' && s.cardCarousel, !!width && { width }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={s.imgWrap}>
        <Image
          source={{ uri: item.images?.[0] || 'https://placehold.co/400x300/F1F5F9/64748B?text=Item' }}
          style={[s.img, !!imageHeight && { height: imageHeight }]}
        />
        {showEscrow && (
          <View style={s.escrowChip}>
            <ShieldCheck size={12} color={color.successDark} />
            <Text style={s.escrowText}>Escrow</Text>
          </View>
        )}

        {!!onToggleWishlist && (
          <TouchableOpacity style={s.heart} onPress={onToggleWishlist} hitSlop={tapSlop(32)}>
            <Heart
              size={16}
              color={isWishlisted ? color.danger : color.text}
              fill={isWishlisted ? color.danger : 'none'}
            />
          </TouchableOpacity>
        )}

        {item.condition === 'New' && (
          <View style={s.newBadge}>
            <Text style={s.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={s.body}>
        <View style={s.metaRow}>
          {rating ? (
            <View style={s.ratingPill}>
              <Star color={color.warning} fill={color.warning} size={11} />
              <Text style={s.ratingText}>
                {Number(rating.rating_avg ?? 0).toFixed(1)}
                <Text style={s.ratingCount}> ({rating.rating_count})</Text>
              </Text>
            </View>
          ) : (
            <Text style={s.sellerName} numberOfLines={1}>
              {displayName(item.seller?.full_name, 'Seller')}
            </Text>
          )}
        </View>

        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        {/* Price below the image as plain left-aligned text, the way every
            reference does it -- not floated over the photograph in a pill,
            where it fights the product for attention. It is also the last
            thing in the card, so it is the last thing read. */}
        <Text style={s.price}>{formatEGP(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // The image is the card. No white frame around the photo, no border, no
  // shadow -- separation comes from the neutral image ground against the white
  // page, which is how all five references do it.
  card: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardCarousel: { flex: 0, width: 180 },

  imgWrap: {
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.surfaceAlt,
  },
  img: { width: '100%', height: 200, backgroundColor: color.surfaceAlt },

  // Price is the single most important number on a marketplace card, and it
  // was set at 11pt -- the smallest size in the system -- inside a small pill.
  // It now reads as the price.
  pricePill: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    backgroundColor: 'rgba(15,23,42,0.82)',
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  priceText: { color: color.textInverse, fontSize: font.subhead, fontWeight: weight.heavy, letterSpacing: -0.3 },

  heart: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  escrowChip: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  escrowText: { fontSize: font.caption2, fontWeight: weight.heavy, color: color.text },
  newBadge: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  newBadgeText: { color: color.text, fontSize: font.caption2, fontWeight: weight.heavy, letterSpacing: 0.3 },

  body: { paddingTop: space.sm + 2, gap: 2 },
  /**
   * A fixed two-line box, not `numberOfLines` alone.
   *
   * With a flexible height, a listing whose title wrapped to two lines made its
   * card taller than its neighbour, so prices in the same row sat on different
   * baselines and the grid looked broken. Reserving both lines always costs one
   * empty line on short titles and buys an aligned grid, which is the trade
   * every reference makes.
   */
  title: {
    fontSize: font.subhead,
    fontWeight: weight.medium,
    color: color.textSecondary,
    lineHeight: 19,
    height: 38,
  },
  price: { fontSize: font.callout, fontWeight: weight.heavy, color: color.text, letterSpacing: -0.4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 16 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: color.warningSoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ratingText: { fontSize: font.caption2, fontWeight: weight.heavy, color: color.warningDark },
  ratingCount: { fontSize: font.caption2, fontWeight: weight.bold, color: color.warningDark },
  condition: { fontSize: font.caption2, fontWeight: weight.semibold, color: color.textMuted },

  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.caption2, fontWeight: weight.heavy, color: color.primary },
  sellerName: { flex: 1, fontSize: font.caption2, color: color.textFaint, fontWeight: weight.semibold },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  location: { flex: 1, fontSize: font.caption2, color: color.textMuted },
});
