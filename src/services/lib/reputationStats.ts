import { supabase } from './supabase';

/**
 * Public reputation stats -- "Replies in about 10 min", "3 people are
 * asking" -- backed by seller_reply_stats and product_ask_counts (public
 * aggregate RPCs, return counts/averages only, never room ids or message
 * content). These are approximations by nature (the design brief's own
 * phrasing is "about"), but every number they produce is real: a seller
 * with too little history gets no badge instead of an invented one.
 */

const MIN_REPLY_SAMPLE = 3;

/** Formats a reply-speed badge, or null when there isn't enough real
 *  history to say anything honest yet. */
export async function getSellerReplyBadge(sellerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('seller_reply_stats', { p_seller_id: sellerId });
  if (error || !data?.[0]) return null;
  const { sample_size, avg_reply_seconds } = data[0];
  if (sample_size < MIN_REPLY_SAMPLE || avg_reply_seconds == null) return null;
  return `Replies in about ${formatDuration(avg_reply_seconds)}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** Batch "N asking" counts for a page of listings -- one RPC call for a
 *  whole feed page rather than one per card. */
export async function getAskCounts(productIds: string[]): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};
  const { data, error } = await supabase.rpc('product_ask_counts', { p_product_ids: productIds });
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const row of data) out[row.product_id] = row.ask_count;
  return out;
}
