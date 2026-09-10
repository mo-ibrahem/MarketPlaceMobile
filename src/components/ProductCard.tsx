import { Heart, MapPin, Star } from 'lucide-react-native';
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
}: {
  item: Product;
  isWishlisted?: boolean;
  onPress: () => void;
  onToggleWishlist?: () => void;
  variant?: 'grid' | 'carousel';
  width?: number;
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
          style={s.img}
        />

        <View style={s.pricePill}>
          <Text style={s.priceText}>{formatEGP(item.price)}</Text>
        </View>

        {!!onToggleWishlist && (
          <TouchableOpacity style={s.heart} onPress={onToggleWishlist} hitSlop={tapSlop(32)}>
            <Heart
              size={14}
              color={isWishlisted ? color.danger : color.textInverse}
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
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>

        {/* Rating shows the seller's real aggregate, or nothing at all. It is
            never invented -- both cards previously hardcoded "4.9". */}
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
            <View />
          )}
          <Text style={s.condition}>{item.condition || 'Used'}</Text>
        </View>

        <View style={s.sellerRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {displayName(item.seller?.full_name, 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={s.sellerName} numberOfLines={1}>
            {displayName(item.seller?.full_name, 'Seller')}
          </Text>
        </View>

        {!!(item as any).location && (
          <View style={s.locationRow}>
            <MapPin size={11} color={color.textMuted} />
            <Text style={s.location} numberOfLines={1}>{(item as any).location}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    ...shadow.card,
  },
  cardCarousel: { flex: 0, width: 168 },

  imgWrap: { position: 'relative' },
  img: { width: '100%', height: 140, backgroundColor: color.surfaceAlt },

  pricePill: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    backgroundColor: color.primary,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  priceText: { color: color.textInverse, fontSize: font.caption2, fontWeight: weight.heavy },

  heart: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newBadge: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    backgroundColor: color.success,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  newBadgeText: { color: color.textInverse, fontSize: font.caption2, fontWeight: weight.heavy },

  body: { padding: space.md, gap: space.xs },
  title: { fontSize: font.footnote, fontWeight: weight.bold, color: color.text, lineHeight: 18 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  sellerName: { flex: 1, fontSize: font.caption2, color: color.textFaint, fontWeight: weight.medium },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  location: { flex: 1, fontSize: font.caption2, color: color.textMuted },
});
