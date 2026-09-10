import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, any>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * These read the real `notifications` table, which is written exclusively by
 * server-side triggers on order_events, messages, wallet_transactions and
 * reviews. It replaces an earlier device-local SecureStore implementation that
 * could only ever show a notification to the device that caused it -- a seller
 * never saw "item sold", because the row was written into the *buyer's* storage.
 *
 * RLS scopes every query here to `auth.uid() = user_id`; there is no SELECT
 * policy that returns anyone else's rows, so nothing filters by user id
 * client-side. Writes go exclusively through the two RPCs below, which derive
 * the acting user from auth.uid() -- there is no INSERT/UPDATE grant on the
 * table itself, and nothing in this app may invent a notification locally.
 */
export async function getRecentNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as any) || [];
}

/** count-only query -- never fetch rows just to count them client-side. */
export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications' as any)
    .select('*', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count || 0;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('mark_notifications_read' as any, { p_ids: ids });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read' as any);
  if (error) throw error;
}

function formatEGP(amount: number): string {
  return `EGP ${Number(amount).toLocaleString('en-EG', { maximumFractionDigits: 0 })}`;
}

function formatEGPAr(amount: number): string {
  return `${Number(amount).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`;
}

/**
 * Copy lives here, not in the database -- the row stores `type` + `payload`,
 * and this renders it in whichever language the viewer currently has selected.
 * Storing rendered strings would freeze a notification's language at write time.
 */
export function getNotificationCopy(
  n: Pick<AppNotification, 'type' | 'payload'>,
  isRTL: boolean,
): { title: string; message: string } {
  const productTitle = n.payload?.product_title || (isRTL ? 'إعلانك' : 'your item');
  const amount = n.payload?.amount;
  const amountText = amount ? (isRTL ? formatEGPAr(amount) : formatEGP(amount)) : '';

  switch (n.type) {
    case 'order_placed':
      return isRTL
        ? { title: '🎉 تم بيع إعلانك', message: `تم طلب "${productTitle}"${amountText ? ` بقيمة ${amountText}` : ''}. جهّز السلعة للشحن.` }
        : { title: '🎉 Item sold', message: `"${productTitle}" was ordered${amountText ? ` for ${amountText}` : ''}. Get it ready to ship.` };

    case 'escrow_secured':
      return isRTL
        ? { title: 'الدفع مؤمّن في الضمان', message: `تم تأمين المبلغ لطلب "${productTitle}". يمكنك الشحن الآن.` }
        : { title: 'Payment secured in escrow', message: `Funds for "${productTitle}" are held in escrow. Safe to ship now.` };

    case 'shipped':
      return isRTL
        ? { title: 'تم شحن طلبك', message: `قام البائع بشحن "${productTitle}".` }
        : { title: 'Your order shipped', message: `The seller shipped "${productTitle}".` };

    case 'out_for_delivery':
      return isRTL
        ? { title: 'الطلب في الطريق إليك', message: `"${productTitle}" خرج للتوصيل الآن.` }
        : { title: 'Out for delivery', message: `"${productTitle}" is out for delivery.` };

    case 'delivered':
      return isRTL
        ? { title: 'تم التسليم — أكّد الاستلام', message: `أكّد استلام "${productTitle}" لتحرير المبلغ للبائع.` }
        : { title: 'Delivered — confirm receipt', message: `Confirm you received "${productTitle}" to release funds to the seller.` };

    case 'completed':
      return isRTL
        ? { title: 'تم تحرير أرباحك', message: `أرباحك من "${productTitle}"${amountText ? ` (${amountText})` : ''} أصبحت متاحة في المحفظة.` }
        : { title: 'Payout released', message: `Your earnings from "${productTitle}"${amountText ? ` (${amountText})` : ''} are now available in your wallet.` };

    case 'disputed':
      return isRTL
        ? { title: 'تم فتح نزاع', message: `تم فتح نزاع بخصوص "${productTitle}".` }
        : { title: 'Dispute opened', message: `A dispute was opened on "${productTitle}".` };

    case 'new_message': {
      const senderName = n.payload?.sender_name || (isRTL ? 'مستخدم إيجي باي' : 'EgyBay User');
      const preview = n.payload?.preview || '';
      return isRTL
        ? { title: `رسالة جديدة من ${senderName}`, message: preview }
        : { title: `New message from ${senderName}`, message: preview };
    }

    case 'top_up':
      return isRTL
        ? { title: 'تم شحن محفظتك', message: `تمت إضافة ${amountText} إلى رصيدك.` }
        : { title: 'Wallet topped up', message: `${amountText} was added to your balance.` };

    // "Request received", never "sent" -- request_wallet_payout only ever
    // inserts a pending row; nothing fulfills a payout yet, so claiming
    // completion here would be exactly the kind of false transaction claim
    // this app doesn't make.
    case 'withdrawal':
      return isRTL
        ? { title: 'تم استلام طلب السحب', message: `طلب سحب ${amountText} قيد المراجعة.` }
        : { title: 'Payout request received', message: `Your request to withdraw ${amountText} is being reviewed.` };

    case 'review_received': {
      const rating = n.payload?.rating;
      const stars = rating ? '⭐'.repeat(Number(rating)) : '';
      return isRTL
        ? { title: 'تقييم جديد', message: `حصلت على تقييم ${stars} على "${productTitle}".` }
        : { title: 'New review', message: `You received a ${stars} rating on "${productTitle}".` };
    }

    case 'rate_purchase':
      return isRTL
        ? { title: 'قيّم عملية الشراء', message: `كيف كانت تجربتك مع "${productTitle}"؟ شارك تقييمك للبائع.` }
        : { title: 'Rate your purchase', message: `How was "${productTitle}"? Leave the seller a rating.` };

    default:
      return isRTL ? { title: 'إشعار', message: '' } : { title: 'Notification', message: '' };
  }
}

/**
 * Web links (`/orders/success?orderId=x`) are not expo-router routes. This maps
 * a notification's stored link onto the mobile route that shows the same thing,
 * returning null when there is no mobile equivalent so the row simply isn't
 * tappable rather than navigating somewhere wrong.
 */
export function notificationRoute(n: AppNotification): string | null {
  const orderId = n.payload?.order_id;
  const productId = n.payload?.product_id;
  const roomId = n.payload?.room_id || n.payload?.chat_room_id;

  switch (n.type) {
    case 'order_placed':
    case 'escrow_secured':
    case 'shipped':
    case 'out_for_delivery':
    case 'delivered':
    case 'completed':
    case 'disputed':
    case 'rate_purchase':
      return orderId ? `/order/${orderId}` : null;
    case 'new_message':
      return roomId ? `/chat/${roomId}` : null;
    case 'top_up':
    case 'withdrawal':
      return '/wallet';
    case 'review_received':
      return productId ? `/products/${productId}` : null;
    default: {
      const link = n.link || '';
      return link.startsWith('/') && !link.startsWith('/orders/success') ? link : null;
    }
  }
}
