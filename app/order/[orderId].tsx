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
import {
  approveOrderDelivery,
  confirmBuyerReceipt,
  fileOrderDispute,
  getOrderById,
  updateOrderTracking,
  verifyMeetupPIN,
  type MarketplaceOrder,
} from '../../src/services/lib/orderService';

// ──────────────────────────────────────────────────────────────
// Bosta Tracking Stepper
// ──────────────────────────────────────────────────────────────

const BOSTA_STEPS: { status: MarketplaceOrder['status'][]; label: string; label_ar: string; icon: any }[] = [
  { status: ['escrow_secured'], label: 'Funds Secured', label_ar: 'أموال في الضمان', icon: ShieldCheck },
  { status: ['shipped'], label: 'Dispatched to Bosta', label_ar: 'تم التسليم لبوسطة', icon: Truck },
  { status: ['out_for_delivery'], label: 'Out for Delivery', label_ar: 'خرج للتوصيل', icon: MapPin },
  { status: ['delivered', 'completed'], label: 'Delivered ✓', label_ar: 'تم التوصيل ✓', icon: CheckCircle2 },
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

function BostaStepper({ status }: { status: MarketplaceOrder['status'] }) {
  const currentRank = ORDER_STATUS_RANK[status] ?? 0;

  return (
    <View style={stepStyles.wrap}>
      {BOSTA_STEPS.map((step, i) => {
        const stepRank = i + 1;
        const done = currentRank >= stepRank;
        const current = currentRank === stepRank;
        const Icon = step.icon;
        const isLast = i === BOSTA_STEPS.length - 1;

        return (
          <View key={i} style={stepStyles.stepRow}>
            <View style={stepStyles.leftCol}>
              <View style={[stepStyles.iconCircle, done && stepStyles.iconCircleDone, current && stepStyles.iconCircleCurrent]}>
                <Icon color={done ? 'white' : '#94A3B8'} size={14} />
              </View>
              {!isLast && <View style={[stepStyles.line, done && stepStyles.lineDone]} />}
            </View>
            <View style={stepStyles.stepContent}>
              <Text style={[stepStyles.stepLabel, done && stepStyles.stepLabelDone]}>{step.label_ar}</Text>
              <Text style={[stepStyles.stepSub, done && stepStyles.stepSubDone]}>{step.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrap: { paddingLeft: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  leftCol: { alignItems: 'center', width: 30 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
  iconCircleDone: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  iconCircleCurrent: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  line: { width: 2, height: 28, backgroundColor: '#E2E8F0', marginVertical: 2 },
  lineDone: { backgroundColor: '#3B82F6' },
  stepContent: { paddingVertical: 6 },
  stepLabel: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  stepLabelDone: { color: '#0F172A' },
  stepSub: { fontSize: 11, color: '#CBD5E1' },
  stepSubDone: { color: '#64748B' },
});

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
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

  useEffect(() => { reload(); }, [orderId]);

  const isBuyer = user?.id === order?.buyer_id;
  const isSeller = user?.id === order?.seller_id;
  const isDelivered = order?.status === 'delivered' || order?.status === 'completed';

  // ── Seller: Dispatch AWB ──
  const handleDispatchAwb = async () => {
    if (!orderId || !awbInput.trim()) return;
    setDispatchingAwb(true);
    try {
      await updateOrderTracking(orderId, { tracking_number: awbInput.trim() });
      Toast.show({ type: 'success', text1: 'تم إضافة رقم التتبع', text2: `AWB: ${awbInput.trim()}` });
      setShowAwbModal(false);
      setAwbInput('');
      await reload();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'خطأ', text2: err.message });
    } finally {
      setDispatchingAwb(false);
    }
  };

  // ── Seller: PIN Verify ──
  const handleVerifyPin = async () => {
    if (!orderId || !enteredPin || enteredPin.length < 4) {
      Toast.show({ type: 'error', text1: 'أدخل رمز التحقق الصحيح' });
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyMeetupPIN(orderId, enteredPin);
      Toast.show({ type: 'success', text1: 'تم التحقق!', text2: result.message });
      await reload();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'رمز خاطئ', text2: err.message });
    } finally {
      setVerifying(false);
    }
  };

  // ── Buyer: Approve Delivery ──
  const handleApprove = async () => {
    Alert.alert(
      'تأكيد استلام الطلب',
      'بالضغط على تأكيد، تقر باستلامك للمنتج وفحصه. سيتم تحرير أموال الضمان للبائع فوراً.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد الاستلام ✓',
          style: 'default',
          onPress: async () => {
            if (!orderId) return;
            setApproving(true);
            try {
              const result = await approveOrderDelivery(orderId);
              Toast.show({ type: 'success', text1: 'تم التأكيد!', text2: result.message });
              await reload();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'خطأ', text2: err.message });
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
      Toast.show({ type: 'error', text1: 'أدخل سبب النزاع' });
      return;
    }
    setFilingDispute(true);
    try {
      const result = await fileOrderDispute(orderId, disputeReason);
      Toast.show({ type: 'success', text1: 'تم فتح النزاع', text2: result.message });
      setShowDisputeModal(false);
      await reload();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'خطأ', text2: err.message });
    } finally {
      setFilingDispute(false);
    }
  };

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
        <Text style={{ color: '#64748B', marginTop: 12 }}>الطلب غير موجود</Text>
      </View>
    );
  }

  const isDisputed = order.status === 'disputed';
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
          <Text style={s.headerTitle}>تفاصيل الطلب</Text>
          <Text style={s.headerSub}>#{order.id.slice(-8).toUpperCase()}</Text>
        </View>
        <View style={[s.statusBadgeHeader, { borderColor: isDisputed ? '#FCA5A5' : '#93C5FD' }]}>
          <Text style={[s.statusBadgeText, { color: isDisputed ? '#EF4444' : '#60A5FA' }]}>
            {isDisputed ? '⚠️ نزاع' : order.status === 'completed' ? '✓ مكتمل' : order.status === 'shipped' ? '🚚 شحن' : order.status === 'delivered' ? '📦 وصل' : '🔒 ضمان'}
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
              <Text style={s.productTitle} numberOfLines={2}>{order.product?.title || 'منتج'}</Text>
              <Text style={s.productAmount}>{order.amount.toLocaleString('ar-EG')} ج.م</Text>
              <Text style={s.productCondition}>
                {isBuyer ? `البائع: ${order.seller?.full_name || 'بائع'}` : `المشتري: ${order.buyer?.full_name || 'مشتري'}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Escrow Protection Banner */}
        {!isDelivered && !isDisputed && (
          <View style={s.escrowBanner}>
            <ShieldCheck color="#10B981" size={18} />
            <Text style={s.escrowText}>أموالك في الضمان الآمن — محمية حتى التسليم والفحص</Text>
          </View>
        )}

        {/* Bosta Tracking Stepper — courier only */}
        {order.handover_method === 'courier' && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Truck color="#3B82F6" size={16} />
              <Text style={s.cardTitle}>تتبع الشحنة (بوسطة مصر)</Text>
            </View>

            <BostaStepper status={order.status} />

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
                <Text style={s.noTrackingText}>في انتظار إرسال البائع رقم التتبع</Text>
              </View>
            )}
          </View>
        )}

        {/* QR Meetup Card */}
        {order.handover_method === 'qr_meetup' && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <QrCode color="#7C3AED" size={16} />
              <Text style={s.cardTitle}>تسليم يدوي بكود التحقق</Text>
            </View>
            {isBuyer && (
              <View style={s.pinDisplay}>
                <Text style={s.pinLabel}>كود التحقق الخاص بك (أعطه للبائع بعد الفحص)</Text>
                <Text style={s.pinCode}>{order.meetup_pin}</Text>
                <Text style={s.pinSub}>لا تعطِ الكود إلا بعد الفحص والرضا الكامل</Text>
              </View>
            )}
            {isSeller && !isDelivered && (
              <View>
                <Text style={s.sellerPinNote}>اطلب من المشتري كود التحقق المكون من 6 أرقام بعد أن يفحص المنتج ويرضى عنه</Text>
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
              <Text style={s.cardTitle}>إرسال رقم بوليصة الشحن</Text>
            </View>
            <Text style={s.noteText}>أرسل المنتج عبر بوسطة مصر وأدخل رقم AWB لتحديث المشتري</Text>
            <TouchableOpacity style={s.dispatchBtn} onPress={() => setShowAwbModal(true)}>
              <Truck color="white" size={16} />
              <Text style={s.dispatchBtnText}>أدخل رقم التتبع (AWB)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Buyer — Inspection Window */}
        {canApprove && (
          <View style={[s.card, { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }]}>
            <View style={s.cardHeader}>
              <Clock color="#10B981" size={16} />
              <Text style={[s.cardTitle, { color: '#065F46' }]}>نافذة الفحص والاستلام (٢٤ ساعة)</Text>
            </View>
            <Text style={[s.noteText, { color: '#047857' }]}>
              فحص المنتج جيداً. إذا كان كل شيء مطابقاً، اضغط تأكيد الاستلام لتحرير أموال البائع.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[s.approveBtn, approving && { opacity: 0.6 }]}
                onPress={handleApprove}
                disabled={approving}
              >
                {approving ? <ActivityIndicator color="white" size="small" /> : <ThumbsUp color="white" size={16} />}
                <Text style={s.approveBtnText}>تأكيد الاستلام ✓</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.disputeBtn} onPress={() => setShowDisputeModal(true)}>
                <ShieldAlert color="#EF4444" size={16} />
                <Text style={s.disputeBtnText}>فتح نزاع</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Dispute can be opened during delivery too */}
        {canDispute && !canApprove && !isDisputed && (
          <TouchableOpacity style={s.disputeOnlyBtn} onPress={() => setShowDisputeModal(true)}>
            <ShieldAlert color="#EF4444" size={16} />
            <Text style={s.disputeBtnText}>السلعة لا تطابق الوصف؟ فتح نزاع</Text>
          </TouchableOpacity>
        )}

        {/* Dispute opened banner */}
        {isDisputed && (
          <View style={[s.card, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
            <ShieldAlert color="#EF4444" size={20} />
            <Text style={[s.cardTitle, { color: '#B91C1C', marginTop: 6 }]}>النزاع قيد المراجعة</Text>
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
              <Text style={s.cardTitle}>عنوان التوصيل</Text>
            </View>
            <Text style={s.addressText}>
              {order.shipping_address.full_name}{'\n'}
              {order.shipping_address.street}{order.shipping_address.building ? ` - عمارة ${order.shipping_address.building}` : ''}{'\n'}
              {order.shipping_address.city} — {order.shipping_address.governorate}{'\n'}
              {order.shipping_address.phone}
            </Text>
          </View>
        )}

        {/* Chat Button */}
        <TouchableOpacity
          style={s.chatBtn}
          onPress={() => router.push(`/chat/${isBuyer ? order.seller_id : order.buyer_id}` as any)}
        >
          <MessageCircle color="#3B82F6" size={18} />
          <Text style={s.chatBtnText}>فتح المحادثة مع {isBuyer ? 'البائع' : 'المشتري'}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* AWB Modal */}
      <Modal visible={showAwbModal} transparent animationType="slide" onRequestClose={() => setShowAwbModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>أدخل رقم AWB من بوسطة</Text>
            <Text style={s.modalSub}>ستجد رقم التتبع في تطبيق بوسطة أو على بوليصة الشحن</Text>
            <TextInput
              value={awbInput}
              onChangeText={setAwbInput}
              placeholder="BSTA-EG-XXXXXXXX"
              style={s.modalInput}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowAwbModal(false)}>
                <Text style={s.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, dispatchingAwb && { opacity: 0.6 }]}
                onPress={handleDispatchAwb}
                disabled={dispatchingAwb}
              >
                {dispatchingAwb ? <ActivityIndicator color="white" size="small" /> : null}
                <Text style={s.modalConfirmText}>تأكيد الشحن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDisputeModal} transparent animationType="slide" onRequestClose={() => setShowDisputeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>فتح نزاع رسمي</Text>
            <Text style={s.modalSub}>أخبرنا بمشكلة السلعة وسنراجع الأمر خلال ٤٨ ساعة. أموالك آمنة في الضمان.</Text>
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
                <Text style={s.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, { backgroundColor: '#EF4444' }, filingDispute && { opacity: 0.6 }]}
                onPress={handleFileDispute}
                disabled={filingDispute}
              >
                {filingDispute ? <ActivityIndicator color="white" size="small" /> : null}
                <Text style={s.modalConfirmText}>فتح النزاع</Text>
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

  noteText: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  addressText: { fontSize: 12.5, color: '#334155', lineHeight: 20 },

  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F3FF', borderRadius: 12, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#DDD6FE' },
  trackBtnText: { fontSize: 12, fontWeight: '700', color: '#7C3AED', flex: 1 },
  noTrackingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#FDE68A' },
  noTrackingText: { fontSize: 12, color: '#92400E', fontWeight: '600' },

  pinDisplay: { alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, gap: 4 },
  pinLabel: { fontSize: 11, color: '#7C3AED', textAlign: 'center' },
  pinCode: { fontSize: 38, fontWeight: '900', color: '#5B21B6', letterSpacing: 8 },
  pinSub: { fontSize: 10, color: '#A78BFA', textAlign: 'center' },
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
