import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../hooks/useLanguage';

/**
 * Shared guard for every screen gated on PAYMENTS_ENABLED (see
 * PLAN-CLASSIFIEDS-MODE.md). Same look as the pre-existing
 * DIGITAL_PURCHASES_ENABLED guard in app/boost/[productId].tsx, generalised
 * so a stale deep link (a bookmarked /wallet, a notification pointing at
 * /order/[id], someone typing /checkout) always lands on an honest screen
 * instead of a broken or half-loaded one.
 */
export default function NotAvailableYet() {
  const router = useRouter();
  const { isRTL } = useLanguage();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4, textAlign: 'center' }}>
        {isRTL ? 'غير متاح حالياً' : 'Not available yet'}
      </Text>
      <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginTop: 8 }}>
        {isRTL
          ? 'الدفع داخل إيجي باي قريباً. في الوقت الحالي، اتفق على السعر والاستلام مع الطرف الآخر عبر الدردشة.'
          : 'Payments inside Egbay are coming soon. For now, agree on price and handover with the other person in chat.'}
      </Text>
      <TouchableOpacity
        onPress={goBack}
        style={{ marginTop: 22, height: 46, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#0F172A', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{isRTL ? 'رجوع' : 'Go back'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
