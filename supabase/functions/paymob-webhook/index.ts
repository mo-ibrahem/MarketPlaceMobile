// Supabase Edge Function: paymob-webhook
// Receives Paymob HMAC-signed payment callbacks and drives order/boost/wallet state transitions.
// Deploy: supabase functions deploy paymob-webhook
// Paymob Dashboard: Developer → Webhooks → set URL to your Edge Function URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HMAC_SECRET = Deno.env.get('PAYMOB_HMAC_SECRET')!;

// The 21 fields Paymob requires for HMAC-SHA512 verification, in exact alphabetical order.
// See: https://docs.paymob.com/docs/hmac-calculation
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

  const merchantOrderId: string = txn.order?.merchant_order_id || '';
  const amountEgp: number = (txn.amount_cents || 0) / 100;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Wallet Top-Up — merchant_order_id: topup_<userId>_<timestamp>
    if (merchantOrderId.startsWith('topup_')) {
      const userId = merchantOrderId.split('_')[1];

      const { data: wallet } = await supabase
        .from('user_wallets').select('id, available_balance')
        .eq('user_id', userId).maybeSingle();

      if (wallet) {
        const newBalance = Number(wallet.available_balance || 0) + amountEgp;
        await supabase.from('user_wallets')
          .update({ available_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('user_id', userId);

        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id, type: 'top_up', amount: amountEgp,
          fee_amount: 0, status: 'completed',
          description: `Wallet Deposit via Paymob (txn #${txn.id})`,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 2. Boost Payment — merchant_order_id: boost_<productId>_<tier>_<timestamp>
    else if (merchantOrderId.startsWith('boost_')) {
      const parts = merchantOrderId.split('_');
      const productId = parts[1];
      const tier = parts[2] || 'featured';
      const daysMap: Record<string, number> = { urgent: 3, featured: 7, turbo: 14 };
      const days = daysMap[tier] || 7;
      const promotedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('products').update({
        is_promoted: true, promotion_tier: tier,
        promoted_until: promotedUntil, updated_at: new Date().toISOString(),
      }).eq('id', productId);
    }

    // 3. Marketplace Order — merchant_order_id: ord_<timestamp>
    else if (merchantOrderId.startsWith('ord_')) {
      const { data: order } = await supabase.from('orders')
        .select('id, status, seller_id, amount')
        .eq('id', merchantOrderId).maybeSingle();

      if (!order || order.status !== 'pending_payment') {
        return new Response('OK: order not found or already processed', { status: 200 });
      }

      // Fetch seller tier for commission rate
      const { data: profile } = await supabase.from('user_profiles')
        .select('tier').eq('id', order.seller_id).maybeSingle();

      const tier = ((profile as any)?.tier as 1 | 2 | 3) || 1;
      const tierRates: Record<number, number> = { 1: 0.035, 2: 0.025, 3: 0.015 };
      const platformFeeRate = tierRates[tier] || 0.035;
      const paymobFee = Math.round((order.amount * 0.0275) + 3);
      const platformCommission = Math.round(order.amount * platformFeeRate);
      const totalDeductions = platformCommission + paymobFee;
      const netAmount = order.amount - totalDeductions;
      const isInstantClearance = tier === 3;

      // Transition order status
      await supabase.from('orders')
        .update({ status: 'escrow_secured', updated_at: new Date().toISOString() })
        .eq('id', merchantOrderId);

      // Credit seller wallet (service role bypasses RLS)
      const { data: sellerWallet } = await supabase.from('user_wallets')
        .select('id, pending_balance, available_balance')
        .eq('user_id', order.seller_id).maybeSingle();

      if (sellerWallet) {
        const updatePayload = isInstantClearance
          ? { available_balance: Number(sellerWallet.available_balance || 0) + netAmount }
          : { pending_balance: Number(sellerWallet.pending_balance || 0) + netAmount };

        await supabase.from('user_wallets')
          .update({ ...updatePayload, updated_at: new Date().toISOString() })
          .eq('user_id', order.seller_id);

        await supabase.from('wallet_transactions').insert({
          wallet_id: sellerWallet.id,
          order_id: merchantOrderId,
          type: isInstantClearance ? 'escrow_release' : 'escrow_hold',
          amount: netAmount,
          fee_amount: totalDeductions,
          status: 'completed',
          description: isInstantClearance
            ? `Instant Payout: Order #${merchantOrderId.slice(-6).toUpperCase()} (Pro Tier)`
            : `Escrow Hold: Order #${merchantOrderId.slice(-6).toUpperCase()} (${(platformFeeRate * 100).toFixed(1)}% + Paymob fees)`,
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[PaymobWebhook] Processing error:', err);
    // Return 200 so Paymob does not retry endlessly; investigate via Supabase logs
    return new Response('OK: internal error logged', { status: 200 });
  }

  return new Response('OK', { status: 200 });
});
