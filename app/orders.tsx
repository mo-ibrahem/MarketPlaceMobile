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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Package,
  ShoppingBag,
  Tag,
  Clock,
  ChevronRight,
  CheckCircle2,
  Truck,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { getUserOrders, type MarketplaceOrder } from '../src/services/lib/orderService';

type TabKey = 'purchases' | 'sales' | 'all';

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
  const image = order.product?.images?.[0];
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
          {order.product?.title || 'منتج'}
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
  const [activeTab, setActiveTab] = useState<TabKey>('purchases');

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
    { key: 'purchases', label: '🛍️ مشترياتي', count: purchases.length },
    { key: 'sales', label: '🏷️ مبيعاتي', count: sales.length },
    { key: 'all', label: 'الكل', count: orders.length },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Text style={styles.headerTitle}>سجل الطلبات</Text>
        <Text style={styles.headerSub}>Order History</Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, activeTab === tab.key && { color: '#3B82F6' }]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                {activeTab === 'purchases' ? <ShoppingBag color="#94A3B8" size={32} /> : <Tag color="#94A3B8" size={32} />}
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'purchases' ? 'لا توجد مشتريات بعد' : activeTab === 'sales' ? 'لا توجد مبيعات بعد' : 'لا توجد طلبات'}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'purchases'
                  ? 'تصفح المنتجات وأجر أول عملية شراء بضمان كامل'
                  : 'أضف منتجاتك للبيع وابدأ رحلة البيع الآمن'}
              </Text>
            </View>
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
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: 'white' },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    gap: 4,
  },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#3B82F6' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabLabelActive: { color: '#3B82F6', fontWeight: '800' },
  tabCount: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  tabCountActive: { backgroundColor: '#EFF6FF' },
  tabCountText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },

  list: { padding: 12, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageWrap: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0 },
  cardImage: { width: '100%', height: '100%' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  cardAmount: { fontSize: 14, fontWeight: '900', color: '#3B82F6', marginBottom: 2 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  roleText: { fontSize: 10, fontWeight: '800' },
  dateText: { fontSize: 10, color: '#94A3B8' },
  awbRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  awbText: { fontSize: 10, color: '#7C3AED', fontWeight: '600' },
  cardRight: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
