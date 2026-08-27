import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import {
  confirmBuyerReceipt,
  getOrderById,
  verifyMeetupPIN,
  type MarketplaceOrder,
} from '../../src/services/lib/orderService';

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [enteredPin, setEnteredPin] = useState('');
  const [verifying, setVerifying] = useState(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const data = await getOrderById(orderId);
      setOrder(data);
    } catch (err) {
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const isBuyer = user?.id === order?.buyer_id;
  const isSeller = user?.id === order?.seller_id;
  const isDelivered = order?.status === 'delivered' || order?.status === 'completed';

  const handleVerifyPin = async () => {
    if (!orderId || !enteredPin || enteredPin.length !== 6) {
      Toast.show({ type: 'error', text1: 'Please enter a valid 6-digit PIN' });
      return;
    }

    setVerifying(true);
    try {
      const res = await verifyMeetupPIN(orderId, enteredPin);
      Toast.show({ type: 'success', text1: 'Escrow Released! 🎉', text2: res.message });
      await fetchOrder();
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Invalid PIN');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!orderId) return;
    Alert.alert(
      'Confirm Receipt & Release Escrow',
      'Have you inspected the item and confirmed it matches the description? This will immediately release funds to the seller.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Release',
          style: 'default',
          onPress: async () => {
            setVerifying(true);
            try {
              const res = await confirmBuyerReceipt(orderId);
              Toast.show({ type: 'success', text1: 'Funds Released! 🎉', text2: res.message });
              await fetchOrder();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to release escrow');
            } finally {
              setVerifying(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading order details…</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Order not found.</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backHomeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.headerBack}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Order #{order.id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.statusPill, isDelivered ? styles.statusDelivered : styles.statusSecured]}>
          <Text style={[styles.statusPillText, isDelivered ? styles.statusDeliveredText : styles.statusSecuredText]}>
            {isDelivered ? 'COMPLETED' : 'ESCROW SECURED'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          {/* Status Hero Card */}
          <LinearGradient
            colors={isDelivered ? ['#059669', '#10B981'] : ['#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIconBox}>
              {isDelivered ? <CheckCircle2 color="white" size={32} /> : <ShieldCheck color="white" size={32} />}
            </View>
            <Text style={styles.heroTitle}>
              {isDelivered ? 'Order Delivered & Settled' : 'Payment Secured in Escrow 🛡️'}
            </Text>
            <Text style={styles.heroSub}>
              {isDelivered
                ? `EGP ${Number(order.amount).toLocaleString()} has been released to the seller's wallet.`
                : `EGP ${Number(order.amount).toLocaleString()} is safely held. Funds are only released once the item is inspected.`}
            </Text>
          </LinearGradient>

          {/* Verification Code Box (For In-Person Meetup) */}
          {order.handover_method === 'qr_meetup' && !isDelivered && (
            <View style={styles.verificationCard}>
              <View style={styles.verifyHeaderRow}>
                <QrCode color="#2563EB" size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifyTitle}>In-Person Handover PIN</Text>
                  <Text style={styles.verifySub}>
                    {isBuyer
                      ? 'Show this 6-digit PIN to the seller only AFTER inspecting the item.'
                      : 'Ask the buyer for their 6-digit PIN to verify and unlock funds.'}
                  </Text>
                </View>
              </View>

              {/* PIN Display */}
              <View style={styles.pinDisplayBox}>
                <Text style={styles.pinLabel}>VERIFICATION PIN</Text>
                <Text style={styles.pinCode}>{order.meetup_pin || '849201'}</Text>
                <Text style={styles.pinHint}>6-Digit Instant Escrow Release Key</Text>
              </View>

              {/* Seller Verification Input */}
              <View style={styles.sellerInputSection}>
                <Text style={styles.inputTitle}>Verify & Release Escrow Funds</Text>
                <View style={styles.pinInputRow}>
                  <TextInput
                    style={styles.pinTextInput}
                    placeholder="Enter 6-digit PIN"
                    value={enteredPin}
                    onChangeText={setEnteredPin}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={handleVerifyPin}
                    disabled={verifying}
                    activeOpacity={0.85}
                  >
                    {verifying ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.verifyBtnText}>Verify & Settle</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Courier Delivery Confirmation Card */}
          {order.handover_method === 'courier' && !isDelivered && (
            <View style={styles.courierCard}>
              <View style={styles.courierHeader}>
                <Truck color="#2563EB" size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.courierTitle}>Bosta Express Delivery</Text>
                  <Text style={styles.courierSub}>Doorstep delivery with item inspection</Text>
                </View>
              </View>

              <View style={styles.trackingBox}>
                <Text style={styles.trackingLabel}>TRACKING NUMBER</Text>
                <Text style={styles.trackingNumber}>{order.tracking_number || 'BST-89420-EG'}</Text>
              </View>

              {isBuyer && (
                <TouchableOpacity
                  style={styles.confirmReceiptBtn}
                  onPress={handleConfirmReceipt}
                  disabled={verifying}
                  activeOpacity={0.9}
                >
                  <CheckCircle2 color="white" size={18} />
                  <Text style={styles.confirmReceiptText}>I Received & Accepted the Item</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Product & Order Details Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeading}>Order Details</Text>
            <View style={styles.productRow}>
              <Image
                source={{
                  uri: order.product?.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
                }}
                style={styles.productThumb}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.productTitle}>{order.product?.title || 'Marketplace Item'}</Text>
                <Text style={styles.productCondition}>{order.product?.condition || 'Good'} Condition</Text>
                <Text style={styles.productPrice}>EGP {Number(order.amount).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Shipping / Meetup Address */}
            <View style={styles.infoRow}>
              <MapPin size={16} color="#64748B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Handover Location / Address</Text>
                <Text style={styles.infoValue}>
                  {order.handover_method === 'qr_meetup'
                    ? 'In-Person Public Meetup (Cairo/Giza)'
                    : `${order.shipping_address?.street || '90th St'}, ${order.shipping_address?.city || 'Cairo'}, ${order.shipping_address?.governorate || 'Cairo'}`}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Clock size={16} color="#64748B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Order Date</Text>
                <Text style={styles.infoValue}>{new Date(order.created_at).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionOutlineBtn}
              onPress={() => router.push('/(tabs)')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionOutlineText}>Back to Marketplace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionFilledBtn}
              onPress={() => router.push('/wallet' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionFilledText}>View My Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '700', marginBottom: 16 },
  backHomeBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backHomeBtnText: { color: 'white', fontWeight: '700' },

  topHeader: {
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
  topTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusSecured: { backgroundColor: '#EFF6FF' },
  statusSecuredText: { color: '#2563EB', fontSize: 10, fontWeight: '800' },
  statusDelivered: { backgroundColor: '#ECFDF5' },
  statusDeliveredText: { color: '#059669', fontSize: 10, fontWeight: '800' },

  scrollContent: { padding: 16 },

  heroCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 6, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center', lineHeight: 18 },

  verificationCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  verifyHeaderRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  verifyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  verifySub: { fontSize: 12, color: '#64748B', lineHeight: 16 },

  pinDisplayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  pinLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 4 },
  pinCode: { fontSize: 32, fontWeight: '900', color: '#2563EB', letterSpacing: 6, marginBottom: 4 },
  pinHint: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  sellerInputSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  inputTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  pinInputRow: { flexDirection: 'row', gap: 10 },
  pinTextInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#0F172A',
  },
  verifyBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },

  courierCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  courierHeader: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  courierTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  courierSub: { fontSize: 12, color: '#64748B' },
  trackingBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackingLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.8, marginBottom: 2 },
  trackingNumber: { fontSize: 14, fontWeight: '800', color: '#2563EB' },
  confirmReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmReceiptText: { color: 'white', fontWeight: '800', fontSize: 14 },

  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  cardHeading: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  productRow: { flexDirection: 'row', gap: 12 },
  productThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F1F5F9' },
  productTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  productCondition: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '900', color: '#2563EB' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
  infoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  infoLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  infoValue: { fontSize: 13, color: '#0F172A', fontWeight: '600', marginTop: 1 },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionOutlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  actionOutlineText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  actionFilledBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionFilledText: { fontSize: 13, fontWeight: '800', color: 'white' },
});
