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
  product?: {
    id: string;
    title: string;
    price: number;
    images: string[];
    condition: string;
    category: string;
  };
  created_at: string;
  updated_at?: string;
}

// In-memory fallback orders
let inMemoryOrders: Record<string, MarketplaceOrder> = {};

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
    status: 'escrow_secured',
    handover_method: orderData.handover_method,
    meetup_pin: randomPin,
    shipping_address: orderData.shipping_address,
    product: orderData.product_snapshot,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('orders' as any)
      .insert({
        id: orderId,
        product_id: orderData.product_id,
        buyer_id: orderData.buyer_id,
        seller_id: orderData.seller_id,
        status: 'escrow_secured',
        notes: JSON.stringify({
          handover_method: orderData.handover_method,
          meetup_pin: randomPin,
          amount: orderData.amount,
        }),
        shipping_address: orderData.shipping_address,
        created_at: new Date().toISOString(),
      } as any)
      .select()
      .maybeSingle();

    if (data && !error) {
      // Hold funds in seller's pending escrow balance
      await holdEscrowForSeller(orderData.seller_id, orderId, orderData.amount);
      inMemoryOrders[orderId] = newOrder;
      return newOrder;
    }
  } catch (err) {
    console.warn('[OrderService] Supabase insert fallback to memory:', err);
  }

  // Hold funds in memory
  await holdEscrowForSeller(orderData.seller_id, orderId, orderData.amount);
  inMemoryOrders[orderId] = newOrder;
  return newOrder;
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
      .select('*, products(*)')
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
        product: data.products,
        created_at: data.created_at,
      };
    }
  } catch (err) {
    console.warn('[OrderService] Supabase getOrderById fallback:', err);
  }

  return inMemoryOrders[orderId] || null;
}

/**
 * Verify Handover PIN for in-person meetup and release escrow funds immediately
 */
export async function verifyMeetupPIN(
  orderId: string,
  enteredPin: string
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === 'completed' || order.status === 'delivered') {
    return { success: true, message: 'Order is already delivered and settled' };
  }

  if (order.meetup_pin !== enteredPin.trim()) {
    throw new Error('Invalid verification PIN. Please verify with the buyer');
  }

  // Update order status to delivered
  order.status = 'delivered';
  inMemoryOrders[orderId] = order;

  try {
    await supabase
      .from('orders' as any)
      .update({ status: 'delivered', delivered_at: new Date().toISOString() } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[OrderService] Error updating order status in Supabase:', err);
  }

  // Release escrow funds to seller
  await releaseEscrowToSeller(order.seller_id, orderId, order.amount * 0.95);

  return {
    success: true,
    message: `PIN verified! EGP ${(order.amount * 0.95).toLocaleString()} has been released to the seller wallet`,
  };
}

/**
 * Confirm receipt by buyer (for courier delivery) and release escrow funds
 */
export async function confirmBuyerReceipt(orderId: string): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  order.status = 'delivered';
  inMemoryOrders[orderId] = order;

  try {
    await supabase
      .from('orders' as any)
      .update({ status: 'delivered', delivered_at: new Date().toISOString() } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[OrderService] Error updating order in Supabase:', err);
  }

  await releaseEscrowToSeller(order.seller_id, orderId, order.amount * 0.95);

  return {
    success: true,
    message: `Receipt confirmed! EGP ${(order.amount * 0.95).toLocaleString()} released to seller`,
  };
}
