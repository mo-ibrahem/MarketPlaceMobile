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
  Tag,
  Clock,
  ChevronRight,
  CheckCircle2,
  Truck,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
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
  escrow_secured: { label: 'Secured ✓', label_ar: 'في الضمان', color: '#3B82F6', icon: ShieldCheck },
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
  const StatusIcon = cfg.icon;
  const image = (order.product_snapshot as any)?.images?.[0] || order.product?.images?.[0];
  const dateStr = new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { day: 'numeric', month: 'short' });

  const rank = RANK[order.status] ?? 0;
  const trackable = order.status !== 'pending_payment' && order.status !== 'cancelled';
  const pct = Math.round((Math.min(rank, 4) / 4) * 100);
  const CurIcon = trackable ? STATUS_CONFIG[STEP_ORDER[Math.min(Math.max(rank - 1, 0), 3)]].icon : StatusIcon;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={styles.cardHead} accessibilityState={{ expanded }}>
        <View style={styles.cardImageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
              <Package color="#94A3B8" size={24} />
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <View style={[styles.roleBadge, { backgroundColor: isBuyer ? '#EFF6FF' : '#FFF7ED' }]}>
              <Text style={[styles.roleText, { color: isBuyer ? '#2563EB' : '#EA580C' }]}>
                {isBuyer ? (isRTL ? 'مشتري' : 'Buying') : (isRTL ? 'بائع' : 'Selling')}
              </Text>
            </View>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {(order.product_snapshot as any)?.title || order.product?.title || (isRTL ? 'منتج' : 'Item')}
          </Text>
          <Text style={styles.cardAmount}>
            {isRTL ? `${order.amount.toLocaleString('ar-EG')} ج.م` : `EGP ${order.amount.toLocaleString('en-EG')}`}
          </Text>
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18' }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{isRTL ? cfg.label_ar : cfg.label}</Text>
          </View>
          <ChevronRight color="#CBD5E1" size={16} style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expand}>
          {trackable ? (
            <>
              <View style={styles.progHead}>
                <View style={styles.progIcon}><CurIcon color="#FFFFFF" size={18} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.progLabel}>{isRTL ? 'الحالة الآن' : 'Right now'}</Text>
                  <Text style={styles.progValue} numberOfLines={1}>{isRTL ? cfg.label_ar : cfg.label}</Text>
                </View>
                <Text style={styles.progPct}>{pct}%</Text>
              </View>
              <View style={styles.rail}>
                {STEP_ORDER.map((k, i) => <View key={k} style={[styles.seg, rank >= i + 1 && styles.segDone]} />)}
              </View>
              <View style={styles.rail}>
                {STEP_ORDER.map((k, i) => (
                  <Text key={k} style={[styles.tick, rank >= i + 1 && styles.tickDone]} numberOfLines={1}>
                    {isRTL ? STEP_SHORT[k].ar : STEP_SHORT[k].en}
                  </Text>
                ))}
              </View>
            </>
          ) : order.status === 'pending_payment' ? (
            <View style={styles.note}>
              <Clock color="#D97706" size={18} />
              <Text style={[styles.noteText, { color: '#92400E' }]}>
                {isRTL
                  ? 'لم يتم تأكيد الدفع بعد — لم يصل أي مبلغ إلى الضمان. إذا لم يصل التأكيد، يُلغى الطلب تلقائياً.'
                  : 'Payment not confirmed yet — nothing has reached escrow. If confirmation never arrives, this order cancels itself.'}
              </Text>
            </View>
          ) : (
            <View style={styles.note}>
              <AlertCircle color="#94A3B8" size={18} />
              <Text style={[styles.noteText, { color: '#64748B' }]}>
                {isRTL ? 'تم إلغاء هذا الطلب. لا توجد أموال محتجزة.' : 'This order was cancelled. No funds are being held.'}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onOpen} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>{isRTL ? 'عرض الطلب' : 'View order'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={onChat} activeOpacity={0.85}>
              <Text style={styles.ghostBtnText}>
                {isRTL ? (isBuyer ? 'راسل البائع' : 'راسل المشتري') : `Message ${isBuyer ? 'seller' : 'buyer'}`}
              </Text>
            </TouchableOpacity>
          </View>
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
    if (!PAYMENTS_ENABLED) { setLoading(false); setRefreshing(false); return; }
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
    { key: 'all', label: isRTL ? `الكل (${orders.length})` : `All (${orders.length})`, count: orders.length },
    { key: 'purchases', label: isRTL ? 'مشتريات 🛍️' : '🛍️ Buying', count: purchases.length },
    { key: 'sales', label: isRTL ? 'مبيعات 🏷️' : '🏷️ Selling', count: sales.length },
  ];

  // Classifieds mode: there are no orders right now (see PLAN-CLASSIFIEDS-MODE.md).
  if (!PAYMENTS_ENABLED) {
    return <NotAvailableYet />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isRTL ? 'الطلبات' : 'Orders'}</Text>
          <Text style={styles.headerSub}>
            {isRTL ? 'كل طلب محفوظ في الضمان حتى تؤكد.' : 'Every order is held in escrow until you confirm.'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading || refreshing}>
          <RefreshCw color="#64748B" size={16} />
          <Text style={styles.refreshText}>{isRTL ? 'تحديث' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {/* Pill Tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsContainer}>
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
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3665F3" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3665F3" />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Package color="#3665F3" size={36} strokeWidth={2} />
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
                  <Lock color="#7C3AED" size={24} strokeWidth={2} />
                  <Text style={styles.trustTitle}>{isRTL ? 'دفع وتسويات موثقة' : 'Trusted payouts'}</Text>
                  <Text style={styles.trustDesc}>{isRTL ? 'تسويات فورية عبر شبكة إنستاباي' : 'Instant settlement over InstaPay'}</Text>
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
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingTop: 16, 
    paddingBottom: 16,
    backgroundColor: '#F8FAFC'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerIconBox: {
    width: 44,
    height: 44,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3665F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#0F172A', letterSpacing: -1.2, lineHeight: 34 },
  headerSub: { fontSize: 13, color: '#64748B', marginTop: 4 },
  
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },

  tabsWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    padding: 4,
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
  tabLabelActive: { color: '#3665F3', fontWeight: '900' },

  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expand: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  progHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  progLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  progValue: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  progPct: { fontSize: 14, fontWeight: '800', color: '#94A3B8' },
  rail: { flexDirection: 'row', gap: 6, marginTop: 10 },
  seg: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0' },
  segDone: { backgroundColor: '#0F172A' },
  tick: { flex: 1, fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: -4 },
  tickDone: { color: '#0F172A', fontWeight: '700' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryBtn: { flex: 1, height: 40, borderRadius: 999, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  ghostBtn: { height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  card: {
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageWrap: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden', flexShrink: 0 },
  cardImage: { width: '100%', height: '100%' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  cardAmount: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4, marginBottom: 2 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  roleText: { fontSize: 11, fontWeight: '800' },
  dateText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  awbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  awbText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
  cardRight: { alignItems: 'flex-end', gap: 10, flexShrink: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '800' },

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
    backgroundColor: '#3665F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#3665F3',
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
