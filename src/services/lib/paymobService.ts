export interface BillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  city?: string;
  country?: string;
  state?: string;
}

import { supabase } from './supabase';
import { API_BASE } from './apiBase';

export interface PaymobSession {
  paymentToken: string;
  paymobOrderId: string | number;
  iframeUrl: string;
}

interface StartSessionParams {
  /**
   * Orders only. 'boost' is deliberately not representable here: the backend
   * /api/paymob/session rejects purpose: 'boost' with "Invalid purpose",
   * because a card-paid boost has no activation path on the webhook side and
   * would take a seller's money and apply nothing. Boosts are wallet-balance
   * only, via /api/boost -> purchase_boost.
   */
  purpose: 'order';
  referenceId: string;
  billingData: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    city?: string;
    state?: string;
    street?: string;
  };
}

export async function startPaymobCheckoutSession(
  params: StartSessionParams,
): Promise<PaymobSession> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }

  try {
    const res = await fetch(`${API_BASE}/api/paymob/session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to start payment session');
    }

    return {
      paymentToken: data.paymentToken,
      paymobOrderId: data.paymobOrderId,
      iframeUrl: data.iframeUrl,
    };
  } catch (error: any) {
    console.error('[PaymobService] Checkout session failed:', error?.message);
    throw new Error(
      error?.message || 'Could not start Paymob payment session. Please check your connection and try again.',
    );
  }
}
