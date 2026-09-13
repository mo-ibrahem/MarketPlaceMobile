export type PaymobUrlOutcome = 'declined' | 'returned' | 'none';
const PAYMENT_HOSTS = new Set(['accept.paymob.com', 'egbay.shop', 'www.egbay.shop', 'egbay.market', 'www.egbay.market']);
const MERCHANT_HOSTS = new Set(['egbay.shop', 'www.egbay.shop', 'egbay.market', 'www.egbay.market']);
export function isTrustedPaymentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && !url.port && PAYMENT_HOSTS.has(url.hostname);
  } catch { return false; }
}
export function classifyPaymobUrl(rawUrl: string): PaymobUrlOutcome {
  try {
    const url = new URL(rawUrl);
    if (!isTrustedPaymentOrigin(url.origin)) return 'none';
    const value = (key: string) => url.searchParams.get(key)?.toLowerCase();
    if (value('success') === 'false' || value('error_occured') === 'true' ||
        value('is_voided') === 'true' || value('is_refunded') === 'true' ||
        value('txn_response_code') === 'declined') return 'declined';
    if (MERCHANT_HOSTS.has(url.hostname) || value('success') === 'true' ||
        value('txn_response_code') === 'approved') return 'returned';
  } catch { /* Invalid navigation cannot establish a payment outcome. */ }
  return 'none';
}
export function paymentBackendState(status: unknown, topUp: boolean): 'confirmed' | 'failed' | 'pending' {
  if (status === 'cancelled' || status === 'payment_failed' || status === 'failed') return 'failed';
  if (topUp) return status === 'paid' ? 'confirmed' : 'pending';
  // Unknown and future states must never imply secured funds.
  return ['escrow_secured', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'disputed'].includes(String(status))
    ? 'confirmed' : 'pending';
}
/** Serialize untrusted values safely inside inline HTML script elements. */
export function inlineScriptValue(value: string | number): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
