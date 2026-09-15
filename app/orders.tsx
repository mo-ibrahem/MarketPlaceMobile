import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../src/i18n/LanguageContext';
import { getUserOrders, type MarketplaceOrder } from '../src/services/lib/orderService';
import NotAvailableYet from '../src/components/NotAvailableYet';
import { PAYMENTS_ENABLED } from '../src/services/lib/platformCommerce';

type TabKey = 'all' | 'purchases' | 'sales';

const STATUS_CONFIG: Record<MarketplaceOrder['status'], { label: string; label_ar: string; color: string; icon: any }> = {
  pending_payment: { label: 'Pending', label_ar: 'قيد الدفع', color: '#F59E0B', icon: Clock },
  escrow_secured: { label: 'Secured', label_ar: 'في الضمان', color: '#3B82F6', icon: ShieldCheck },
  shipped: { label: 'Shipped', label_ar: 'تم الشحن', color: '#8B5CF6', icon: Truck },
  out_for_delivery: { label: 'Out for Delivery', label_ar: 'خرج للتوصيل', color: '#F97316', icon: Truck },
  delivered: { label: 'Delivered', label_ar: 'تم التوصيل', color: '#10B981', icon: CheckCircle2 },
  completed: { label: 'Completed', label_ar: 'مكتمل', color: '#10B981', icon: CheckCircle2 },
  disputed: { label: 'Disputed', label_ar: 'نزاع مفتوح', color: '#EF4444', icon: AlertCircle },
  cancelled: { label: 'Cancelled', label_ar: 'ملغي', color: '#94A3B8', icon: AlertCircle },
};

const STEP_SHORT = {
  escrow_secured: { en: 'Paid', ar: 'مدفوع' },
  shipped: { en: 'Shipped', ar: 'شُحن' },
  out_for_delivery: { en: 'On the way', ar: 'في الطريق' },
  delivered: { en: 'Delivered', ar: 'تم التسليم' },
} as const;
const STEP_ORDER = ['escrow_secured', 'shipped', 'out_for_delivery', 'delivered'] as const;
const RANK: Record<MarketplaceOrder['status'], number> = {
  pending_payment: 0, escrow_secured: 1, shipped: 2, out_for_delivery: 3, delivered: 4, completed: 4, disputed: 1, cancelled: 0,
};

/**
 * An order card that expands in place.
 *
 * The list used to be a row of chevrons: every order looked identical until
 * you left the screen to find out what was happening to it. Tapping a card now
 * opens the progress tracker right there -- the current step in large type, a
 * four-segment rail, and the two actions that matter -- so a buyer scanning
 * five orders learns the state of each without five round trips.
 */
function OrderCard({
  order, userId, isRTL, expanded, onToggle, onOpen, onChat,
}: {
  order: MarketplaceOrder; userId: string; isRTL: boolean;
  expanded: boolean; onToggle: () => void; onOpen: () => void; onChat: () => void;
}) {
  const isBuyer = order.buyer_id === userId;
  const cfg = STATUS_CONFIG[order.status];
  const image = (order.product_snapshot as any)?.images?.[0] || order.product?.images?.[0];
  const dateStr = new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { day: 'numeric', month: 'short' });

  const rank = RANK[order.status] ?? 0;
  const trackable = order.status !== 'pending_payment' && order.status !== 'cancelled';

  return (
    /* Approved build 3e: one flat row per order -- status kicker, title,
       price, a four-segment rail with real stage labels, the escrow
       reassurance line, then the two actions. No accordion: an order you
       have money in should never need a tap to reveal where it is. */
    <View style={[styles.card, (order.status === 'completed' || order.status === 'cancelled') && styles.cardMuted]}>
      <TouchableOpacity style={styles.cardHead} activeOpacity={0.85} onPress={onOpen}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Package color="#94A3B8" size={22} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.statusKicker, { color: cfg.color }]} numberOfLines={1}>
            {`${isRTL ? cfg.label_ar : cfg.label}${dateStr ? ` · ${dateStr}` : ''}`.toUpperCase()}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {(order.product_snapshot as any)?.title || order.product?.title || (isRTL ? 'منتج' : 'Item')}
          </Text>
        </View>
        <Text style={styles.cardAmount}>{Math.round(order.amount).toLocaleString('en-EG')}</Text>
      </TouchableOpacity>

      {trackable ? (
        <>
          <View style={styles.rail}>
            {STEP_ORDER.map((k, i) => <View key={k} style={[styles.seg, rank >= i + 1 && styles.segDone]} />)}
          </View>
          <View style={styles.railLabels}>
            {STEP_ORDER.map((k, i) => (
              <Text key={k} style={[styles.tick, rank >= i + 1 && styles.tickDone]} numberOfLines={1}>
                {isRTL ? STEP_SHORT[k].ar : STEP_SHORT[k].en}
              </Text>
            ))}
          </View>

          <View style={styles.escrowNote}>
            <ShieldCheck size={15} color="#0F172A" />
            <Text style={styles.escrowNoteText}>
              {isBuyer
                ? (isRTL
                    ? `مبلغ ${Math.round(order.amount).toLocaleString('en-EG')} يبقى لدى إيجي باي حتى تستلم وتفحص.`
                    : `Your ${Math.round(order.amount).toLocaleString('en-EG')} stays with Egbay until you inspect it.`)
                : (isRTL
                    ? 'يُحوَّل المبلغ إلى محفظتك بعد تأكيد المشتري للاستلام.'
                    : "The money moves to your wallet once the buyer confirms delivery.")}
            </Text>
          </View>
        </>
      ) : order.status === 'pending_payment' ? (
        <Text style={styles.cardNote}>
          {isRTL
            ? 'لم يتم تأكيد الدفع بعد — لم يصل أي مبلغ إلى الضمان. إذا لم يصل التأكيد، يُلغى الطلب تلقائياً.'
            : 'Payment not confirmed yet — nothing has reached escrow. If confirmation never arrives, this order cancels itself.'}
        </Text>
      ) : order.status === 'cancelled' ? (
        <Text style={styles.cardNote}>
          {isRTL ? 'تم إلغاء هذا الطلب. لا توجد أموال محتجزة.' : 'This order was cancelled. No funds are being held.'}
        </Text>
      ) : null}

      {order.status !== 'completed' && order.status !== 'cancelled' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onOpen} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>
              {trackable && rank >= 2 ? (isRTL ? 'تتبّع الشحنة' : 'Track delivery') : (isRTL ? 'عرض الطلب' : 'View order')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={onChat} activeOpacity={0.85}>
            <Text style={styles.ghostBtnText}>{isRTL ? 'محادثة' : 'Chat'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const fetchOrders = useCallback(async () => {
    // Classifieds mode: nothing here can be reached, so don't even fetch.
    if (!PAYMENTS_ENABLED) return;
    if (!user) return;
    try {
      const data = await getUserOrders(user.id);
      setOrders(data);
      setExpandedId(prev => prev ?? data.find(o => o.status !== 'pending_payment' && o.status !== 'cancelled' && o.status !== 'completed')?.id ?? null);
    } catch (err) {
      console.error('[Orders]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes orders and loading state with the authenticated user.
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const filtered = orders.filter(o => {
    if (activeTab === 'purchases') return o.buyer_id === user?.id;
    if (activeTab === 'sales') return o.seller_id === user?.id;
    return true;
  });

  const purchases = orders.filter(o => o.buyer_id === user?.id);
  const sales = orders.filter(o => o.seller_id === user?.id);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'purchases', label: isRTL ? 'مشتريات' : 'Buying', count: purchases.length },
    { key: 'sales', label: isRTL ? 'مبيعات' : 'Selling', count: sales.length },
    { key: 'all', label: isRTL ? 'الكل' : 'All', count: orders.length },
  ];

  /** Real money in flight: orders whose funds the platform is holding right
   *  now, on whichever side of them this user is. Never a decorative total. */
  const escrowHeld = filtered
    .filter(o => ['escrow_secured', 'shipped', 'out_for_delivery'].includes(o.status))
    .reduce((acc, o) => ({ total: acc.total + Number(o.amount ?? 0), count: acc.count + 1 }), { total: 0, count: 0 });

  // Classifieds mode: there are no orders right now (see PLAN-CLASSIFIEDS-MODE.md).
  if (!PAYMENTS_ENABLED) {
    return <NotAvailableYet />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header (approved build 3e): the title, then the money actually
          held in escrow as the largest number on the screen. The count and
          the total are both real -- summed from the orders in flight, not
          a decorative figure. */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'الطلبات' : 'Orders'}</Text>
        <Text style={styles.headerKicker}>{isRTL ? 'محتجز في الضمان' : 'HELD IN ESCROW'}</Text>
        <View style={styles.escrowRow}>
          <Text style={styles.escrowAmount}>
            {Math.round(escrowHeld.total).toLocaleString('en-EG')}
          </Text>
          <Text style={styles.escrowMeta}>
            {isRTL
              ? `جنيه · ${escrowHeld.count} طلب`
              : `EGP · ${escrowHeld.count} ${escrowHeld.count === 1 ? 'order' : 'orders'}`}
          </Text>
        </View>
      </View>

      {/* Underlined text tabs, not pills. */}
      <View style={styles.tabsWrapper}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Package color="#0F172A" size={36} strokeWidth={2} />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'purchases'
                    ? (isRTL ? 'لا توجد مشتريات بعد' : 'No purchases yet')
                    : activeTab === 'sales'
                      ? (isRTL ? 'لا توجد مبيعات بعد' : 'No sales yet')
                      : (isRTL ? 'لا توجد طلبات' : 'No orders yet')}
                </Text>
                <Text style={styles.emptyDesc}>
                  {activeTab === 'purchases'
                    ? (isRTL
                        ? 'تصفح المنتجات واشترِ بضمان حماية المشتري المالي وتوصيل بوسطة.'
                        : 'Browse listings and buy with escrow protection and Bosta delivery.')
                    : (isRTL
                        ? 'أضف منتجاتك وابدأ رحلة البيع الآمن عبر المنصة.'
                        : 'List an item and start selling safely on EgyBay.')}
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/' as any)}>
                  <Text style={styles.emptyBtnText}>
                    {activeTab === 'purchases'
                      ? (isRTL ? 'تصفح المنتجات' : 'Browse listings')
                      : (isRTL ? 'أضف إعلانك' : 'Create a listing')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListFooterComponent={
            filtered.length === 0 ? (
              <View style={styles.trustFooter}>
                <View style={styles.trustItem}>
                  <ShieldCheck color="#10B981" size={24} strokeWidth={2} />
                  <Text style={styles.trustTitle}>{isRTL ? 'حماية الضمان المالي' : 'Escrow protection'}</Text>
                  <Text style={styles.trustDesc}>{isRTL ? 'أموالك محفوظة بأمان تام حتى فحص الطلب' : 'Your money is held safely until you inspect the item'}</Text>
                </View>
                <View style={styles.trustItem}>
                  <Truck color="#3B82F6" size={24} strokeWidth={2} />
                  <Text style={styles.trustTitle}>{isRTL ? 'شحن وتوصيل بوسطة' : 'Bosta shipping'}</Text>
                  <Text style={styles.trustDesc}>{isRTL ? 'توصيل سريع لكل محافظات مصر' : 'Fast delivery to every governorate in Egypt'}</Text>
                </View>
                <View style={styles.trustItem}>
                  <Lock color="#0F172A" size={24} strokeWidth={2} />
                  <Text style={styles.trustTitle}>{isRTL ? 'دفع وتسويات موثقة' : 'Trusted payouts'}</Text>
                  {/* Payout requests are reviewed manually, never automatic --
                      this used to say "Instant settlement", which the payout
                      backend does not do (requestPayout only ever files a
                      pending request for review). */}
                  <Text style={styles.trustDesc}>{isRTL ? 'مراجعة يدوية عبر إنستاباي والمحافظ' : 'Reviewed payouts via InstaPay & wallets'}</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <OrderCard
            isRTL={isRTL}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onOpen={() => router.push(`/order/${item.id}` as any)}
              onChat={() => router.push(`/order/${item.id}` as any)}
              order={item}
              userId={user!.id}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Approved build (3e) ──────────────────────────────────────────────
  card: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cardMuted: { opacity: 0.6 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#E2E8F0' },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  statusKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A', lineHeight: 20, marginTop: 5 },
  cardAmount: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  rail: { flexDirection: 'row', gap: 5, marginTop: 14 },
  seg: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#E2E8F0' },
  segDone: { backgroundColor: '#0F172A' },
  railLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  tick: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: '#94A3B8' },
  tickDone: { color: '#0F172A' },
  escrowNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#F1F5F9', borderRadius: 12,
  },
  escrowNoteText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
  cardNote: { fontSize: 13, color: '#64748B', lineHeight: 18, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: { flex: 1, height: 44, borderRadius: 999, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  ghostBtn: { height: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -1.1, color: '#0F172A' },
  headerKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#94A3B8', marginTop: 10 },
  escrowRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  escrowAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -1.8, color: '#0F172A', lineHeight: 38 },
  escrowMeta: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  

  tabsWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: { 
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 8, 
    borderRadius: 999,
  },
  tabActive: { 
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  tabLabelActive: { color: '#0F172A', fontWeight: '900' },

  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },


  emptyWrap: { alignItems: 'center', paddingTop: 20 },
  emptyCard: {
    backgroundColor: 'white',
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 10 },
  emptyBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },

  trustFooter: {
    marginTop: 24,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  trustItem: {
    alignItems: 'center',
    gap: 6,
  },
  trustTitle: { fontSize: 15, fontWeight: '800', color: 'white', marginTop: 4 },
  trustDesc: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
});
