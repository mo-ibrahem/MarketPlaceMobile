// Supabase Edge Function: paymob-webhook
// Receives Paymob HMAC-signed payment callbacks and drives order/boost/wallet state transitions.
// Deploy: supabase functions deploy paymob-webhook
// Paymob Dashboard: Developer → Webhooks → set URL to your Edge Function URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HMAC_SECRET = Deno.env.get('PAYMOB_HMAC_SECRET')!;

// The 21 fields Paymob requires for HMAC-SHA512 verification, in exact alphabetical order.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured',
  'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
  'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan',
  'source_data.sub_type', 'source_data.type', 'success', 'txn_response_code',
];

async function computeHmac(payload: Record<string, any>, secret: string): Promise<string> {
  const concatenated = HMAC_FIELDS.map((field) => {
    const keys = field.split('.');
    let val: any = payload;
    for (const k of keys) val = val?.[k];
    return String(val ?? '');
  }).join('');

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(concatenated);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false, ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const hmacParam = url.searchParams.get('hmac') || '';

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const txn = body?.obj;
  if (!txn) return new Response('Missing transaction object', { status: 400 });

  // HMAC Verification
  const expectedHmac = await computeHmac(txn, HMAC_SECRET);
  if (expectedHmac !== hmacParam) {
    console.error('[PaymobWebhook] HMAC mismatch. Possible spoofed request.');
    return new Response('Unauthorized: HMAC mismatch', { status: 401 });
  }

  // Only process successful payments
  if (txn.success !== true) {
    return new Response('OK: ignored non-success event', { status: 200 });
  }

  const merchantOrderId: string = String(txn.order?.merchant_order_id || '');
  const amountCents: number = Number(txn.amount_cents || 0);
  const txId: string = String(txn.id || '');
  const currency: string = String(txn.currency || 'EGP');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Wallet Top-Up — merchant_order_id: topup_<userId>_<timestamp>
    if (merchantOrderId.startsWith('topup_')) {
      const { data, error } = await supabase.rpc('process_paymob_topup', {
        p_merchant_order_id: merchantOrderId,
        p_paymob_tx_id: parseInt(txId, 10),
        p_amount_cents: amountCents,
        p_currency: currency
      });
      if (error) throw error;
    }

    // 2. Boost Payment — merchant_order_id: boost_<productId>_<tier>_<timestamp>
    else if (merchantOrderId.startsWith('boost_')) {
      // Direct integration for boost webhooks is deprecated in this phase as it's processed on the client side directly
      // If we still receive them, we log and acknowledge.
      console.log('Boost webhook received (deprecated):', merchantOrderId);
    }

    // 3. Marketplace Order — merchant_order_id: ord_<timestamp>
    else if (merchantOrderId.startsWith('ord_')) {
      const { data, error } = await supabase.rpc('process_paymob_order_payment', {
        p_merchant_order_id: merchantOrderId,
        p_paymob_tx_id: parseInt(txId, 10),
        p_amount_cents: amountCents,
        p_currency: currency
      });
      if (error) throw error;
    }
  } catch (err) {
    console.error('[PaymobWebhook] Processing error:', err);
    // Return 200 so Paymob does not retry endlessly; investigate via Supabase logs
    return new Response('OK: internal error logged', { status: 200 });
  }

  return new Response('OK', { status: 200 });
});
