import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { StarPicker } from './StarRating';
import {
  REVIEW_COMMENT_MAX,
  editReview,
  submitReview,
  type Review,
} from '../services/lib/reviewService';

/**
 * The form is only rendered when canReviewOrder() allows it, but every rule it
 * mirrors is still enforced inside submit_review. If the RPC rejects, the real
 * server message is shown rather than a generic one -- and nothing is reported
 * as saved unless the RPC actually returned.
 */
export function ReviewForm({
  orderId,
  existing,
  isRTL,
  onSaved,
}: {
  orderId: string;
  existing?: Review | null;
  isRTL: boolean;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!existing;
  const tooLong = comment.length > REVIEW_COMMENT_MAX;
  const canSubmit = rating >= 1 && rating <= 5 && !tooLong && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await editReview(existing!.id, rating, comment.trim());
      } else {
        await submitReview(orderId, rating, comment.trim());
      }
      // Only claimed after the RPC returned without error.
      Toast.show({
        type: 'success',
        text1: isEdit
          ? (isRTL ? 'تم تحديث تقييمك' : 'Review updated')
          : (isRTL ? 'تم إرسال تقييمك' : 'Review submitted'),
        text2: isRTL ? 'شكراً لمساعدتك المشترين الآخرين.' : 'Thanks for helping other buyers.',
      });
      onSaved();
    } catch (err: any) {
      // Surface the server's own reason (window closed, already reviewed,
      // not the buyer) instead of inventing one.
      setError(err?.message || (isRTL ? 'تعذّر حفظ التقييم.' : 'Could not save your review.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.title}>
        {isEdit
          ? (isRTL ? 'عدّل تقييمك' : 'Edit your review')
          : (isRTL ? 'كيف كانت تجربتك؟' : 'How was your purchase?')}
      </Text>
      <Text style={s.sub}>
        {isRTL ? 'تقييمك يساعد المشترين الآخرين على الثقة بالبائع.' : 'Your rating helps other buyers trust this seller.'}
      </Text>

      <StarPicker value={rating} onChange={setRating} disabled={saving} />

      <TextInput
        style={[s.input, tooLong && s.inputError]}
        placeholder={isRTL ? 'اكتب رأيك (اختياري)' : 'Add a comment (optional)'}
        placeholderTextColor="#94A3B8"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
        editable={!saving}
        textAlign={isRTL ? 'right' : 'left'}
      />
      <Text style={[s.counter, tooLong && s.counterError]}>
        {comment.length}/{REVIEW_COMMENT_MAX}
      </Text>

      {!!error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity
        style={[s.btn, !canSubmit && s.btnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {saving ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text style={s.btnText}>
            {isEdit
              ? (isRTL ? 'حفظ التعديل' : 'Save changes')
              : (isRTL ? 'إرسال التقييم' : 'Submit review')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 88,
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },
  inputError: { borderColor: '#F87171' },
  counter: { fontSize: 11, color: '#94A3B8', alignSelf: 'flex-end', fontWeight: '600' },
  counterError: { color: '#DC2626' },
  error: { fontSize: 12, color: '#DC2626', fontWeight: '700', lineHeight: 18 },
  btn: { backgroundColor: '#0F172A', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#CBD5E1' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 14 },
});
