import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

export interface AppNotification {
  id: string;
  userId: string;
  type: 'item_sold' | 'order_confirmed' | 'escrow_held' | 'escrow_released' | 'out_for_delivery';
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_STORAGE_KEY = 'egbay_user_notifications';

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const raw = await SecureStore.getItemAsync(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<AppNotification> {
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const current = await getNotifications(notif.userId);
    const updated = [newNotif, ...current].slice(0, 50);
    await SecureStore.setItemAsync(`${NOTIFICATIONS_STORAGE_KEY}_${notif.userId}`, JSON.stringify(updated));
  } catch (e) {
    console.warn('[NotificationService] Failed to save notification:', e);
  }

  return newNotif;
}

export async function notifyItemSold(sellerId: string, itemTitle: string, amountEgp: number, orderId: string, buyerName?: string): Promise<AppNotification> {
  Toast.show({
    type: 'success',
    text1: '🎉 Item Sold! (New Order)',
    text2: `"${itemTitle}" was purchased for EGP ${amountEgp.toLocaleString()}. Net payout secured in Escrow.`,
    visibilityTime: 6000,
  });

  return saveNotification({
    userId: sellerId,
    type: 'item_sold',
    title: '🎉 Item Sold! (New Order)',
    title_ar: '🎉 تم بيع سلعتك! (طلب جديد)',
    message: `${buyerName || 'A buyer'} ordered "${itemTitle}" for EGP ${amountEgp.toLocaleString()}. Net payout is secured in your Escrow Pending Balance.`,
    message_ar: `قام مشتري بطلب "${itemTitle}" بقيمة ${amountEgp.toLocaleString()} ج.م. الأرباح محجوزة بأمان في رصيد الضمان المعلق.`,
    data: { orderId, itemTitle, amountEgp },
  });
}
