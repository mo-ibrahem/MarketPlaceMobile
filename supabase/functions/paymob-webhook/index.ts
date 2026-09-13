// Supabase Edge Function: paymob-webhook
// Receives Paymob HMAC-signed payment callbacks and drives order/topup state transitions.
// Deploy: supabase functions deploy paymob-webhook
// Paymob Dashboard: Developer → Webhooks → set URL to your Edge Function URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HMAC_SECRET = Deno.env.get('PAYMOB_HMAC_SECRET')!;

// The 20 fields Paymob requires for HMAC-SHA512 verification, in exact alphabetical order.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured',
  'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
  'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan',
  'source_data.sub_type', 'source_data.type', 'success',
];

// Matches orders.id, a gen_random_uuid() primary key. Marketplace order
// payments are routed by recognizing this shape rather than a string
// prefix -- see the routing comment below for why.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!HMAC_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return new Response('Webhook not configured', { status: 503 });
  const url = new URL(req.url);
  const hmacParam = url.searchParams.get('hmac') || '';

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  let txn = body?.obj;
  if (!txn) return new Response('Missing transaction object', { status: 400 });

  // HMAC Verification
  const expectedHmac = await computeHmac(txn, HMAC_SECRET);
  if (!/^[a-f0-9]{128}$/i.test(hmacParam) || !constantTimeEqual(expectedHmac, hmacParam.toLowerCase())) {
    console.error('[PaymobWebhook] HMAC mismatch. Possible spoofed request.');
    return new Response('Unauthorized: HMAC mismatch', { status: 401 });
  }

  // HMAC does not cover merchant_order_id. Fetch the transaction directly from
  // Paymob with the server credential before choosing an internal order.
  if (txn.pending !== false || txn.is_auth !== false || txn.is_refunded !== false || txn.is_voided !== false)
    return new Response('OK: ignored unsettled event', { status: 200 });
  const apiKey = Deno.env.get('PAYMOB_API_KEY');
  const integrationId = Deno.env.get('PAYMOB_INTEGRATION_ID');
  if (!apiKey || !integrationId) return new Response('Payment verification not configured', { status: 503 });
  if (!Number.isSafeInteger(txn.id) || txn.id <= 0) return new Response('Invalid transaction ID', { status: 400 });
  try {
    const authResponse = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }), signal: AbortSignal.timeout(10000),
    });
    if (!authResponse.ok) throw new Error('Provider authentication unavailable');
    const { token } = await authResponse.json();
    if (typeof token !== 'string' || !token) throw new Error('Provider authentication unavailable');
    const response = await fetch('https://accept.paymob.com/api/acceptance/transactions/' + txn.id, {
      headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Provider verification unavailable');
    const canonical = await response.json();
    if (canonical.id !== txn.id || String(canonical.order?.id) !== String(txn.order?.id) ||
        canonical.amount_cents !== txn.amount_cents || canonical.currency !== txn.currency ||
        String(canonical.integration_id) !== integrationId ||
        String(canonical.integration_id) !== String(txn.integration_id)) {
      return new Response('Payment verification mismatch', { status: 400 });
    }
    txn = canonical;
  } catch {
    // Do not attach a failure to the caller-supplied, unsigned order reference.
    return new Response('Payment verification temporarily unavailable', { status: 503 });
  }

  const merchantOrderId: string = String(txn.order?.merchant_order_id || '');
  const amountCents: number = Number(txn.amount_cents || 0);
  const txId: string = String(txn.id || '');
  const currency: string = String(txn.currency || '');
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 ||
      !/^[1-9][0-9]*$/.test(txId) || !Number.isSafeInteger(Number(txId)) || currency !== 'EGP') {
    return new Response('Invalid payment fields', { status: 400 });
  }
  if (txn.pending !== false || txn.is_auth !== false || txn.is_refunded !== false || txn.is_voided !== false) {
    return new Response('OK: ignored unsettled event', { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const orderId = UUID_RE.test(merchantOrderId) ? merchantOrderId : null;

  // Writes down what Paymob told us. Everything this function learns about
  // a payment used to live only in a console.error, so a failure left the
  // order sitting at pending_payment with no record that money had ever
  // moved -- and cancel_abandoned_orders, which decides on age alone,
  // cancelled it an hour later and orphaned the payment.
  //
  // Never throws. A bookkeeping problem must not become a 500, which
  // would make Paymob retry a payment we may have already processed.
  async function recordAttempt(
    outcome: 'declined' | 'processing_failed',
    errorMessage?: string,
  ) {
    try {
      const { error } = await supabase.from('paymob_payment_attempts').insert({
        merchant_order_id: merchantOrderId,
        order_id: orderId,
        paymob_transaction_id: parseInt(txId, 10) || null,
        amount_cents: amountCents,
        currency,
        outcome,
        error_message: errorMessage ?? null,
        // Keep reconciliation fields, not billing details or the full provider payload.
        payload: { id: txn.id, order_id: txn.order?.id, merchant_order_id: merchantOrderId,
          success: txn.success, amount_cents: amountCents, currency },
      });
      if (error) console.error('[PaymobWebhook] Could not record attempt:', error);
    } catch (e) {
      console.error('[PaymobWebhook] Could not record attempt:', e);
    }
  }

  // A decline is recorded rather than dropped. cancel_abandoned_orders
  // reads these rows to free the item in 15 minutes instead of the
  // blanket hour -- there is no resume-payment path in the UI, so a dead
  // order holding stock for an hour serves nobody.
  if (txn.success !== true || txn.error_occured !== false) {
    await recordAttempt('declined');
    return new Response('OK: recorded non-success event', { status: 200 });
  }

  try {
    // 1. Wallet Top-Up — merchant_order_id: topup_<uuid>
    if (merchantOrderId.startsWith('topup_')) {
      const { error } = await supabase.rpc('process_paymob_topup', {
        p_merchant_order_id: merchantOrderId,
        p_paymob_tx_id: parseInt(txId, 10),
        p_amount_cents: amountCents,
        p_currency: currency
      });
      if (error) throw error;
    }

    // 2. Boost Payment — no longer offered as a Paymob checkout option
    // (card-paid boosts had no activation path here; boosts are wallet-
    // balance-only now, via /api/boost -> purchase_boost). If an old
    // client somehow still sends one, log and acknowledge rather than
    // silently taking payment for nothing.
    else if (merchantOrderId.startsWith('boost_')) {
      throw new Error('Unsupported boost payment requires reconciliation');
    }

    // 3. Marketplace Order — merchant_order_id is the bare orders.id
    // (uuid). Order ids stopped being prefixed with "ord_" when checkout
    // moved to the server-side create_marketplace_order RPC; this
    // function previously still routed on that dead prefix, so every
    // card-paid marketplace order silently fell through unrouted and was
    // never marked paid. Route on UUID shape instead of a prefix so this
    // doesn't silently break again if the id format changes.
    else if (UUID_RE.test(merchantOrderId)) {
      const { error } = await supabase.rpc('process_paymob_order_payment', {
        p_merchant_order_id: merchantOrderId,
        p_paymob_tx_id: parseInt(txId, 10),
        p_amount_cents: amountCents,
        p_currency: currency
      });
      if (error) throw error;
    }

    else {
      throw new Error('Unrecognized payment reference');
    }
  } catch (err) {
    console.error('[PaymobWebhook] Processing error:', err);
    // Paymob says this one succeeded and our processing threw, so the
    // money is real and the order is still pending_payment. Recording it
    // is what stops cancel_abandoned_orders cancelling the order and
    // leaving the payment attached to nothing -- and it's the list of
    // what needs reconciling.
    await recordAttempt(
      'processing_failed',
      (err as any)?.message ? String((err as any).message) : String(err),
    );
    // Preserve failed-attempt reconciliation and allow delivery retries.
    return new Response('Payment processing temporarily unavailable', { status: 503 });
  }

  return new Response('OK', { status: 200 });
});
