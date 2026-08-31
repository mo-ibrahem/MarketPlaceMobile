import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Banknote,
  Building,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  Smartphone,
  Truck,
  User,
  Wallet,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../src/services/lib/supabase';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { useAuth } from '../hooks/useAuth';
import { createMarketplaceOrder, confirmOrderPayment } from '../src/services/lib/orderService';
import { startPaymobCheckoutSession } from '../src/services/lib/paymobService';
import { productService, type Product } from '../src/services/lib/products';
import { deductWalletSpendableFunds, getUserWallet, type UserWallet } from '../src/services/lib/walletService';
import EscrowTrustModal from '../src/components/EscrowTrustModal';

const GOVERNORATES = ['Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Sharqia', 'Qalyubia', 'Gharbia', 'Red Sea'];

export default function CheckoutScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<Product | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [useWalletBalance, setUseWalletBalance] = useState(true);
  const [trustModalVisible, setTrustModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [deliveryMethod, setDeliveryMethod] = useState<'courier' | 'qr_meetup'>('courier');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'instapay' | 'cod'>('card');
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || 'Mohamed Ibrahim');
  const [phoneNumber, setPhoneNumber] = useState('01012345678');
  const [governorate, setGovernorate] = useState('Cairo');
  const [city, setCity] = useState('New Cairo');
  const [streetAddress, setStreetAddress] = useState('90th Street, Building 4');

  useEffect(() => {
    async function loadData() {
      if (!productId) return;
      try {
        const data = await productService.getProductById(productId);
        setProduct(data);
        if (user) {
          const w = await getUserWallet(user.id);
          setWallet(w);
        }
      } catch (err) {
        console.error('Error loading checkout product:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [productId, user]);

  const deliveryFee = deliveryMethod === 'courier' ? 65 : 0;
  const itemPrice = Number(product?.price || 0);
  const totalPrice = itemPrice + deliveryFee;
  const walletBalance = Number(wallet?.available_balance || 0);
  const walletDeduction = useWalletBalance ? Math.min(walletBalance, totalPrice) : 0;
  const remainingDue = Math.max(0, totalPrice - walletDeduction);

  const handleProceedToPayment = async () => {
    if (!product || !user) {
      Toast.show({ type: 'error', text1: 'Please sign in to complete purchase' });
      return;
    }

    if (deliveryMethod === 'courier' && (!phoneNumber || !streetAddress || !city)) {
      Toast.show({ type: 'error', text1: 'Please complete shipping address' });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create order in Escrow state
      const order = await createMarketplaceOrder({
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id,
        amount: totalPrice,
        handover_method: deliveryMethod,
        shipping_address: {
          full_name: fullName,
          phone: phoneNumber,
          governorate,
          city,
          street: streetAddress,
        },
        product_snapshot: {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
          condition: product.condition,
          category: product.category,
        },
      });

      // 2. 100% Wallet Checkout
      if (useWalletBalance && remainingDue === 0) {
        // Backend handles all fee/escrow deductions securely via the Phase 4 RPC
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('https://egbay.shop/api/wallet/action', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(session && { 'Authorization': `Bearer ${session.access_token}` })
          },
          body: JSON.stringify({
            action: 'deduct_spendable',
            orderId: order.id
          })
        });
        const walletResult = await res.json();
        
        if (!walletResult.success) {
           throw new Error(walletResult.error || 'Wallet checkout failed');
        }

        await confirmOrderPayment(order.id); // Triggers frontend UI refresh
        Toast.show({
          type: 'success',
          text1: 'Paid with Wallet Balance! 🛍️🎉',
          text2: `Order #${order.id.slice(-6)} placed with full Escrow Protection!`,
        });
        router.replace({
          pathname: '/order/[orderId]',
          params: { orderId: order.id },
        } as any);
        return;
      }

      // 4. If remaining due > 0, initiate Paymob checkout session (Full or Split card payment)
      if (remainingDue > 0) {
        const session = await startPaymobCheckoutSession({
          purpose: 'order',
          referenceId: order.id,
          billingData: {
            first_name: fullName.split(' ')[0] || 'Buyer',
            last_name: fullName.split(' ')[1] || 'Egbay',
            email: user.email || 'customer@egbay.market',
            phone_number: phoneNumber,
            city,
            state: governorate,
            street: streetAddress,
          },
        });

        // Navigate to WebView
        router.push({
          pathname: '/payment',
          params: {
            paymentToken: session.paymentToken,
            orderId: order.id,
            totalEgp: remainingDue.toString(),
          },
        } as any);
      }
    } catch (err: any) {
      Alert.alert('Checkout Error', err?.message || 'Failed to process checkout');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Preparing secure checkout…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#0F172A" size={22} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Secure Checkout</Text>
          <View style={styles.lockBadge}>
            <Lock color="#10B981" size={13} />
            <Text style={styles.lockBadgeText}>Escrow</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        >
          <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
            {/* Escrow Guarantee Banner */}
            <TouchableOpacity
              style={styles.escrowBanner}
              onPress={() => setTrustModalVisible(true)}
              activeOpacity={0.85}
            >
              <ShieldCheck color="#2563EB" size={26} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={styles.escrowTitle}>ضمان إيجي باي لحماية أموالك 🛡️</Text>
                  <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '800' }}>كيف نحميك؟ ←</Text>
                </View>
                <Text style={styles.escrowSub}>
                  البائع لا يستلم جنيهاً واحداً إلا بعد استلامك ومعاينتك للمنتج والتأكيد. استرجاع فوري 100%!
                </Text>
              </View>
            </TouchableOpacity>

            {/* Product Summary Card */}
            {product && (
              <View style={styles.productCard}>
                <Image
                  source={{ uri: product.images?.[0] || 'https://via.placeholder.com/150' }}
                  style={styles.productThumb}
                />
                <View style={styles.productInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {product.title}
                  </Text>
                  <View style={styles.productMetaRow}>
                    <View style={styles.conditionTag}>
                      <Text style={styles.conditionTagText}>{product.condition}</Text>
                    </View>
                    <View style={styles.sellerTag}>
                      <User size={11} color="#64748B" />
                      <Text style={styles.sellerTagText}>Verified Seller ��️</Text>
                    </View>
                  </View>
                  <Text style={styles.productPrice}>EGP {Number(product.price).toLocaleString()}</Text>
                </View>
              </View>
            )}

            {/* Handover & Delivery Options */}
            <Text style={styles.sectionHeading}>Delivery & Handover Method</Text>
            <View style={styles.optionsGrid}>
              <TouchableOpacity
                style={[styles.methodCard, deliveryMethod === 'courier' && styles.methodCardActive]}
                onPress={() => setDeliveryMethod('courier')}
                activeOpacity={0.85}
              >
                <View style={[styles.methodIconWrap, deliveryMethod === 'courier' && styles.methodIconWrapActive]}>
                  <Truck color={deliveryMethod === 'courier' ? '#2563EB' : '#64748B'} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.methodHeaderRow}>
                    <Text style={styles.methodTitle}>Bosta Courier Delivery</Text>
                    <Text style={styles.methodPrice}>EGP 65</Text>
                  </View>
                  <Text style={styles.methodSub}>Doorstep delivery across all 27 Governorates in 24–48 hrs with tracking.</Text>
                </View>
                {deliveryMethod === 'courier' && <CheckCircle2 color="#2563EB" size={20} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodCard, deliveryMethod === 'qr_meetup' && styles.methodCardActive]}
                onPress={() => setDeliveryMethod('qr_meetup')}
                activeOpacity={0.85}
              >
                <View style={[styles.methodIconWrap, deliveryMethod === 'qr_meetup' && styles.methodIconWrapActive]}>
                  <QrCode color={deliveryMethod === 'qr_meetup' ? '#2563EB' : '#64748B'} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.methodHeaderRow}>
                    <Text style={styles.methodTitle}>In-Person Meetup (QR Escrow)</Text>
                    <Text style={[styles.methodPrice, { color: '#059669' }]}>FREE</Text>
                  </View>
                  <Text style={styles.methodSub}>Meet in a safe public spot. Scan QR code to release escrow on the spot.</Text>
                </View>
                {deliveryMethod === 'qr_meetup' && <CheckCircle2 color="#2563EB" size={20} />}
              </TouchableOpacity>
            </View>

            {/* Address Form (if Courier) */}
            {deliveryMethod === 'courier' && (
              <View style={styles.formSection}>
                <Text style={styles.sectionHeading}>Shipping Address</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Recipient Name"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Egyptian Mobile Number (+20)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="010XXXXXXXX"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Governorate</Text>
                    <TextInput
                      style={styles.textInput}
                      value={governorate}
                      onChangeText={setGovernorate}
                      placeholder="e.g. Cairo"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>City / Area</Text>
                    <TextInput
                      style={styles.textInput}
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. Maadi, Heliopolis"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Street Address & Building</Text>
                  <TextInput
                    style={styles.textInput}
                    value={streetAddress}
                    onChangeText={setStreetAddress}
                    placeholder="Street name, Building no., Apartment"
                  />
                </View>
              </View>
            )}

            {/* ════════ EBAY SPENDABLE FUNDS & SPLIT PAYMENT CARD ════════ */}
            {walletBalance > 0 && (
              <View style={[styles.walletSplitCard, walletBalance < totalPrice && { opacity: 0.6 }]}>
                <View style={styles.walletSplitTop}>
                  <View style={styles.walletSplitIconBox}>
                    <Wallet color="#10B981" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.walletSplitTitle}>Apply Wallet Balance</Text>
                    <Text style={styles.walletSplitSub}>
                      Available: <Text style={{ fontWeight: '800', color: '#0F172A' }}>EGP {walletBalance.toLocaleString()}</Text>
                    </Text>
                    {walletBalance < totalPrice && (
                      <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Insufficient for full payment</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.togglePill, useWalletBalance && styles.togglePillActive]}
                    onPress={() => {
                      if (walletBalance >= totalPrice) {
                        setUseWalletBalance(!useWalletBalance);
                      } else {
                        Toast.show({ type: 'info', text1: 'Insufficient Balance', text2: 'Wallet balance must cover the full amount.' });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.toggleCircle, useWalletBalance && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                {useWalletBalance && walletBalance >= totalPrice && (
                  <View style={styles.walletSplitBreakdown}>
                    <Text style={[styles.walletSplitBreakdownText, { color: '#059669', fontWeight: '800' }]}>
                      ✨ 100% Covered by Wallet — 1-Tap Instant Checkout!
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Payment Method Selector */}
            {remainingDue > 0 && (
              <>
                <Text style={styles.sectionHeading}>Select Payment Option (Remaining Due)</Text>
                <View style={styles.paymentOptions}>
              {/* Option 1: Card */}
              <TouchableOpacity
                style={[styles.payOptionCard, paymentMethod === 'card' && styles.payOptionActive]}
                onPress={() => setPaymentMethod('card')}
                activeOpacity={0.85}
              >
                <View style={styles.payIconBox}>
                  <CreditCard size={18} color={paymentMethod === 'card' ? '#2563EB' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payOptionTitle}>Credit / Debit Card</Text>
                  <Text style={styles.payOptionSub}>Visa, Mastercard, Meeza via Paymob</Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>Instant</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Mobile Wallets */}
              <TouchableOpacity
                style={[styles.payOptionCard, paymentMethod === 'wallet' && styles.payOptionActive]}
                onPress={() => setPaymentMethod('wallet')}
                activeOpacity={0.85}
              >
                <View style={styles.payIconBox}>
                  <Smartphone size={18} color={paymentMethod === 'wallet' ? '#2563EB' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payOptionTitle}>Mobile Wallet (Vodafone / Orange / Etisalat)</Text>
                  <Text style={styles.payOptionSub}>Pay with your Egyptian e-Wallet</Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: InstaPay */}
              <TouchableOpacity
                style={[styles.payOptionCard, paymentMethod === 'instapay' && styles.payOptionActive]}
                onPress={() => setPaymentMethod('instapay')}
                activeOpacity={0.85}
              >
                <View style={styles.payIconBox}>
                  <Building size={18} color={paymentMethod === 'instapay' ? '#2563EB' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payOptionTitle}>InstaPay Transfer (IPN)</Text>
                  <Text style={styles.payOptionSub}>Direct Escrow Reference to EgyBay IPA</Text>
                </View>
              </TouchableOpacity>

              {/* Option 4: COD */}
              <TouchableOpacity
                style={[styles.payOptionCard, paymentMethod === 'cod' && styles.payOptionActive]}
                onPress={() => setPaymentMethod('cod')}
                activeOpacity={0.85}
              >
                <View style={styles.payIconBox}>
                  <Banknote size={18} color={paymentMethod === 'cod' ? '#2563EB' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payOptionTitle}>Cash on Delivery (Courier Escrow)</Text>
                  <Text style={styles.payOptionSub}>Inspect item at your door before paying cash</Text>
                </View>
              </TouchableOpacity>
            </View>
            </>
            )}

            {/* Price Breakdown */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Price Breakdown</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Item Price</Text>
                <Text style={styles.summaryValue}>EGP {itemPrice.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={styles.summaryValue}>{deliveryFee === 0 ? 'FREE' : `EGP ${deliveryFee}`}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Buyer Escrow Protection</Text>
                <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '700' }]}>FREE</Text>
              </View>
              {walletDeduction > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#059669' }]}>Paid from Wallet Balance</Text>
                  <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '800' }]}>
                    -EGP {walletDeduction.toLocaleString()}
                  </Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {remainingDue === 0 ? 'Total (Covered by Wallet)' : 'Remaining Due to Pay'}
                </Text>
                <Text style={styles.totalValue}>
                  EGP {(remainingDue === 0 ? totalPrice : remainingDue).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom Action Bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>
              {remainingDue === 0 ? 'Wallet Payment' : 'Total to Pay'}
            </Text>
            <Text style={styles.bottomTotalValue}>
              EGP {(remainingDue === 0 ? totalPrice : remainingDue).toLocaleString()}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.payButton}
            onPress={handleProceedToPayment}
            disabled={submitting}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={remainingDue === 0 ? ['#059669', '#047857'] : ['#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payGradient}
            >
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : remainingDue === 0 ? (
                <>
                  <CheckCircle2 color="white" size={18} />
                  <Text style={styles.payButtonText}>1-Tap Wallet Pay 🛍️</Text>
                </>
              ) : (
                <>
                  <Lock color="white" size={18} />
                  <Text style={styles.payButtonText}>
                    {walletDeduction > 0 ? `Pay EGP ${remainingDue.toLocaleString()}` : 'Proceed to Payment'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Escrow Trust Guarantee Modal */}
      <EscrowTrustModal visible={trustModalVisible} onClose={() => setTrustModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '600' },

  // Spendable Funds & Split Payment Styles
  walletSplitCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  walletSplitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletSplitIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  walletSplitTitle: { fontSize: 14, fontWeight: '800', color: '#065F46' },
  walletSplitSub: { fontSize: 11, color: '#047857', marginTop: 1 },
  togglePill: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#CBD5E1',
    padding: 3,
    justifyContent: 'center',
  },
  togglePillActive: { backgroundColor: '#10B981' },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  toggleCircleActive: { alignSelf: 'flex-end' },
  walletSplitBreakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
    gap: 4,
  },
  walletSplitBreakdownText: { fontSize: 12, color: '#065F46', fontWeight: '600' },

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
  backBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },

  scrollContent: { padding: 16 },

  escrowBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  escrowTitle: { fontSize: 14, fontWeight: '800', color: '#1E40AF', marginBottom: 2 },
  escrowSub: { fontSize: 12, color: '#3B82F6', lineHeight: 16 },

  productCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  productThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F1F5F9' },
  productInfo: { flex: 1, justifyContent: 'center' },
  productTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  productMetaRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  conditionTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  conditionTagText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  sellerTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sellerTagText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  productPrice: { fontSize: 16, fontWeight: '900', color: '#2563EB' },

  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10, marginTop: 6 },

  optionsGrid: { gap: 10, marginBottom: 20 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  methodCardActive: { borderColor: '#2563EB', backgroundColor: '#F8FAFF' },
  methodIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconWrapActive: { backgroundColor: '#EFF6FF' },
  methodHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  methodTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  methodPrice: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  methodSub: { fontSize: 11, color: '#64748B', lineHeight: 15 },

  formSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  inputGroup: { marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  textInput: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },

  paymentOptions: { gap: 8, marginBottom: 20 },
  payOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  payOptionActive: { borderColor: '#2563EB', backgroundColor: '#F8FAFF' },
  payIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payOptionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  payOptionSub: { fontSize: 11, color: '#64748B' },
  tagPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagPillText: { fontSize: 10, fontWeight: '800', color: '#059669' },

  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#2563EB' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomTotal: { flex: 1 },
  bottomTotalLabel: { fontSize: 11, color: '#64748B' },
  bottomTotalValue: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  payButton: { flex: 1.8, borderRadius: 14, overflow: 'hidden' },
  payGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  payButtonText: { color: 'white', fontSize: 14, fontWeight: '800' },
});
