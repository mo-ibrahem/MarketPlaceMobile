import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, Lock, ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
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
  const { paymentToken, orderId, totalEgp } = useLocalSearchParams<{
    paymentToken: string;
    orderId: string;
    totalEgp?: string;
  }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;

  const handleSuccess = () => {
    Toast.show({
      type: 'success',
      text1: 'Payment Successful! 🎉',
      text2: 'Funds secured in Escrow. Track your order status below.',
    });
    if (orderId) {
      router.replace({
        pathname: '/order/[orderId]',
        params: { orderId },
      } as any);
    } else {
      router.replace('/(tabs)');
    }
  };

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
          <Text style={styles.headerTitle}>Paymob Card Checkout</Text>
          <View style={styles.secureRow}>
            <ShieldCheck color="#10B981" size={13} />
            <Text style={styles.secureText}>256-Bit Encrypted Escrow</Text>
          </View>
        </View>
        {totalEgp && <Text style={styles.headerPrice}>EGP {Number(totalEgp).toLocaleString()}</Text>}
      </View>

      {/* Sandbox Instant Simulation Tool for Fast Testing */}
      <View style={styles.sandboxNotice}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sandboxTitle}>Paymob Test Mode</Text>
          <Text style={styles.sandboxSub}>Use test card or tap to simulate instant approval</Text>
        </View>
        <TouchableOpacity style={styles.simulateBtn} onPress={handleSuccess} activeOpacity={0.8}>
          <CheckCircle color="white" size={14} />
          <Text style={styles.simulateBtnText}>Simulate Approval</Text>
        </TouchableOpacity>
      </View>

      {/* WebView */}
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        {Platform.OS === 'web' ? (
          <iframe
            src={paymentUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Paymob Payment"
          />
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

  sandboxNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    gap: 8,
  },
  sandboxTitle: { fontSize: 12, fontWeight: '800', color: '#1E40AF' },
  sandboxSub: { fontSize: 11, color: '#3B82F6' },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  simulateBtnText: { color: 'white', fontSize: 11, fontWeight: '800' },

  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
});
