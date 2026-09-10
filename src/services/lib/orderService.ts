import { supabase } from './supabase';
import { holdEscrowForSeller, releaseEscrowToSeller } from './walletService';

export interface MarketplaceOrder {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  status:
    | 'pending_payment'
    | 'escrow_secured'
    | 'shipped'
    | 'out_for_delivery'
    | 'delivered'
    | 'completed'
    | 'disputed'
    | 'cancelled';
  handover_method: 'courier' | 'qr_meetup';
  meetup_pin?: string;
  shipping_address?: {
    full_name: string;
    phone: string;
    governorate: string;
    city: string;
    street: string;
    building?: string;
  };
  tracking_number?: string;
  courier_name?: string;
  tracking_url?: string;
  inspection_deadline?: string; // ISO — 24h after delivery
  dispute_reason?: string;
  product?: {
    id: string;
    title: string;
    price: number;
    images: string[];
    condition: string;
    category: string;
  };
  product_snapshot?: any;
  seller?: {
    full_name?: string;
    avatar_url?: string;
  };
  buyer?: {
    full_name?: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at?: string;
}

// In-memory fallback orders
let inMemoryOrders: Record<string, MarketplaceOrder> = {};

// ──────────────────────────────────────────────────────────────
// CREATE ORDER
// ──────────────────────────────────────────────────────────────

/**
 * Create a new Marketplace Order with Escrow
 */
export async function createMarketplaceOrder(orderData: {
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  handover_method: 'courier' | 'qr_meetup';
  shipping_address?: MarketplaceOrder['shipping_address'];
  product_snapshot?: MarketplaceOrder['product'];
}): Promise<MarketplaceOrder> {
  const orderId = `ord_${Date.now()}`;
  const randomPin = Math.floor(100000 + Math.random() * 900000).toString();

  const newOrder: MarketplaceOrder = {
    id: orderId,
    product_id: orderData.product_id,
    buyer_id: orderData.buyer_id,
    seller_id: orderData.seller_id,
    amount: orderData.amount,
    currency: 'EGP',
    status: 'pending_payment', // stays here until Paymob webhook or 100% wallet confirms
    handover_method: orderData.handover_method,
    meetup_pin: randomPin,
    shipping_address: orderData.shipping_address,
    product: orderData.product_snapshot,
    created_at: new Date().toISOString(),
  };

  // Direct client-side DB insert removed for security. Relying strictly on API route.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        action: 'create',
        orderData: newOrder,
      }),
    });
    const json = await res.json();
    if (json?.success && json?.order) {
      // Map the backend's generated handover_pin to meetup_pin for the UI
      json.order.meetup_pin = json.order.handover_pin;
      inMemoryOrders[json.order.id] = json.order;
      return json.order as MarketplaceOrder;
    } else {
      throw new Error(json?.error || 'Failed to create order on server');
    }
  } catch (apiErr) {
    console.warn('[OrderService] /api/orders create API warning:', apiErr);
    throw apiErr;
  }
}

/**
 * Called after Paymob webhook confirms payment OR after 100% wallet checkout.
 * Transitions the order to escrow_secured and credits the seller's pending balance.
 */
export async function confirmOrderPayment(orderId: string): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found: ' + orderId);

  // Payment confirmation is strictly handled by backend webhooks (/api/wallet/credit)
  // We simply wait for the webhook to update the DB, no client-side mutations.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Just poll backend once to force a refresh if possible, or rely on UI reload
      await fetch(`https://egbay.shop/api/orders?id=${orderId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
    }
  } catch (e) {
    console.warn('Silent refresh error:', e);
  }
}

// ──────────────────────────────────────────────────────────────
// FETCH ORDERS
// ──────────────────────────────────────────────────────────────



/**
 * Explicit column list -- never select('*') on orders from the client.
 *
 * `orders` carries column-level SELECT grants: handover_pin_hash and
 * handover_pin_encrypted are deliberately NOT readable, because a seller on an
 * order could otherwise read the hash and brute-force the 6-digit PIN offline.
 * Postgres denies the whole statement when a select('*') touches a column the
 * role lacks, so `select('*')` here returned 42501 "permission denied for table
 * orders" for every caller -- both order screens fell back to empty in-memory
 * data and a seller with real orders saw none.
 *
 * courier_name, inspection_deadline and dispute_reason are not granted either
 * and are therefore not requested; the mapping defaults them.
 */
const ORDER_COLUMNS =
  'id, buyer_id, seller_id, product_id, amount, status, handover_method, ' +
  'shipping_address, tracking_number, notes, product_snapshot, payment_id, ' +
  'paymob_transaction_id, shipped_at, delivered_at, created_at, updated_at';

/**
 * orders.buyer_id / seller_id are FKs to auth.users, which PostgREST cannot
 * embed from the public schema. Requesting `buyer:buyer_id(...)` made the whole
 * query fail with PGRST200 ("Could not find a relationship between 'orders' and
 * 'buyer_id'"), the catch swallowed it, and both order screens silently fell
 * back to empty in-memory data -- so a seller with eleven real orders saw none.
 *
 * Names come from public_profiles in a second query instead, the same pattern
 * used for reviewers and chat participants.
 */
async function hydrateOrderParties(
  userIds: string[],
): Promise<Record<string, { full_name?: string; avatar_url?: string }>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('public_profiles' as any)
    .select('id, full_name, avatar_url')
    .in('id', ids);
  const out: Record<string, { full_name?: string; avatar_url?: string }> = {};
  for (const row of (data as any[]) || []) {
    out[row.id] = { full_name: row.full_name, avatar_url: row.avatar_url };
  }
  return out;
}

/**
 * Fetch all orders for a user (as buyer OR seller)
 */
export async function getUserOrders(userId: string): Promise<MarketplaceOrder[]> {
  try {
    const { data, error } = await supabase
      .from('orders' as any)
      .select(`${ORDER_COLUMNS}, products(*)`)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data) {
      const parties = await hydrateOrderParties(
        (data as any[]).flatMap(r => [r.buyer_id, r.seller_id]),
      );
      return (data as any[]).map(row => {
        let notesData: any = {};
        try {
          notesData = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes || {};
        } catch {}
        return {
          id: row.id,
          product_id: row.product_id,
          buyer_id: row.buyer_id,
          seller_id: row.seller_id,
          amount: Number(notesData.amount || row.amount || 0),
          currency: 'EGP',
          status: row.status,
          handover_method: notesData.handover_method || 'courier',
          meetup_pin: notesData.meetup_pin,
          shipping_address: row.shipping_address,
          tracking_number: row.tracking_number,
          courier_name: 'Bosta',
          tracking_url: row.tracking_number
            ? `https://bosta.co/tracking-shipment/?trackNumber=${row.tracking_number}`
            : undefined,

          product: notesData.product || row.products,
          seller: parties[row.seller_id],
          buyer: parties[row.buyer_id],
          created_at: row.created_at,
          updated_at: row.updated_at,
        } as MarketplaceOrder;
      });
    }
  } catch (err) {
    console.warn('[OrderService] getUserOrders fallback:', err);
  }

  // Return in-memory orders for this user
  return Object.values(inMemoryOrders).filter(
    o => o.buyer_id === userId || o.seller_id === userId
  );
}

/**
 * Fetch Order details by ID
 */
export async function getOrderById(orderId: string): Promise<MarketplaceOrder | null> {
  if (inMemoryOrders[orderId]) {
    return inMemoryOrders[orderId];
  }

  try {
    const { data, error } = await supabase
      .from('orders' as any)
      .select(`${ORDER_COLUMNS}, products(*)`)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;

    if (data) {
      let notesData: any = {};
      try {
        notesData = typeof data.notes === 'string' ? JSON.parse(data.notes) : data.notes || {};
      } catch {}

      const parties = await hydrateOrderParties([data.buyer_id, data.seller_id]);

      return {
        id: data.id,
        product_id: data.product_id,
        buyer_id: data.buyer_id,
        seller_id: data.seller_id,
        amount: Number(notesData.amount || 0),
        currency: 'EGP',
        status: data.status,
        handover_method: notesData.handover_method || 'courier',
        meetup_pin: notesData.meetup_pin,
        shipping_address: data.shipping_address,
        tracking_number: data.tracking_number,
        courier_name: 'Bosta',
        tracking_url: data.tracking_number
          ? `https://bosta.co/tracking-shipment/?trackNumber=${data.tracking_number}`
          : undefined,

        product: data.products,
        seller: parties[data.seller_id],
        buyer: parties[data.buyer_id],
        created_at: data.created_at,
      };
    }
  } catch (err) {
    console.warn('[OrderService] Supabase getOrderById fallback:', err);
  }

  return inMemoryOrders[orderId] || null;
}

// ──────────────────────────────────────────────────────────────
// SELLER ACTIONS
// ──────────────────────────────────────────────────────────────

/**
 * Seller dispatches the item — adds AWB tracking number and updates status to 'shipped'
 */
export async function updateOrderTracking(
  orderId: string,
  params: { tracking_number: string; courier_name?: string }
): Promise<void> {
  const trackingUrl = `https://bosta.co/tracking-shipment/?trackNumber=${params.tracking_number}`;

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].tracking_number = params.tracking_number;
    inMemoryOrders[orderId].courier_name = params.courier_name || 'Bosta';
    inMemoryOrders[orderId].tracking_url = trackingUrl;
    inMemoryOrders[orderId].status = 'shipped';
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        action: 'update_tracking',
        orderId,
        tracking_number: params.tracking_number,
        courier_name: params.courier_name || 'Bosta'
      }),
    });
  } catch (err) {
    console.warn('[OrderService] updateOrderTracking API fallback error:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// BUYER ACTIONS
// ──────────────────────────────────────────────────────────────

/**
 * Buyer approves receipt within 24h inspection window — releases escrow to seller
 */
export async function approveOrderDelivery(orderId: string): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        action: 'release_escrow',
        orderId
      }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to release escrow');
  } catch (err) {
    console.warn('[OrderService] release_escrow API error:', err);
    throw err;
  }

  // Reload order state if possible or rely on UI refresh

  return {
    success: true,
    message: `تم تأكيد الاستلام بنجاح. تم تحرير EGP ${(order.amount * 0.96).toLocaleString()} لحساب البائع.`,
  };
}

/**
 * Buyer opens a dispute before inspection deadline
 */
export async function fileOrderDispute(
  orderId: string,
  reason: string,
  evidence?: string
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'disputed';
    inMemoryOrders[orderId].dispute_reason = reason;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        action: 'dispute',
        orderId,
        reason,
        notes: reason,
        evidence
      }),
    });
  } catch (err) {
    console.warn('[OrderService] dispute API error:', err);
  }

  return {
    success: true,
    message:
      'تم فتح النزاع بنجاح. أموالك محفوظة في الضمان. سيراجع فريقنا الأدلة خلال ٤٨ ساعة.',
  };
}

// ──────────────────────────────────────────────────────────────
// MEETUP PIN (existing — kept as-is)
// ──────────────────────────────────────────────────────────────

/**
 * Verify Handover PIN for in-person meetup and release escrow funds immediately
 */
export async function verifyMeetupPIN(
  orderId: string,
  enteredPin: string
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  if (order.status === 'completed' || order.status === 'delivered') {
    return { success: true, message: 'Order is already delivered and settled' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        action: 'release_escrow',
        orderId,
        pin: enteredPin
      }),
    });
    const result = await res.json();
    if (!result.success) {
       throw new Error(result.error || 'Invalid verification PIN.');
    }
  } catch (err) {
    console.warn('[OrderService] release API error:', err);
    throw err;
  }

  order.status = 'delivered';
  inMemoryOrders[orderId] = order;

  return {
    success: true,
    message: `تم التحقق! تم تحرير EGP ${(order.amount * 0.96).toLocaleString()} إلى محفظة البائع`,
  };
}

/**
 * Confirm receipt by buyer (for courier delivery) and release escrow funds
 */
export async function confirmBuyerReceipt(orderId: string): Promise<{ success: boolean; message: string }> {
  return approveOrderDelivery(orderId);
}
