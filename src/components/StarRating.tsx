import { Star } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Read-only star display. `value` is the aggregate average, so it is rendered
 * to the nearest half rather than rounded up -- a 3.4 seller must not look
 * like a 4-star seller.
 */
export function StarRating({
  value,
  size = 14,
  count,
  showNumber = true,
  isRTL = false,
}: {
  value: number | null;
  size?: number;
  count?: number;
  showNumber?: boolean;
  isRTL?: boolean;
}) {
  if (value == null || !count) {
    return (
      <Text style={[styles.muted, { fontSize: size - 2 }]}>
        {isRTL ? 'لا توجد تقييمات بعد' : 'No ratings yet'}
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        return (
          <Star
            key={i}
            size={size}
            color={filled || half ? '#F59E0B' : '#CBD5E1'}
            fill={filled ? '#F59E0B' : half ? '#FDE68A' : 'transparent'}
          />
        );
      })}
      {showNumber && (
        <Text style={[styles.number, { fontSize: size - 1 }]}>
          {value.toFixed(1)}
          <Text style={styles.muted}> ({count})</Text>
        </Text>
      )}
    </View>
  );
}

/** Tappable 1-5 picker for the review form. */
export function StarPicker({
  value,
  onChange,
  size = 34,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <View style={styles.pickerRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity
          key={i}
          disabled={disabled}
          onPress={() => onChange(i)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === i }}
          accessibilityLabel={`${i} star${i === 1 ? '' : 's'}`}
        >
          <Star
            size={size}
            color={i <= value ? '#F59E0B' : '#CBD5E1'}
            fill={i <= value ? '#F59E0B' : 'transparent'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  number: { fontWeight: '800', color: '#0F172A', marginLeft: 4 },
  muted: { color: '#94A3B8', fontWeight: '600' },
});
