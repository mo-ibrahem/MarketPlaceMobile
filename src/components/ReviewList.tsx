import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { StarRating } from './StarRating';
import type { Review } from '../services/lib/reviewService';

function initials(name?: string) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function relativeDate(iso: string, isRTL: boolean) {
  const d = new Date(iso);
  return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ReviewRow({ review, isRTL }: { review: Review; isRTL: boolean }) {
  return (
    <View style={s.row}>
      <View style={s.head}>
        {review.reviewer_avatar ? (
          <Image source={{ uri: review.reviewer_avatar }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{initials(review.reviewer_name)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>
            {review.reviewer_name || (isRTL ? 'مشتري' : 'Buyer')}
          </Text>
          <View style={s.metaRow}>
            <StarRating value={review.rating} count={1} size={12} showNumber={false} isRTL={isRTL} />
            <Text style={s.date}>{relativeDate(review.created_at, isRTL)}</Text>
            {review.edited_at && <Text style={s.edited}>{isRTL ? '(مُعدّل)' : '(edited)'}</Text>}
          </View>
        </View>
      </View>

      {!!review.comment && <Text style={s.comment}>{review.comment}</Text>}

      {!!review.seller_response && (
        <View style={s.response}>
          <Text style={s.responseLabel}>{isRTL ? 'ردّ البائع' : "Seller's response"}</Text>
          <Text style={s.responseText}>{review.seller_response}</Text>
        </View>
      )}
    </View>
  );
}

export function ReviewList({
  reviews,
  isRTL,
  emptyText,
}: {
  reviews: Review[];
  isRTL: boolean;
  emptyText?: string;
}) {
  if (reviews.length === 0) {
    return (
      <Text style={s.empty}>
        {emptyText || (isRTL ? 'لا توجد تقييمات بعد.' : 'No reviews yet.')}
      </Text>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {reviews.map(r => (
        <ReviewRow key={r.id} review={r} isRTL={isRTL} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  name: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  date: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  edited: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  comment: { fontSize: 13, lineHeight: 20, color: '#475569' },
  response: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, borderLeftWidth: 3, borderLeftColor: '#3B82F6', gap: 3 },
  responseLabel: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  responseText: { fontSize: 12, lineHeight: 18, color: '#475569' },
  empty: { fontSize: 13, color: '#94A3B8', fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
});
