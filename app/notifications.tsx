import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../src/i18n/LanguageContext';
import {
  getNotificationCopy,
  getRecentNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  notificationRoute,
  type AppNotification,
} from '../src/services/lib/notificationService';
import { PAYMENTS_ENABLED } from '../src/services/lib/platformCommerce';

function timeAgo(iso: string, isRTL: boolean): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'now';
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isRTL ? `منذ ${days} ي` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setError('');
      setItems(await getRecentNotifications(50));
    } catch (err: any) {
      setError(err?.message || (isRTL ? 'تعذّر تحميل الإشعارات.' : 'Could not load notifications.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isRTL]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async (n: AppNotification) => {
    // Mark read optimistically, but re-sync from the server on failure rather
    // than leaving the row looking read when the RPC didn't take.
    if (!n.read_at) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markNotificationsRead([n.id]).catch(() => load());
    }
    const route = notificationRoute(n);
    if (route) router.push(route as any);
  };

  const handleMarkAll = async () => {
    const snapshot = items;
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => (x.read_at ? x : { ...x, read_at: now })));
    try {
      await markAllNotificationsRead();
    } catch {
      setItems(snapshot);
    }
  };

  const unread = items.filter(n => !n.read_at).length;

  const renderItem = ({ item }: { item: AppNotification }) => {
    const { title, message } = getNotificationCopy(item, isRTL);
    const tappable = !!notificationRoute(item);
    return (
      <TouchableOpacity
        style={[s.row, !item.read_at && s.rowUnread]}
        onPress={() => handleOpen(item)}
        activeOpacity={tappable ? 0.7 : 1}
        disabled={!tappable && !!item.read_at}
      >
        {!item.read_at && <View style={s.dot} />}
        <View style={{ flex: 1 }}>
          <Text style={[s.title, !item.read_at && s.titleUnread]} numberOfLines={2}>{title}</Text>
          {!!message && <Text style={s.message} numberOfLines={3}>{message}</Text>}
          <Text style={s.time}>{timeAgo(item.created_at, isRTL)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isRTL ? 'الإشعارات' : 'Notifications'}</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={handleMarkAll} style={s.markAllBtn}>
            <CheckCheck color="#2563EB" size={15} />
            <Text style={s.markAllText}>{isRTL ? 'تعليم الكل' : 'Mark all'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : !user ? (
        <View style={s.center}>
          <Bell color="#CBD5E1" size={44} />
          <Text style={s.emptyTitle}>{isRTL ? 'سجّل الدخول لعرض إشعاراتك' : 'Sign in to see your notifications'}</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={s.retryText}>{isRTL ? 'إعادة المحاولة' : 'Try again'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Bell color="#CBD5E1" size={44} />
              <Text style={s.emptyTitle}>{isRTL ? 'لا توجد إشعارات بعد' : 'No notifications yet'}</Text>
              <Text style={s.emptySub}>
                {PAYMENTS_ENABLED
                  ? (isRTL ? 'ستظهر هنا تحديثات طلباتك ورسائلك ومحفظتك.' : 'Updates about your orders, messages and wallet will appear here.')
                  : (isRTL ? 'ستظهر هنا رسائلك وتحديثات إعلاناتك.' : 'Updates about your messages and listings will appear here.')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: '#0F172A' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#EFF6FF' },
  markAllText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#475569', marginTop: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '700', textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0F172A' },
  retryText: { color: 'white', fontWeight: '800', fontSize: 13 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  rowUnread: { backgroundColor: '#F8FBFF' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0F172A', marginTop: 6 },
  title: { fontSize: 14, fontWeight: '700', color: '#475569' },
  titleUnread: { color: '#0F172A', fontWeight: '800' },
  message: { fontSize: 12.5, color: '#64748B', lineHeight: 18, marginTop: 3 },
  time: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 5 },
});
