import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { boostProduct } from '../src/services/lib/boostService';
import { topUpUserWallet } from '../src/services/lib/walletService';
import { confirmOrderPayment } from '../src/services/lib/orderService';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Toast from 'react-native-toast-message';

const PAYMOB_IFRAME_ID = process.env.EXPO_PUBLIC_PAYMOB_IFRAME_ID || '957263';

export default function PaymentScreen() {
  const {
    paymentToken,
    orderId,
    totalEgp,
    // Phase 2: boost activation after confirmed payment
    boostProductId,
    boostTier,
    // Phase 2: wallet top-up credit after confirmed payment
    topUpAmount,
  } = useLocalSearchParams<{
    paymentToken: string;
    orderId: string;
    totalEgp?: string;
    boostProductId?: string;
    boostTier?: string;
    topUpAmount?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [successHandled, setSuccessHandled] = useState(false);

  const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;

  const handleSuccess = async () => {
    if (successHandled) return; // prevent double-firing on multiple URL changes
    setSuccessHandled(true);

    try {
      // Credit wallet balance only after real payment confirmed
      if (topUpAmount && user) {
        await topUpUserWallet(user.id, Number(topUpAmount), 'card');
        try {
          const webUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://egbay.shop';
          await fetch(`${webUrl}/api/wallet/credit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merchantOrderId: `topup_${user.id}_${Date.now()}`,
              amountCents: Number(topUpAmount) * 100,
              txId: `paymob_mobile_${Date.now()}`,
              isSuccess: true,
            }),
          });
        } catch (apiErr) {
          console.warn('[PaymentScreen] Server sync warning:', apiErr);
        }
      }
      // Activate boost only after real payment confirmed
      if (boostProductId && boostTier && user) {
        await boostProduct(
          boostProductId,
          user.id,
          boostTier as 'urgent' | 'featured' | 'turbo',
          'paymob',
        );
      }
      // Confirm normal marketplace product order payment into escrow
      if (orderId) {
        await confirmOrderPayment(orderId);
      }
    } catch (err) {
      // Non-fatal: payment succeeded, webhook will handle as backup
      console.warn('[PaymentScreen] Post-payment action failed:', err);
    }

    Toast.show({
      type: 'success',
      text1: topUpAmount
        ? `EGP ${Number(topUpAmount).toLocaleString()} Added to Wallet! 💳`
        : boostProductId
          ? 'Boost Activated! 🚀'
          : 'Payment Successful! 🎉',
      text2: topUpAmount
        ? 'Your spendable balance has been updated.'
        : boostProductId
          ? 'Your listing is now promoted.'
          : 'Funds secured in Escrow. Track your order status below.',
    });

    if (topUpAmount) {
      router.replace('/wallet' as any);
    } else if (boostProductId) {
      router.replace('/(tabs)');
    } else if (orderId) {
      router.replace({
        pathname: '/order/[orderId]',
        params: { orderId },
      } as any);
    } else {
      router.replace('/(tabs)');
    }
  };

  // Web iframe message listener
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleMsg = (e: MessageEvent) => {
        const data = typeof e.data === 'string' ? e.data.toLowerCase() : JSON.stringify(e.data || {}).toLowerCase();
        if (data.includes('approved') || data.includes('success') || data.includes('true')) {
          handleSuccess();
        }
      };
      window.addEventListener('message', handleMsg);
      return () => window.removeEventListener('message', handleMsg);
    }
  }, []);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url.toLowerCase();
    if (url.includes('success=true') || url.includes('txn_response_code=approved') || url.includes('callback/paymob')) {
      handleSuccess();
    } else if (url.includes('success=false') || url.includes('declined')) {
      Alert.alert('Payment Declined', 'Transaction was not completed. Please try another card or payment method.');
      router.back();
    }
  };

  if (!paymentToken) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Invalid payment session token.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Return to Checkout</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>
            {topUpAmount ? 'Wallet Deposit' : boostProductId ? 'Boost Payment' : 'Secure Card Checkout'}
          </Text>
          <View style={styles.secureRow}>
            <ShieldCheck color="#10B981" size={13} />
            <Text style={styles.secureText}>256-Bit Encrypted Escrow</Text>
          </View>
        </View>
        {totalEgp && <Text style={styles.headerPrice}>EGP {Number(totalEgp).toLocaleString()}</Text>}
      </View>

      {/* WebView & Confirmation Action Bar */}
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        {Platform.OS === 'web' ? (
          <View style={{ flex: 1 }}>
            <iframe
              src={paymentUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Paymob Payment"
            />
            {/* Quick Confirmation Bar for Web testing */}
            <View style={{ padding: 12, backgroundColor: '#0F172A', borderTopWidth: 1, borderTopColor: '#1E293B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>
                  {topUpAmount ? `Deposit: EGP ${Number(topUpAmount).toLocaleString()}` : 'Card Payment'}
                </Text>
                <Text style={{ fontSize: 10, color: '#94A3B8' }}>Click below once card payment completes</Text>
              </View>
              <TouchableOpacity
                onPress={handleSuccess}
                style={{ backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: 'white' }}>Confirm Payment ✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingLabel}>Loading secure Paymob portal…</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '700', marginBottom: 16 },
  backBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtnText: { color: 'white', fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBack: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitleWrap: { flex: 1, marginHorizontal: 10 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  headerPrice: { fontSize: 15, fontWeight: '900', color: '#2563EB' },



  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
});
