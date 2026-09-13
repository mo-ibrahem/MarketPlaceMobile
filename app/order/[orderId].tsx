import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Star,
  ThumbsUp,
  Truck,
  User,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { displayName } from '../../src/services/lib/displayName';
import { getOrCreateChatRoom } from '../../src/services/lib/chatService';
import { ReviewForm } from '../../src/components/ReviewForm';
import { ReviewRow } from '../../src/components/ReviewList';
import {
  canReviewOrder,
  getMyReviewForOrder,
  type Review,
} from '../../src/services/lib/reviewService';
import {
  approveOrderDelivery,
  confirmBuyerReceipt,
  fileOrderDispute,
  getOrderById,
  updateOrderTracking,
  verifyMeetupPIN,
  type MarketplaceOrder,
} from '../../src/services/lib/orderService';
import NotAvailableYet from '../../src/components/NotAvailableYet';
import { PAYMENTS_ENABLED } from '../../src/services/lib/platformCommerce';

// ──────────────────────────────────────────────────────────────
// Bosta Tracking Stepper
// ──────────────────────────────────────────────────────────────

// `short` is what the four-column progress rail shows; the full label is used
// in the "Right now" line above it, where there is room for it.
const BOSTA_STEPS: { status: MarketplaceOrder['status'][]; label: string; label_ar: string; short: string; short_ar: string; icon: any }[] = [
  { status: ['escrow_secured'], label: 'Funds Secured', short: 'Paid', short_ar: 'مدفوع', label_ar: 'أموال في الضمان', icon: ShieldCheck },
  { status: ['shipped'], label: 'Dispatched to Bosta', short: 'Shipped', short_ar: 'شُحن', label_ar: 'تم التسليم لبوسطة', icon: Truck },
  { status: ['out_for_delivery'], label: 'Out for Delivery', short: 'On the way', short_ar: 'في الطريق', label_ar: 'خرج للتوصيل', icon: MapPin },
  { status: ['delivered', 'completed'], label: 'Delivered ✓', short: 'Delivered', short_ar: 'تم التسليم', label_ar: 'تم التوصيل ✓', icon: CheckCircle2 },
];

const ORDER_STATUS_RANK: Record<MarketplaceOrder['status'], number> = {
  pending_payment: 0,
  escrow_secured: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
  completed: 4,
  disputed: 1,
  cancelled: 0,
};

/**
 * Order progress, rebuilt as a horizontal tracker.
 *
 * The old version was a vertical timeline: four 30pt circles stacked with
 * connecting rules, each showing the label twice (Arabic above, English below),
 * costing ~140pt of height to convey one number -- how far along the order is.
 * It also gave equal visual weight to every step, so the one thing a buyer
 * opens this screen to learn -- what is happening *now* -- was not emphasised.
 *
 * The horizontal bar states the current step once, in large type, with a
 * four-segment progress rail underneath. Same information, a third of the
 * height, and the current state is the loudest thing in the card.
 */
function OrderProgress({ status, isRTL }: { status: MarketplaceOrder['status']; isRTL: boolean }) {
  const rank = ORDER_STATUS_RANK[status] ?? 0;
  const current = BOSTA_STEPS[Math.min(Math.max(rank - 1, 0), BOSTA_STEPS.length - 1)];
  const Icon = current.icon;
  const pct = Math.round((Math.min(rank, BOSTA_STEPS.length) / BOSTA_STEPS.length) * 100);

  return (
    <View style={stepStyles.wrap}>
      <View style={stepStyles.head}>
        <View style={stepStyles.headIcon}>
          <Icon color="#FFFFFF" size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={stepStyles.headLabel}>
            {isRTL ? 'الحالة الآن' : 'Right now'}
          </Text>
          <Text style={stepStyles.headValue} numberOfLines={1}>
            {isRTL ? current.label_ar : current.label}
          </Text>
        </View>
        <Text style={stepStyles.pct}>{pct}%</Text>
      </View>

      <View style={stepStyles.rail}>
        {BOSTA_STEPS.map((_, i) => (
          <View
            key={i}
            style={[stepStyles.segment, rank >= i + 1 && stepStyles.segmentDone]}
          />
        ))}
      </View>

      <View style={stepStyles.ticks}>
        {BOSTA_STEPS.map((step, i) => (
          <Text
            key={i}
            style={[stepStyles.tick, rank >= i + 1 && stepStyles.tickDone]}
            numberOfLines={1}
          >
            {isRTL ? step.short_ar : step.short}
          </Text>
        ))}
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrap: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  headLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.2 },
  headValue: { fontSize: 19, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4, marginTop: 1 },
  pct: { fontSize: 15, fontWeight: '800', color: '#94A3B8' },

  rail: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0' },
  segmentDone: { backgroundColor: '#0F172A' },

  ticks: { flexDirection: 'row', gap: 5 },
  tick: { flex: 1, fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  tickDone: { color: '#0F172A', fontWeight: '700' },
});

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Seller — AWB dispatch
  const [awbInput, setAwbInput] = useState('');
  const [dispatchingAwb, setDispatchingAwb] = useState(false);
  const [showAwbModal, setShowAwbModal] = useState(false);

  // Buyer — PIN
  const [enteredPin, setEnteredPin] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Buyer — Dispute
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [filingDispute, setFilingDispute] = useState(false);

  // Buyer — Approve delivery
  const [approving, setApproving] = useState(false);

  const [openingChat, setOpeningChat] = useState(false);

  // Buyer — Review
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [editingReview, setEditingReview] = useState(false);

  const reload = async () => {
    if (!orderId) return;
    try {
      const data = await getOrderById(orderId);
      setOrder(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reloadReview = async () => {
    if (!orderId) return;
    try {
      setMyReview(await getMyReviewForOrder(orderId));
    } catch (err) {
      // A missing review isn't an error state for this screen; the section
      // simply renders as "not reviewed yet".
      console.warn('[OrderDetail] review load failed:', err);
    }
  };

  useEffect(() => {
    // Classifieds mode: nothing here can be reached, so don't even fetch.
    if (!PAYMENTS_ENABLED) { setLoading(false); return; }
    reload();
    reloadReview();
  }, [orderId]);

  const isBuyer = user?.id === order?.buyer_id;
  const isSeller = user?.id === order?.seller_id;
  const isDelivered = order?.status === 'delivered' || order?.status === 'completed';

  // ── Seller: Dispatch AWB ──
  const handleDispatchAwb = async () => {
    if (!orderId || !awbInput.trim()) return;
    setDispatchingAwb(true);
    try {
      await updateOrderTracking(orderId, { tracking_number: awbInput.trim() });
      Toast.show({ type: 'success', text1: (isRTL ? 'تم إضافة رقم التتبع' : 'Tracking number added'), text2: `AWB: ${awbInput.trim()}` });
      setShowAwbModal(false);
      setAwbInput('');
      await reload();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: (isRTL ? 'خطأ' : 'Error'), text2: err.message });
    } finally {
      setDispatchingAwb(false);
    }
  };

  // ── Seller: PIN Verify ──
  const handleVerifyPin = async () => {
    if (!orderId || !enteredPin || enteredPin.length < 4) {
      Toast.show({ type: 'error', text1: (isRTL ? 'أدخل رمز التحقق الصحيح' : 'Enter the correct PIN') });
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyMeetupPIN(orderId, enteredPin);
      Toast.show({ type: 'success', text1: (isRTL ? 'تم التحقق!' : 'Verified!'), text2: result.message });
      await reload();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: (isRTL ? 'رمز خاطئ' : 'Wrong PIN'), text2: err.message });
    } finally {
      setVerifying(false);
    }
  };

  // ── Buyer: Approve Delivery ──
  const handleApprove = async () => {
    Alert.alert(
      (isRTL ? 'تأكيد استلام الطلب' : 'Confirm you received the order'),
      (isRTL ? 'بالضغط على تأكيد، تقر باستلامك للمنتج وفحصه. سيتم تحرير أموال الضمان للبائع فوراً.' : 'By confirming you acknowledge that you received and inspected the item. Escrow funds are released to the seller immediately.'),
      [
        { text: (isRTL ? 'إلغاء' : 'Cancel'), style: 'cancel' },
        {
          text: (isRTL ? 'تأكيد الاستلام ✓' : 'Confirm receipt ✓'),
          style: 'default',
          onPress: async () => {
            if (!orderId) return;
            setApproving(true);
            try {
              const result = await approveOrderDelivery(orderId);
              Toast.show({ type: 'success', text1: (isRTL ? 'تم التأكيد!' : 'Confirmed!'), text2: result.message });
              await reload();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: (isRTL ? 'خطأ' : 'Error'), text2: err.message });
            } finally {
              setApproving(false);
            }
          },
        },
      ]
    );
  };

  // ── Buyer: File Dispute ──
  const handleFileDispute = async () => {
    if (!orderId || !disputeReason.trim()) {
      Toast.show({ type: 'error', text1: (isRTL ? 'أدخل سبب النزاع' : 'Describe the problem') });
      return;
    }
    setFilingDispute(true);
    try {
      const result = await fileOrderDispute(orderId, disputeReason);
      Toast.show({ type: 'success', text1: (isRTL ? 'تم فتح النزاع' : 'Dispute opened'), text2: result.message });
      setShowDisputeModal(false);
      await reload();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: (isRTL ? 'خطأ' : 'Error'), text2: err.message });
    } finally {
      setFilingDispute(false);
    }
  };

  // Classifieds mode: there are no orders right now (see PLAN-CLASSIFIEDS-MODE.md).
  if (!PAYMENTS_ENABLED) {
    return <NotAvailableYet />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Package color="#94A3B8" size={48} />
        <Text style={{ color: '#64748B', marginTop: 12 }}>{isRTL ? 'الطلب غير موجود' : 'Order not found'}</Text>
      </View>
    );
  }

  const isDisputed = order.status === 'disputed';

  // Money has reached escrow only once the backend moved the order out of
  // pending_payment. Previously the badge fell through to "🔒 ضمان" and the
  // escrow banner rendered for ANY status that wasn't delivered or disputed --
  // pending_payment and cancelled included -- so an unpaid or cancelled order
  // told the user their money was safely held when nothing had reached escrow.
  const isAwaitingPayment = order.status === 'pending_payment';
  const isCancelled = order.status === 'cancelled';
  const isInEscrow = !isAwaitingPayment && !isCancelled;

  const statusBadge = isDisputed
    ? '⚠️ نزاع'
    : isAwaitingPayment
      ? '⏳ بانتظار الدفع'
      : isCancelled
        ? '✕ ملغي'
        : order.status === 'completed'
          ? '✓ مكتمل'
          : order.status === 'shipped'
            ? '🚚 شحن'
            : order.status === 'delivered'
              ? '📦 وصل'
              : (isRTL ? '🔒 ضمان' : '🔒 Escrow');

  const reviewGate = canReviewOrder(order, user?.id, myReview);

  const canApprove = isBuyer && (order.status === 'delivered');
  const canDispute = isBuyer && (order.status === 'delivered' || order.status === 'shipped' || order.status === 'out_for_delivery');
  const canDispatchAwb = isSeller && (order.status === 'escrow_secured') && order.handover_method === 'courier';
  const canVerifyPin = isSeller && order.handover_method === 'qr_meetup' && !isDelivered;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E3A5F']} style={[s.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{isRTL ? 'تفاصيل الطلب' : 'Order details'}</Text>
          <Text style={s.headerSub}>#{order.id.slice(-8).toUpperCase()}</Text>
        </View>
        <View
          style={[
            s.statusBadgeHeader,
            { borderColor: isDisputed || isCancelled ? '#FCA5A5' : isAwaitingPayment ? '#FCD34D' : '#93C5FD' },
          ]}
        >
          <Text
            style={[
              s.statusBadgeText,
              { color: isDisputed || isCancelled ? '#EF4444' : isAwaitingPayment ? '#FBBF24' : '#60A5FA' },
            ]}
          >
            {statusBadge}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>

        {/* Product Card */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {order.product?.images?.[0] ? (
              <Image source={{ uri: order.product.images[0] }} style={s.productImg} />
            ) : (
              <View style={[s.productImg, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                <Package color="#94A3B8" size={28} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.productTitle} numberOfLines={2}>{order.product?.title || (isRTL ? 'منتج' : 'Item')}</Text>
              <Text style={s.productAmount}>
                {isRTL
                  ? `${order.amount.toLocaleString('ar-EG')} ج.م`
                  : `EGP ${order.amount.toLocaleString('en-EG')}`}
              </Text>
              <Text style={s.productCondition}>
                {isBuyer
                  ? `${isRTL ? 'البائع' : 'Seller'}: ${displayName(order.seller?.full_name, isRTL ? 'بائع' : 'Seller')}`
                  : `${isRTL ? 'المشتري' : 'Buyer'}: ${displayName(order.buyer?.full_name, isRTL ? 'مشتري' : 'Buyer')}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment state — never claims escrow before the backend confirms it */}
        {isAwaitingPayment && (
          <View style={s.pendingBanner}>
            <Clock color="#D97706" size={18} />
            <Text style={s.pendingText}>
              {/* There is no resume-payment path, so this must not tell the
                  buyer to "complete payment" with no way to do it. It says what
                  actually happens: cancel_abandoned_orders releases the stock. */}
              {isRTL
                ? 'لم يتم تأكيد الدفع بعد — لم يصل أي مبلغ إلى الضمان. إذا لم يصل التأكيد، يُلغى الطلب تلقائياً ويعود المنتج للمخزون.'
                : 'Payment not confirmed yet — nothing has reached escrow. If confirmation never arrives, this order cancels itself and the item returns to stock.'}
            </Text>
          </View>
        )}

        {isCancelled && (
          <View style={s.cancelledBanner}>
            <ShieldAlert color="#DC2626" size={18} />
            <Text style={s.cancelledText}>
              {isRTL
                ? 'تم إلغاء هذا الطلب. لا توجد أموال محتجزة.'
                : 'This order was cancelled. No funds are being held.'}
            </Text>
          </View>
        )}

        {/* Escrow Protection Banner — only once funds actually reached escrow */}
        {isInEscrow && !isDelivered && !isDisputed && (
          <View style={s.escrowBanner}>
            <ShieldCheck color="#10B981" size={18} />
            <Text style={s.escrowText}>
              {isRTL
                ? 'أموالك في الضمان الآمن — محمية حتى التسليم والفحص'
                : 'Your money is held safely in escrow — protected until delivery and inspection.'}
            </Text>
          </View>
        )}

        {/* Bosta Tracking Stepper — courier only */}
        {order.handover_method === 'courier' && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Truck color="#3B82F6" size={16} />
              <Text style={s.cardTitle}>{isRTL ? 'تتبع الشحنة (بوسطة مصر)' : 'Shipment tracking (Bosta Egypt)'}</Text>
            </View>

            <OrderProgress status={order.status} isRTL={isRTL} />

            {order.tracking_number ? (
              <TouchableOpacity
                style={s.trackBtn}
                onPress={() => Linking.openURL(`https://bosta.co/tracking-shipment/?trackNumber=${order.tracking_number}`)}
              >
                <ExternalLink color="#7C3AED" size={14} />
                <Text style={s.trackBtnText}>فتح تتبع بوسطة: {order.tracking_number}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.noTrackingWrap}>
                <Clock color="#F59E0B" size={14} />
                <Text style={s.noTrackingText}>{isRTL ? 'في انتظار إرسال البائع رقم التتبع' : 'Waiting for the seller to add a tracking number'}</Text>
              </View>
            )}
          </View>
        )}

        {/* QR Meetup Card */}
        {order.handover_method === 'qr_meetup' && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <QrCode color="#7C3AED" size={16} />
              <Text style={s.cardTitle}>{isRTL ? 'تسليم يدوي بكود التحقق' : 'Hand delivery with a PIN'}</Text>
            </View>
            {isBuyer && (
              <View style={s.pinDisplay}>
                <Text style={s.pinLabel}>{isRTL ? 'كود التحقق الخاص بك (أعطه للبائع بعد الفحص)' : 'Your PIN (give it to the seller after inspecting)'}</Text>
                <Text style={s.pinCode}>{order.meetup_pin}</Text>
                <Text style={s.pinSub}>{isRTL ? 'لا تعطِ الكود إلا بعد الفحص والرضا الكامل' : 'Only share it once you have inspected the item and are satisfied'}</Text>
              </View>
            )}
            {isSeller && !isDelivered && (
              <View>
                <Text style={s.sellerPinNote}>{isRTL ? 'اطلب من المشتري كود التحقق المكون من 6 أرقام بعد أن يفحص المنتج ويرضى عنه' : 'Ask the buyer for their 6-digit PIN once they have inspected the item and are happy with it'}</Text>
                <View style={s.pinRow}>
                  <TextInput
                    value={enteredPin}
                    onChangeText={setEnteredPin}
                    placeholder="أدخل كود التحقق"
                    keyboardType="numeric"
                    maxLength={6}
                    style={s.pinInput}
                  />
                  <TouchableOpacity
                    onPress={handleVerifyPin}
                    disabled={verifying}
                    style={[s.pinVerifyBtn, verifying && { opacity: 0.6 }]}
                  >
                    {verifying ? <ActivityIndicator color="white" size="small" /> : <KeyRound color="white" size={16} />}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Seller — Dispatch AWB Section */}
        {canDispatchAwb && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Truck color="#F97316" size={16} />
              <Text style={s.cardTitle}>{isRTL ? 'إرسال رقم بوليصة الشحن' : 'Add the airway bill'}</Text>
            </View>
            <Text style={s.noteText}>{isRTL ? 'أرسل المنتج عبر بوسطة مصر وأدخل رقم AWB لتحديث المشتري' : 'Ship via Bosta Egypt and enter the AWB so the buyer can track it'}</Text>
            <TouchableOpacity style={s.dispatchBtn} onPress={() => setShowAwbModal(true)}>
              <Truck color="white" size={16} />
              <Text style={s.dispatchBtnText}>{isRTL ? 'أدخل رقم التتبع (AWB)' : 'Enter tracking number (AWB)'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Buyer — Inspection Window */}
        {canApprove && (
          <View style={[s.card, { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }]}>
            <View style={s.cardHeader}>
              <Clock color="#10B981" size={16} />
              <Text style={[s.cardTitle, { color: '#065F46' }]}>{isRTL ? 'نافذة الفحص والاستلام (٢٤ ساعة)' : 'Inspection window (24 hours)'}</Text>
            </View>
            <Text style={[s.noteText, { color: '#047857' }]}>
              {isRTL
                ? 'افحص المنتج جيداً. إذا كان كل شيء مطابقاً، اضغط تأكيد الاستلام لتحرير أموال البائع.'
                : 'Inspect the item carefully. If everything matches, confirm receipt to release the funds to the seller.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[s.approveBtn, approving && { opacity: 0.6 }]}
                onPress={handleApprove}
                disabled={approving}
              >
                {approving ? <ActivityIndicator color="white" size="small" /> : <ThumbsUp color="white" size={16} />}
                <Text style={s.approveBtnText}>{isRTL ? 'تأكيد الاستلام ✓' : 'Confirm receipt ✓'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.disputeBtn} onPress={() => setShowDisputeModal(true)}>
                <ShieldAlert color="#EF4444" size={16} />
                <Text style={s.disputeBtnText}>{isRTL ? 'فتح نزاع' : 'Open a dispute'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Dispute can be opened during delivery too */}
        {canDispute && !canApprove && !isDisputed && (
          <TouchableOpacity style={s.disputeOnlyBtn} onPress={() => setShowDisputeModal(true)}>
            <ShieldAlert color="#EF4444" size={16} />
            <Text style={s.disputeBtnText}>{isRTL ? 'السلعة لا تطابق الوصف؟ فتح نزاع' : 'Item not as described? Open a dispute'}</Text>
          </TouchableOpacity>
        )}

        {/* Dispute opened banner */}
        {isDisputed && (
          <View style={[s.card, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
            <ShieldAlert color="#EF4444" size={20} />
            <Text style={[s.cardTitle, { color: '#B91C1C', marginTop: 6 }]}>{isRTL ? 'النزاع قيد المراجعة' : 'Dispute under review'}</Text>
            <Text style={[s.noteText, { color: '#991B1B', marginTop: 4 }]}>
              أموالك محمية في الضمان. سيراجع فريقنا الأدلة خلال ٤٨ ساعة ويتصل بك.
            </Text>
          </View>
        )}

        {/* Shipping Address */}
        {order.shipping_address && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MapPin color="#64748B" size={16} />
              <Text style={s.cardTitle}>{isRTL ? 'عنوان التوصيل' : 'Delivery address'}</Text>
            </View>
            <Text style={s.addressText}>
              {order.shipping_address.full_name}{'\n'}
              {order.shipping_address.street}{order.shipping_address.building ? ` - عمارة ${order.shipping_address.building}` : ''}{'\n'}
              {order.shipping_address.city} — {order.shipping_address.governorate}{'\n'}
              {order.shipping_address.phone}
            </Text>
          </View>
        )}

        {/* Buyer review — the backend enforces every one of these rules inside
            submit_review; this only avoids offering an action it would reject. */}
        {isBuyer && (order.status === 'completed' || myReview) && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Star color="#F59E0B" size={16} />
              <Text style={s.cardTitle}>{isRTL ? 'تقييم البائع' : 'Rate the seller'}</Text>
            </View>

            {myReview && !editingReview ? (
              <View style={{ gap: 10 }}>
                <ReviewRow review={myReview} isRTL={isRTL} />
                <TouchableOpacity style={s.editReviewBtn} onPress={() => setEditingReview(true)}>
                  <Text style={s.editReviewText}>{isRTL ? 'تعديل تقييمي' : 'Edit my review'}</Text>
                </TouchableOpacity>
              </View>
            ) : reviewGate.allowed || editingReview ? (
              <ReviewForm
                orderId={order.id}
                existing={editingReview ? myReview : null}
                isRTL={isRTL}
                onSaved={() => {
                  setEditingReview(false);
                  reloadReview();
                }}
              />
            ) : (
              <Text style={s.noteText}>
                {reviewGate.reason === 'window_closed'
                  ? (isRTL ? 'انتهت مهلة التقييم لهذا الطلب (٩٠ يوماً).' : 'The 90-day review window for this order has closed.')
                  : (isRTL ? 'يمكنك التقييم بعد اكتمال الطلب.' : 'You can leave a review once this order is completed.')}
              </Text>
            )}
          </View>
        )}

        {/* Chat Button.
            This pushed a *user id* into /chat/[roomId], which is not a room id
            -- the screen opened on a room that does not exist. It now resolves
            the real room for this order's listing, so the thread is the one
            about the item that was actually bought. */}
        <TouchableOpacity
          style={s.chatBtn}
          disabled={openingChat}
          onPress={async () => {
            if (openingChat) return;
            setOpeningChat(true);
            try {
              const roomId = await getOrCreateChatRoom(
                isBuyer ? order.seller_id : order.buyer_id,
                order.product_id,
              );
              router.push(`/chat/${roomId}` as any);
            } catch (err: any) {
              Alert.alert((isRTL ? 'تعذّر فتح المحادثة' : 'Could not open the chat'), err?.message || (isRTL ? 'حاول مرة أخرى' : 'Please try again'));
            } finally {
              setOpeningChat(false);
            }
          }}
        >
          {openingChat ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <MessageCircle color="#3B82F6" size={18} />
          )}
          <Text style={s.chatBtnText}>
            {isRTL
              ? `فتح المحادثة مع ${isBuyer ? 'البائع' : 'المشتري'}`
              : `Message the ${isBuyer ? 'seller' : 'buyer'}`}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* AWB Modal */}
      <Modal visible={showAwbModal} transparent animationType="slide" onRequestClose={() => setShowAwbModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{isRTL ? 'أدخل رقم AWB من بوسطة' : 'Enter the AWB from Bosta'}</Text>
            <Text style={s.modalSub}>{isRTL ? 'ستجد رقم التتبع في تطبيق بوسطة أو على بوليصة الشحن' : 'You will find it in the Bosta app or on the airway bill'}</Text>
            <TextInput
              value={awbInput}
              onChangeText={setAwbInput}
              placeholder="BSTA-EG-XXXXXXXX"
              style={s.modalInput}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowAwbModal(false)}>
                <Text style={s.modalCancelText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, dispatchingAwb && { opacity: 0.6 }]}
                onPress={handleDispatchAwb}
                disabled={dispatchingAwb}
              >
                {dispatchingAwb ? <ActivityIndicator color="white" size="small" /> : null}
                <Text style={s.modalConfirmText}>{isRTL ? 'تأكيد الشحن' : 'Confirm dispatch'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDisputeModal} transparent animationType="slide" onRequestClose={() => setShowDisputeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{isRTL ? 'فتح نزاع رسمي' : 'Open a formal dispute'}</Text>
            <Text style={s.modalSub}>{isRTL ? 'أخبرنا بمشكلة السلعة وسنراجع الأمر خلال ٤٨ ساعة. أموالك آمنة في الضمان.' : 'Tell us what is wrong and we will review within 48 hours. Your money stays safe in escrow.'}</Text>
            <TextInput
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="مثال: السلعة مختلفة عن الصور — الهاتف به كسر غير مذكور..."
              multiline
              numberOfLines={3}
              style={[s.modalInput, { height: 80, textAlignVertical: 'top' }]}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowDisputeModal(false)}>
                <Text style={s.modalCancelText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, { backgroundColor: '#EF4444' }, filingDispute && { opacity: 0.6 }]}
                onPress={handleFileDispute}
                disabled={filingDispute}
              >
                {filingDispute ? <ActivityIndicator color="white" size="small" /> : null}
                <Text style={s.modalConfirmText}>{isRTL ? 'فتح النزاع' : 'Open dispute'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: 'white' },
  headerSub: { fontSize: 11, color: '#94A3B8' },
  statusBadgeHeader: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  content: { padding: 16, gap: 12 },

  card: { backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  productImg: { width: 70, height: 70, borderRadius: 14, overflow: 'hidden' } as any,
  productTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  productAmount: { fontSize: 18, fontWeight: '900', color: '#3B82F6', marginBottom: 2 },
  productCondition: { fontSize: 11, color: '#64748B' },

  escrowBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  escrowText: { fontSize: 12, fontWeight: '600', color: '#065F46', flex: 1 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  pendingText: { fontSize: 12, fontWeight: '700', color: '#92400E', flex: 1, lineHeight: 18 },
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FECACA' },
  cancelledText: { fontSize: 12, fontWeight: '700', color: '#991B1B', flex: 1, lineHeight: 18 },
  editReviewBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#EFF6FF' },
  editReviewText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

  noteText: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  addressText: { fontSize: 12.5, color: '#334155', lineHeight: 20 },

  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F3FF', borderRadius: 12, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#DDD6FE' },
  trackBtnText: { fontSize: 12, fontWeight: '700', color: '#7C3AED', flex: 1 },
  noTrackingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#FDE68A' },
  noTrackingText: { fontSize: 12, color: '#92400E', fontWeight: '600' },

  pinDisplay: { alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, gap: 4 },
  pinLabel: { fontSize: 11, color: '#7C3AED', textAlign: 'center' },
  pinCode: { fontSize: 38, fontWeight: '900', color: '#5B21B6', letterSpacing: 8 },
  pinSub: { fontSize: 11, color: '#A78BFA', textAlign: 'center' },
  sellerPinNote: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  pinRow: { flexDirection: 'row', gap: 8 },
  pinInput: { flex: 1, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: 4 },
  pinVerifyBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },

  dispatchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F97316', borderRadius: 14, padding: 13, marginTop: 10 },
  dispatchBtnText: { fontSize: 14, fontWeight: '800', color: 'white' },

  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', borderRadius: 14, padding: 13 },
  approveBtnText: { fontSize: 13, fontWeight: '800', color: 'white' },
  disputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 16 },
  disputeBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  disputeOnlyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#FECACA' },

  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#BFDBFE', marginTop: 4 },
  chatBtnText: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B' },
  modalInput: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  modalCancelBtn: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 13, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  modalConfirmBtn: { flex: 2, backgroundColor: '#3B82F6', borderRadius: 12, padding: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  modalConfirmText: { fontSize: 14, fontWeight: '800', color: 'white' },
});
