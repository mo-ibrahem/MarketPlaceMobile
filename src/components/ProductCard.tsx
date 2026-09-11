import { Heart, ShieldCheck } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { color, font, radius, shadow, space, tapSlop, weight } from '../design/tokens';
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
  return (
    <TouchableOpacity
      style={[s.card, variant === 'carousel' && s.cardCarousel, !!width && { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* One surface holds both the photo and the text, so the card is a
          single object. Previously the image was a rounded block and the text
          floated beneath it on the page background; each card read as two
          loose things, which is what made the feed look scattered. */}
      <View style={s.imgWrap}>
        <Image
          source={{ uri: item.images?.[0] || 'https://placehold.co/400x300/F1F5F9/64748B?text=Item' }}
          style={[s.img, !!imageHeight && { height: imageHeight }]}
        />
        {!!onToggleWishlist && (
          <TouchableOpacity style={s.heart} onPress={onToggleWishlist} hitSlop={tapSlop(32)}>
            <Heart
              size={15}
              color={isWishlisted ? color.danger : color.text}
              fill={isWishlisted ? color.danger : 'none'}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        <View style={s.footer}>
          <Text style={s.price}>{formatEGP(item.price)}</Text>
          {/* Condition and escrow moved off the photograph into a quiet
              footer line, so the image carries only the heart. */}
          <View style={s.tags}>
            {item.condition === 'New' && <Text style={s.tag}>New</Text>}
            {showEscrow && (
              <View style={s.escrow}>
                <ShieldCheck size={11} color={color.successDark} />
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.lg,
    padding: 6,
    overflow: 'hidden',
  },
  cardCarousel: { width: 180 },

  imgWrap: {
    position: 'relative',
    borderRadius: radius.lg - 4,
    overflow: 'hidden',
    backgroundColor: color.border,
  },
  img: { width: '100%', height: 190 },

  heart: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8, gap: 4 },
  title: {
    fontSize: font.subhead - 1,
    fontWeight: weight.semibold,
    color: color.text,
    lineHeight: 18,
    height: 36,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: font.callout, fontWeight: weight.heavy, color: color.text, letterSpacing: -0.4 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { fontSize: font.caption2, fontWeight: weight.bold, color: color.textMuted },
  escrow: {
    width: 20, height: 20, borderRadius: radius.pill,
    backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center',
  },
});
