import { supabase } from './supabase';
import { releaseEscrowToSeller } from './walletService';

export interface BostaShipment {
  awbNumber: string;
  trackingUrl: string;
  orderId: string;
  senderName: string;
  senderPhone: string;
  senderCity: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverGovernorate: string;
  packageDescription: string;
  shippingFeeBuyer: number; // What buyer paid (e.g. 55 EGP)
  carrierCost: number;     // What Bosta costs (e.g. 38 EGP)
  platformMargin: number;  // Our profit (e.g. 17 EGP)
  status: 'pickup_requested' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned';
  createdAt: string;
  deliveredAt?: string;
}

export const GOVERNORATE_SHIPPING_RATES: Record<string, { buyerFee: number; bostaCost: number }> = {
  Cairo: { buyerFee: 45, bostaCost: 32 },
  Giza: { buyerFee: 45, bostaCost: 32 },
  Alexandria: { buyerFee: 55, bostaCost: 38 },
  Qalyubia: { buyerFee: 50, bostaCost: 35 },
  Gharbia: { buyerFee: 55, bostaCost: 38 },
  Dakahlia: { buyerFee: 55, bostaCost: 38 },
  Sharqia: { buyerFee: 55, bostaCost: 38 },
  Monufia: { buyerFee: 55, bostaCost: 38 },
  Beheira: { buyerFee: 55, bostaCost: 38 },
  'Kafr El Sheikh': { buyerFee: 55, bostaCost: 38 },
  Damietta: { buyerFee: 55, bostaCost: 38 },
  'Port Said': { buyerFee: 60, bostaCost: 40 },
  Ismailia: { buyerFee: 60, bostaCost: 40 },
  Suez: { buyerFee: 60, bostaCost: 40 },
  Fayoum: { buyerFee: 65, bostaCost: 45 },
  'Beni Suef': { buyerFee: 65, bostaCost: 45 },
  Minya: { buyerFee: 65, bostaCost: 45 },
  Asyut: { buyerFee: 65, bostaCost: 45 },
  Sohag: { buyerFee: 70, bostaCost: 48 },
  Qena: { buyerFee: 70, bostaCost: 48 },
  Luxor: { buyerFee: 70, bostaCost: 48 },
  Aswan: { buyerFee: 75, bostaCost: 50 },
  'Red Sea': { buyerFee: 75, bostaCost: 50 },
  Matrouh: { buyerFee: 75, bostaCost: 50 },
  'South Sinai': { buyerFee: 80, bostaCost: 55 },
  'North Sinai': { buyerFee: 80, bostaCost: 55 },
};

export function getShippingRate(governorate: string = 'Cairo') {
  const rate = GOVERNORATE_SHIPPING_RATES[governorate] || { buyerFee: 55, bostaCost: 38 };
  return {
    buyerFee: rate.buyerFee,
    bostaCost: rate.bostaCost,
    platformMargin: rate.buyerFee - rate.bostaCost,
  };
}

// In-memory shipment store
let inMemoryShipments: Record<string, BostaShipment> = {};

/**
 * Create a Bosta courier shipment for an order
 */
export async function createBostaShipment(params: {
  orderId: string;
  senderName: string;
  senderPhone: string;
  senderCity: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverGovernorate: string;
  itemTitle: string;
}): Promise<BostaShipment> {
  const rate = getShippingRate(params.receiverGovernorate);
  const awbNumber = `BSTA-EG-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const trackingUrl = `https://bosta.co/tracking-shipment/?trackNumber=${awbNumber}`;

  const shipment: BostaShipment = {
    awbNumber,
    trackingUrl,
    orderId: params.orderId,
    senderName: params.senderName,
    senderPhone: params.senderPhone,
    senderCity: params.senderCity,
    receiverName: params.receiverName,
    receiverPhone: params.receiverPhone,
    receiverAddress: params.receiverAddress,
    receiverGovernorate: params.receiverGovernorate,
    packageDescription: `EgyBay Secured Parcel: ${params.itemTitle}`,
    shippingFeeBuyer: rate.buyerFee,
    carrierCost: rate.bostaCost,
    platformMargin: rate.platformMargin,
    status: 'pickup_requested',
    createdAt: new Date().toISOString(),
  };

  try {
    await supabase
      .from('orders')
      .update({
        tracking_number: awbNumber,
        shipping_address: {
          ...params,
          carrier: 'Bosta Logistics Egypt',
          trackingUrl,
          platformProfitEGP: rate.platformMargin,
        },
      } as any)
      .eq('id', params.orderId);
  } catch (err) {
    console.warn('[BostaService] Error updating order tracking in Supabase:', err);
  }

  inMemoryShipments[params.orderId] = shipment;
  return shipment;
}

/**
 * Courier delivery webhook trigger: when Bosta scans item as DELIVERED, automatically release escrow to seller!
 */
export async function handleBostaDeliveryConfirmation(
  orderId: string,
  sellerId: string,
  netAmount: number
): Promise<void> {
  if (inMemoryShipments[orderId]) {
    inMemoryShipments[orderId].status = 'delivered';
    inMemoryShipments[orderId].deliveredAt = new Date().toISOString();
  }

  // 1. Update order status to delivered
  try {
    await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[BostaService] Error updating order status in Supabase:', err);
  }

  // 2. Automatically release escrow to seller wallet!
  await releaseEscrowToSeller(sellerId, orderId, netAmount);
}
