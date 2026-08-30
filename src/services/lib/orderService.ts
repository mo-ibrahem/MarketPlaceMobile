import { supabase } from './supabase';
import { holdEscrowForSeller, releaseEscrowToSeller } from './walletService';
import { notifyItemSold } from './notificationService';

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
    const res = await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        orderData: newOrder,
      }),
    });
    const json = await res.json();
    if (json?.success && json?.order) {
      inMemoryOrders[orderId] = newOrder;
      return newOrder;
    }
  } catch (apiErr) {
    console.warn('[OrderService] /api/orders create API warning:', apiErr);
  }

  inMemoryOrders[orderId] = newOrder;
  return newOrder;
}

/**
 * Called after Paymob webhook confirms payment OR after 100% wallet checkout.
 * Transitions the order to escrow_secured and credits the seller's pending balance.
 */
export async function confirmOrderPayment(orderId: string): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found: ' + orderId);

  // 1. Call server API to guarantee Postgres updates bypassing client RLS
  try {
    await fetch('https://egbay.shop/api/wallet/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantOrderId: orderId,
        amountCents: Math.round(order.amount * 100),
        txId: `mobile_confirm_${orderId}`,
        isSuccess: true,
      }),
    });
  } catch (apiErr) {
    console.warn('[OrderService] Mobile server credit sync warning:', apiErr);
  }

  // DB Status is updated securely by the webhook handling /api/wallet/credit. No client DB mutation required.

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'escrow_secured';
  }

  // NOW credit seller escrow — only after real payment is confirmed
  await holdEscrowForSeller(order.seller_id, orderId, order.amount);
  await notifyItemSold(order.seller_id, order.product?.title || 'Your listing', order.amount, orderId, order.shipping_address?.full_name);
}

// ──────────────────────────────────────────────────────────────
// FETCH ORDERS
// ──────────────────────────────────────────────────────────────

/**
 * Fetch all orders for a user (as buyer OR seller)
 */
export async function getUserOrders(userId: string): Promise<MarketplaceOrder[]> {
  try {
    const { data, error } = await supabase
      .from('orders' as any)
      .select('*, products(*), buyer:buyer_id(full_name, avatar_url), seller:seller_id(full_name, avatar_url)')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (data && !error) {
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
          courier_name: row.courier_name || 'Bosta',
          tracking_url: row.tracking_number
            ? `https://bosta.co/tracking-shipment/?trackNumber=${row.tracking_number}`
            : undefined,
          inspection_deadline: row.inspection_deadline,
          product: notesData.product || row.products,
          seller: row.seller,
          buyer: row.buyer,
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
      .select('*, products(*), buyer:buyer_id(full_name, avatar_url), seller:seller_id(full_name, avatar_url)')
      .eq('id', orderId)
      .maybeSingle();

    if (data && !error) {
      let notesData: any = {};
      try {
        notesData = typeof data.notes === 'string' ? JSON.parse(data.notes) : data.notes || {};
      } catch {}

      return {
        id: data.id,
        product_id: data.product_id,
        buyer_id: data.buyer_id,
        seller_id: data.seller_id,
        amount: Number(notesData.amount || 0),
        currency: 'EGP',
        status: data.status,
        handover_method: notesData.handover_method || 'courier',
        meetup_pin: notesData.meetup_pin || '123456',
        shipping_address: data.shipping_address,
        tracking_number: data.tracking_number,
        courier_name: data.courier_name || 'Bosta',
        tracking_url: data.tracking_number
          ? `https://bosta.co/tracking-shipment/?trackNumber=${data.tracking_number}`
          : undefined,
        inspection_deadline: data.inspection_deadline,
        product: data.products,
        seller: data.seller,
        buyer: data.buyer,
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
    await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'release_escrow',
        orderId,
        requesterId: order.buyer_id
      }),
    });
  } catch (err) {
    console.warn('[OrderService] release_escrow API error:', err);
  }

  await releaseEscrowToSeller(order.seller_id, orderId, order.amount * 0.96);

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
    await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  if (order.meetup_pin !== enteredPin.trim()) {
    throw new Error('Invalid verification PIN. Please verify with the buyer');
  }

  order.status = 'delivered';
  inMemoryOrders[orderId] = order;

  try {
    await fetch('https://egbay.shop/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'release_escrow',
        orderId,
        pin: enteredPin,
        requesterId: order.seller_id
      }),
    });
  } catch (err) {
    console.warn('[OrderService] release API error:', err);
  }

  await releaseEscrowToSeller(order.seller_id, orderId, order.amount * 0.96);

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
