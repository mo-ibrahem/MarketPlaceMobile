import { supabase } from './supabase';
import { getUserWallet, type UserWallet } from './walletService';

export interface BoostPackage {
  id: 'urgent' | 'featured' | 'turbo';
  title: string;
  badgeText: string;
  badgeEmoji: string;
  priceEGP: number;
  durationDays: number;
  multiplierText: string;
  description: string;
  perks: string[];
  gradient: [string, string];
}

export const BOOST_PACKAGES: Record<'urgent' | 'featured' | 'turbo', BoostPackage> = {
  urgent: {
    id: 'urgent',
    title: 'Urgent Sale (بيع عاجل)',
    badgeText: '🔥 URGENT DEAL',
    badgeEmoji: '🔥',
    priceEGP: 15,
    durationDays: 3,
    multiplierText: '2x More Views',
    description: 'Highlights your listing with an amber urgent badge for quick buyer response.',
    perks: ['🔥 Eye-catching Urgent Sale badge', '⚡ Placed above standard items', '⏳ Active for 3 days'],
    gradient: ['#F59E0B', '#D97706'],
  },
  featured: {
    id: 'featured',
    title: 'Featured Spotlight (إعلان مميز)',
    badgeText: '⚡ FEATURED SPOTLIGHT',
    badgeEmoji: '⚡',
    priceEGP: 35,
    durationDays: 7,
    multiplierText: '5x More Views',
    description: 'Pins your listing to top search spots & home screen featured rails for a full week.',
    perks: [
      '⚡ Gold glowing border & verified badge',
      '🥇 Pinned to top of category search',
      '🏠 Featured on Home screen carousel',
      '📅 Active for 7 full days',
    ],
    gradient: ['#2563EB', '#1D4ED8'],
  },
  turbo: {
    id: 'turbo',
    title: 'Turbo 10x Max (ترويج شامل)',
    badgeText: '👑 TURBO 10X BOOST',
    badgeEmoji: '👑',
    priceEGP: 75,
    durationDays: 14,
    multiplierText: '10x Max Exposure',
    description: 'Maximum marketplace power — top hero placements, 14 days duration & instant buyer alerts.',
    perks: [
      '👑 Crown VIP placement on Home & Search',
      '🚀 Top banner placement across all categories',
      '🔔 Notification ping to wishlist & search watchers',
      '📅 Active for 14 days',
    ],
    gradient: ['#7C3AED', '#4C1D95'],
  },
};

// In-memory fallback
let inMemoryPromotions: Record<string, { tier: string; until: string }> = {};

/**
 * Apply a boost package to a product
 */
export async function boostProduct(
  productId: string,
  userId: string,
  packageId: 'urgent' | 'featured' | 'turbo',
  paymentSource: 'wallet_balance' | 'paymob'
): Promise<{ success: boolean; message: string; promotedUntil: string }> {
  const pkg = BOOST_PACKAGES[packageId];
  if (!pkg) throw new Error('Invalid boost package selected');

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + pkg.durationDays);
  const promotedUntil = expiryDate.toISOString();

  // 1. If paying with wallet balance, verify & deduct
  if (paymentSource === 'wallet_balance') {
    const wallet = await getUserWallet(userId);
    const available = Number(wallet.available_balance) || 0;
    if (available < pkg.priceEGP) {
      throw new Error(`Insufficient wallet balance (Available: EGP ${available.toLocaleString()}, Needed: EGP ${pkg.priceEGP})`);
    }

    const newAvailable = available - pkg.priceEGP;
    try {
      await supabase
        .from('user_wallets' as any)
        .update({ available_balance: newAvailable, updated_at: new Date().toISOString() } as any)
        .eq('user_id', userId);

      await supabase.from('wallet_transactions' as any).insert({
        wallet_id: wallet.id,
        type: 'fee_deduction',
        amount: pkg.priceEGP,
        fee_amount: 0,
        status: 'completed',
        description: `Boost: ${pkg.title} (${pkg.durationDays} Days)`,
        created_at: new Date().toISOString(),
      } as any);
    } catch (err) {
      console.warn('[BoostService] Wallet deduction error, fallback to memory:', err);
    }

    wallet.available_balance = newAvailable;
  }

  // 2. Update product row on Supabase
  try {
    const { error } = await supabase
      .from('products')
      .update({
        is_promoted: true,
        promotion_tier: packageId,
        promoted_until: promotedUntil,
      } as any)
      .eq('id', productId);

    if (error) {
      console.warn('[BoostService] Error updating product promotion on Supabase:', error);
    }
  } catch (err) {
    console.warn('[BoostService] Fallback to in-memory promotion:', err);
  }

  inMemoryPromotions[productId] = { tier: packageId, until: promotedUntil };

  return {
    success: true,
    message: `Your product is now boosted with ${pkg.title}! It will enjoy ${pkg.multiplierText} for ${pkg.durationDays} days.`,
    promotedUntil,
  };
}

/**
 * Check if a product has an active boost
 */
export function getProductBoostInfo(product: any): { isPromoted: boolean; pkg?: BoostPackage; expiresAt?: string } {
  const until = product?.promoted_until || inMemoryPromotions[product?.id]?.until;
  const tier = (product?.promotion_tier || inMemoryPromotions[product?.id]?.tier) as 'urgent' | 'featured' | 'turbo';

  if (until && new Date(until) > new Date() && tier && BOOST_PACKAGES[tier]) {
    return {
      isPromoted: true,
      pkg: BOOST_PACKAGES[tier],
      expiresAt: until,
    };
  }

  return { isPromoted: false };
}
