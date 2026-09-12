import { supabase } from './supabase';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  seller_id: string;
  product_id: string | null;
  rating: number;
  comment: string | null;
  seller_response: string | null;
  seller_responded_at: string | null;
  edited_at: string | null;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  product_title?: string;
}

export interface SellerRating {
  rating_avg: number | null;
  rating_count: number;
}

/**
 * Reviews carry only reviewer_id/product_id -- reviewer_id references
 * auth.users (not public_profiles, which is a view with no FK PostgREST can
 * embed against), so display names are fetched separately and merged
 * client-side. Same pattern web uses; do not try to `select('*, reviewer:...')`
 * here, PostgREST cannot resolve that relationship.
 */
async function hydrateReviews(reviews: Review[] | null): Promise<Review[]> {
  if (!reviews || reviews.length === 0) return [];

  const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id))];
  const productIds = [...new Set(reviews.map(r => r.product_id).filter(Boolean))] as string[];

  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', reviewerIds),
    productIds.length
      ? supabase.from('products').select('id, title').in('id', productIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return reviews.map(r => ({
    ...r,
    reviewer_name: (profiles as any[])?.find(p => p.id === r.reviewer_id)?.full_name,
    reviewer_avatar: (profiles as any[])?.find(p => p.id === r.reviewer_id)?.avatar_url,
    product_title: (products as any[])?.find(p => p.id === r.product_id)?.title,
  }));
}

/** Everything a seller has ever been reviewed for. */
export async function getSellerReviews(sellerId: string, limit = 50): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrateReviews(data as any);
}

/**
 * Reviews left on one specific listing.
 *
 * Distinct from getSellerReviews: someone deciding on this item wants to know
 * what previous buyers of *this* item said. A listing with stock above 1 can be
 * bought repeatedly, so this legitimately returns several.
 */
export async function getProductReviews(productId: string, limit = 20): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrateReviews(data as any);
}

/**
 * The seller's aggregate, maintained by a trigger on `reviews`.
 *
 * Read rather than computed: averaging whatever page of reviews the client
 * happens to have fetched would show a different number per screen.
 */
export async function getSellerRating(sellerId: string): Promise<SellerRating> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('rating_avg, rating_count')
    .eq('id', sellerId)
    .maybeSingle();
  if (error || !data) return { rating_avg: null, rating_count: 0 };
  return {
    rating_avg: (data as any).rating_avg == null ? null : Number((data as any).rating_avg),
    rating_count: Number((data as any).rating_count) || 0,
  };
}

/** Ratings for many sellers at once, for list screens. */
export async function getSellerRatings(sellerIds: string[]): Promise<Record<string, SellerRating>> {
  const ids = [...new Set(sellerIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, rating_avg, rating_count')
    .in('id', ids);
  if (error || !data) return {};
  const out: Record<string, SellerRating> = {};
  for (const row of data as any[]) {
    out[row.id] = {
      rating_avg: row.rating_avg == null ? null : Number(row.rating_avg),
      rating_count: Number(row.rating_count) || 0,
    };
  }
  return out;
}

/** Whether the current user has already reviewed this order, and what they said. */
export async function getMyReviewForOrder(orderId: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

/**
 * Who may review is enforced server-side inside submit_review: the buyer of
 * that order only, status must be `completed`, one review per order, within 90
 * days of orders.updated_at, rating 1-5, comment <= 1000 chars.
 * `canReviewOrder` mirrors those rules so the UI never offers an action the
 * server will reject -- it is a display guard, not the check.
 */
export const REVIEW_WINDOW_DAYS = 90;
export const REVIEW_COMMENT_MAX = 1000;

export function canReviewOrder(
  order: { status: string; buyer_id: string; updated_at?: string | null },
  userId: string | undefined,
  existingReview: Review | null,
): { allowed: boolean; reason?: string } {
  if (!userId || order.buyer_id !== userId) return { allowed: false, reason: 'not_buyer' };
  if (order.status !== 'completed') return { allowed: false, reason: 'not_completed' };
  if (existingReview) return { allowed: false, reason: 'already_reviewed' };

  // submit_review measures the window against orders.updated_at, so this does
  // too -- keying off created_at here would offer the form on orders the
  // server would then reject.
  if (order.updated_at) {
    const days = (Date.now() - new Date(order.updated_at).getTime()) / 86400000;
    if (days > REVIEW_WINDOW_DAYS) return { allowed: false, reason: 'window_closed' };
  }
  return { allowed: true };
}

export async function submitReview(orderId: string, rating: number, comment: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_order_id: orderId,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw error;
  return data as string;
}

export async function editReview(reviewId: string, rating: number, comment: string): Promise<void> {
  const { error } = await supabase.rpc('edit_review', {
    p_review_id: reviewId,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw error;
}

export async function respondToReview(reviewId: string, response: string): Promise<void> {
  const { error } = await supabase.rpc('respond_to_review', {
    p_review_id: reviewId,
    p_response: response,
  });
  if (error) throw error;
}
