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
import { getUserOrders, type MarketplaceOrder } from '../src/services/lib/orderService';

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

function OrderCard({ order, userId, onPress }: { order: MarketplaceOrder; userId: string; onPress: () => void }) {
  const isBuyer = order.buyer_id === userId;
  const cfg = STATUS_CONFIG[order.status];
  const StatusIcon = cfg.icon;
  const image = (order.product_snapshot as any)?.images?.[0] || order.product?.images?.[0];
  const dateStr = new Date(order.created_at).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      {/* Product Image */}
      <View style={styles.cardImageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
            <Package color="#94A3B8" size={24} />
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <View style={[styles.roleBadge, { backgroundColor: isBuyer ? '#EFF6FF' : '#FFF7ED' }]}>
            <Text style={[styles.roleText, { color: isBuyer ? '#3B82F6' : '#F97316' }]}>
              {isBuyer ? '🛍️ مشتري' : '🏷️ بائع'}
            </Text>
          </View>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {(order.product_snapshot as any)?.title || order.product?.title || 'منتج'}
        </Text>
        <Text style={styles.cardAmount}>{order.amount.toLocaleString('ar-EG')} ج.م</Text>

        {/* Tracking number */}
        {order.tracking_number && (
          <View style={styles.awbRow}>
            <Truck color="#7C3AED" size={11} />
            <Text style={styles.awbText}>AWB: {order.tracking_number}</Text>
          </View>
        )}
      </View>

      {/* Status + Arrow */}
      <View style={styles.cardRight}>
        <View style={[styles.statusBadge, { borderColor: cfg.color + '40', backgroundColor: cfg.color + '15' }]}>
          <StatusIcon color={cfg.color} size={11} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label_ar}</Text>
        </View>
        <ChevronRight color="#CBD5E1" size={16} />
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getUserOrders(user.id);
      setOrders(data);
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
    { key: 'all', label: `الكل (${orders.length})`, count: orders.length },
    { key: 'purchases', label: 'مشتريات 🛍️', count: purchases.length },
    { key: 'sales', label: 'مبيعات 🏷️', count: sales.length },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBox}>
            <Package color="#3665F3" size={22} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.headerTitle}>سجل الطلبات</Text>
            <Text style={styles.headerSub}>Orders & Escrow</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading || refreshing}>
          <RefreshCw color="#64748B" size={16} />
          <Text style={styles.refreshText}>تحديث</Text>
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
                  {activeTab === 'purchases' ? 'لا توجد مشتريات بعد' : activeTab === 'sales' ? 'لا توجد مبيعات بعد' : 'لا توجد طلبات'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {activeTab === 'purchases'
                    ? 'تصفح المنتجات واشترِ بضمان حماية المشتري المالي وتوصيل بوسطة.'
                    : 'أضف منتجاتك وابدأ رحلة البيع الآمن عبر المنصة.'}
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/' as any)}>
                  <Text style={styles.emptyBtnText}>
                    {activeTab === 'purchases' ? 'تصفح المنتجات' : 'أضف إعلانك'}
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
                  <Text style={styles.trustTitle}>حماية الضمان المالي</Text>
                  <Text style={styles.trustDesc}>أموالك محفوظة بأمان تام حتى فحص الطلب</Text>
                </View>
                <View style={styles.trustItem}>
                  <Truck color="#3B82F6" size={24} strokeWidth={2} />
                  <Text style={styles.trustTitle}>شحن وتوصيل بوسطة</Text>
                  <Text style={styles.trustDesc}>توصيل سريع لكل محافظات مصر</Text>
                </View>
                <View style={styles.trustItem}>
                  <Lock color="#7C3AED" size={24} strokeWidth={2} />
                  <Text style={styles.trustTitle}>دفع وتسويات موثقة</Text>
                  <Text style={styles.trustDesc}>تسويات فورية عبر شبكة إنستاباي</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              userId={user!.id}
              onPress={() => router.push(`/order/${item.id}` as any)}
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
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 2 },
  
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

  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
  cardAmount: { fontSize: 15, fontWeight: '900', color: '#3665F3', marginBottom: 2 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  roleText: { fontSize: 10, fontWeight: '800' },
  dateText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  awbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  awbText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
  cardRight: { alignItems: 'flex-end', gap: 10, flexShrink: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800' },

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
