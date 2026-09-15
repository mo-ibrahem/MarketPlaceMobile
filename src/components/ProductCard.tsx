import { Heart, MessageCircle } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { color, font, radius, space, tapSlop, weight } from '../design/tokens';
import type { Product } from '../services/lib/products';

export function formatEGP(price: number | string): string {
  return `EGP ${Math.round(Number(price)).toLocaleString('en-EG')}`;
}

/**
 * The one product card -- approved build (Egbay Approved Build.dc.html, 7a).
 *
 * The photograph sits on the page, not inside a grey rounded container: the
 * design's separation rule is hairlines and whitespace, never a card that
 * carries a border, a shadow and a radius at once. Under it the order is
 * fixed and deliberate -- the price is the largest thing on the row, the
 * title is second, and metadata is small mono so it reads as data and never
 * competes. The old card had the title first and the price in a footer.
 *
 * `askLabel` is the tap-to-send question chip the design puts on every
 * listing surface. It sends the message; it never opens an empty composer,
 * so the card takes a handler rather than navigating.
 */
export function ProductCard({
  item,
  isWishlisted,
  onPress,
  onToggleWishlist,
  variant = 'grid',
  width,
  imageHeight,
  metaRight,
  trustLine,
  askLabel,
  onAsk,
}: {
  item: Product;
  isWishlisted?: boolean;
  onPress: () => void;
  onToggleWishlist?: () => void;
  variant?: 'grid' | 'carousel';
  width?: number;
  /** Masonry feeds pass alternating heights so lanes get visual rhythm. */
  imageHeight?: number;
  /** Small mono, right of the price. Real data only -- the mockup's "2.1 KM"
   *  has no equivalent here (this app has no location data at all), so this
   *  carries the condition, or nothing. */
  metaRight?: string;
  /** A real, computed signal under the title -- "3 asking about it",
   *  "Replies fast". Never shown without real data behind it. */
  trustLine?: string;
  /** Tap-to-send question chip. Rendered only when both are supplied. */
  askLabel?: string;
  onAsk?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[variant === 'carousel' && s.cardCarousel, !!width && { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={s.imgWrap}>
        <Image
          source={{ uri: item.images?.[0] || 'https://placehold.co/400x300/F1F5F9/64748B?text=Item' }}
          style={[s.img, !!imageHeight && { height: imageHeight }]}
        />
        {/* Without an ask chip the heart still needs a home: a quiet circle
            on the photo, the only thing the design floats over an image. */}
        {!askLabel && !!onToggleWishlist && (
          <TouchableOpacity style={s.heartOnPhoto} onPress={onToggleWishlist} hitSlop={tapSlop(32)}>
            <Heart
              size={15}
              color={isWishlisted ? color.danger : color.text}
              fill={isWishlisted ? color.danger : 'none'}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.priceRow}>
        <Text style={s.price}>{Math.round(Number(item.price)).toLocaleString('en-EG')}</Text>
        {!!metaRight && <Text style={s.meta}>{metaRight.toUpperCase()}</Text>}
      </View>

      <Text style={s.title} numberOfLines={2}>{item.title}</Text>

      {!!trustLine && (
        <View style={s.trustRow}>
          <View style={s.trustDot} />
          <Text style={s.trustText} numberOfLines={1}>{trustLine}</Text>
        </View>
      )}

      {!!askLabel && !!onAsk && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.askPill} onPress={onAsk} activeOpacity={0.85}>
            <Text style={s.askPillText} numberOfLines={1}>{askLabel}</Text>
          </TouchableOpacity>
          {!!onToggleWishlist && (
            <TouchableOpacity style={s.heartCircle} onPress={onToggleWishlist} hitSlop={tapSlop(36)}>
              <Heart
                size={16}
                color={isWishlisted ? color.danger : color.text}
                fill={isWishlisted ? color.danger : 'none'}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * The lead listing on the quiet home state (7b): two photographs side by
 * side, the same hierarchy at a larger size, then the ask chip beside the
 * heart, closed by a hairline.
 */
export function FeaturedProductCard({
  item,
  isWishlisted,
  onPress,
  onToggleWishlist,
  onAsk,
  askLabel,
  trustLine,
  metaRight,
  width,
}: {
  item: Product;
  isWishlisted?: boolean;
  onPress: () => void;
  onToggleWishlist?: () => void;
  onAsk: () => void;
  askLabel: string;
  trustLine?: string;
  metaRight?: string;
  width: number;
}) {
  const photos = (item.images ?? []).filter(Boolean).slice(0, 2);
  const tile = (width - 10) / 2;
  return (
    <TouchableOpacity style={{ width }} onPress={onPress} activeOpacity={0.92}>
      <View style={s.featuredPhotos}>
        {(photos.length ? photos : [undefined]).map((uri, i) => (
          <Image
            key={i}
            source={{ uri: uri || 'https://placehold.co/400x400/F1F5F9/64748B?text=Item' }}
            style={[s.featuredPhoto, { width: photos.length > 1 ? tile : width, height: tile }]}
          />
        ))}
      </View>

      <View style={s.featuredPriceRow}>
        <Text style={s.featuredPrice}>{Math.round(Number(item.price)).toLocaleString('en-EG')}</Text>
        <Text style={s.meta}>{`EGP${metaRight ? ` · ${metaRight}` : ''}`.toUpperCase()}</Text>
      </View>

      <Text style={s.featuredTitle} numberOfLines={2}>{item.title}</Text>

      {!!trustLine && (
        <View style={[s.trustRow, { marginTop: 8 }]}>
          <View style={s.trustDotLg} />
          <Text style={s.trustTextLg} numberOfLines={1}>{trustLine}</Text>
        </View>
      )}

      <View style={s.featuredActionRow}>
        <TouchableOpacity style={s.featuredAskPill} onPress={onAsk} activeOpacity={0.85}>
          <MessageCircle size={16} color={color.textInverse} />
          <Text style={s.featuredAskText} numberOfLines={1}>{askLabel}</Text>
        </TouchableOpacity>
        {!!onToggleWishlist && (
          <TouchableOpacity style={s.featuredHeart} onPress={onToggleWishlist} hitSlop={tapSlop(44)}>
            <Heart
              size={18}
              color={isWishlisted ? color.danger : color.text}
              fill={isWishlisted ? color.danger : 'none'}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cardCarousel: { width: 180 },

  imgWrap: { position: 'relative', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.border },
  img: { width: '100%', height: 190 },

  heartOnPhoto: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 },
  price: { fontSize: 19, fontWeight: weight.heavy, letterSpacing: -0.8, color: color.text },
  meta: { fontSize: 10, fontWeight: weight.bold, letterSpacing: 0.6, color: color.textFaint },
  title: { fontSize: font.footnote, fontWeight: weight.semibold, color: color.text, lineHeight: 17, marginTop: 3 },

  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  trustDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.success },
  trustText: { fontSize: font.caption2, fontWeight: weight.bold, color: color.successDark },
  trustDotLg: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
  trustTextLg: { fontSize: font.caption, fontWeight: weight.bold, color: color.successDark },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  askPill: {
    flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: color.action,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },
  askPillText: { fontSize: 12.5, fontWeight: weight.heavy, color: color.textInverse },
  heartCircle: {
    width: 36, height: 36, borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center',
  },

  featuredPhotos: { flexDirection: 'row', gap: 10 },
  featuredPhoto: { borderRadius: radius.md, backgroundColor: color.border },
  featuredPriceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 },
  featuredPrice: { fontSize: 30, fontWeight: weight.heavy, letterSpacing: -1.5, color: color.text, lineHeight: 32 },
  featuredTitle: { fontSize: font.callout, fontWeight: weight.semibold, color: color.text, lineHeight: 22, marginTop: 6 },
  featuredActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  featuredAskPill: {
    flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: color.action,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  featuredAskText: { fontSize: 14, fontWeight: weight.heavy, color: color.textInverse },
  featuredHeart: {
    width: 44, height: 44, borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
});
