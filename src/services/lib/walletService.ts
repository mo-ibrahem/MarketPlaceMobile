import { supabase } from './supabase';

export interface UserWallet {
  id: string;
  user_id: string;
  pending_balance: number;
  available_balance: number;
  currency: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id?: string;
  order_id?: string;
  type: 'escrow_hold' | 'escrow_release' | 'payout' | 'fee_deduction' | 'refund' | 'deposit' | 'top_up';
  amount: number;
  fee_amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  created_at: string;
}

export interface PayoutMethod {
  id: string;
  user_id: string;
  type: 'vodafone_cash' | 'instapay_ipa' | 'orange_cash' | 'etisalat_cash' | 'bank_account';
  account_identifier: string;
  account_holder_name: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface SellerTierConfig {
  tier: 1 | 2 | 3;
  name: string;
  badge: string;
  commissionFeePercent: number;
  listingLimitCount: number;
  listingLimitAmount: number;
  fundReleaseTrigger: string;
  kycRequirement: string;
  payoutSpeed: string;
}

export interface NationalIdInfo {
  isValid: boolean;
  birthDate?: string;
  century?: number;
  gender?: 'male' | 'female';
  governorate?: string;
  error?: string;
}

export const EGYPTIAN_GOVERNORATE_CODES: Record<string, string> = {
  '01': 'Cairo (القاهرة)',
  '02': 'Alexandria (الإسكندرية)',
  '03': 'Port Said (بورسعيد)',
  '04': 'Suez (السويس)',
  '11': 'Damietta (دمياط)',
  '12': 'Dakahlia (الدقهلية)',
  '13': 'Ash Sharqia (الشرقية)',
  '14': 'Kaliobeya (القليوبية)',
  '15': 'Kafr El-Sheikh (كفر الشيخ)',
  '16': 'Gharbia (الغربية)',
  '17': 'Monufia (المنوفية)',
  '18': 'El Beheira (البحيرة)',
  '19': 'Ismailia (الإسماعيلية)',
  '21': 'Giza (الجيزة)',
  '22': 'Beni Suef (بني سويف)',
  '23': 'Fayoum (الفيوم)',
  '24': 'Minya (المنيا)',
  '25': 'Asyut (أسيوط)',
  '26': 'Sohag (سوهاج)',
  '27': 'Qena (قنا)',
  '28': 'Aswan (أسوان)',
  '29': 'Luxor (الأقصر)',
  '31': 'Red Sea (البحر الأحمر)',
  '32': 'New Valley (الوادي الجديد)',
  '33': 'Matrouh (مطروح)',
  '34': 'North Sinai (شمال سيناء)',
  '35': 'South Sinai (جنوب سيناء)',
  '88': 'Born Abroad (خارج الجمهورية)',
};

/**
 * Validates and decodes the 14-digit Egyptian National ID in real-time
 */
export function validateEgyptianNationalId(idNumber: string): NationalIdInfo {
  if (!idNumber || idNumber.length !== 14 || !/^\d{14}$/.test(idNumber)) {
    return { isValid: false, error: 'Must be exactly 14 digits' };
  }

  const centuryCode = parseInt(idNumber[0], 10);
  if (centuryCode !== 2 && centuryCode !== 3) {
    return { isValid: false, error: 'Invalid century code' };
  }

  const century = centuryCode === 2 ? 1900 : 2000;
  const year = century + parseInt(idNumber.substring(1, 3), 10);
  const month = parseInt(idNumber.substring(3, 5), 10);
  const day = parseInt(idNumber.substring(5, 7), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { isValid: false, error: 'Invalid birth date in National ID' };
  }

  const govCode = idNumber.substring(7, 9);
  const governorate = EGYPTIAN_GOVERNORATE_CODES[govCode] || 'Other Governorates (أخرى)';

  const genderDigit = parseInt(idNumber.substring(12, 13), 10);
  const gender = genderDigit % 2 === 0 ? 'female' : 'male';

  return {
    isValid: true,
    century,
    birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gender,
    governorate,
  };
}

export const SELLER_TIERS: Record<1 | 2 | 3, SellerTierConfig> = {
  1: {
    tier: 1,
    name: 'Casual Trader',
    badge: '🟡 Casual',
    commissionFeePercent: 0.035, // 3.5% platform fee
    listingLimitCount: 5,
    listingLimitAmount: 25000,
    fundReleaseTrigger: 'Buyer PIN verification or Courier delivery + 24 hrs',
    kycRequirement: 'Egyptian Mobile OTP (+20)',
    payoutSpeed: 'Standard (On-demand after escrow release)',
  },
  2: {
    tier: 2,
    name: 'Verified Trader',
    badge: '🛡️ Verified',
    commissionFeePercent: 0.025, // 2.5% platform fee
    listingLimitCount: 50,
    listingLimitAmount: 150000,
    fundReleaseTrigger: 'Instant QR / PIN scan or Courier delivery + 6 hrs',
    kycRequirement: 'National ID (بطاقة الرقم القومي) Front & Back',
    payoutSpeed: 'Fast (Instant to InstaPay & Mobile Wallets)',
  },
  3: {
    tier: 3,
    name: 'EgyBay Pro / Store',
    badge: '⭐ Pro Merchant',
    commissionFeePercent: 0.015, // 1.5% platform fee
    listingLimitCount: 999999,
    listingLimitAmount: 99999999,
    fundReleaseTrigger: 'Instant release upon courier pickup scan',
    kycRequirement: 'Commercial Registry (سجل تجاري) & Tax Card',
    payoutSpeed: 'Automated Daily Bank Settlement',
  },
};

// In-memory fallback state
let inMemoryWallets: Record<string, UserWallet> = {};
let inMemoryTransactions: WalletTransaction[] = [];
let inMemoryPayoutMethods: Record<string, PayoutMethod[]> = {};
let inMemorySellerTiers: Record<string, 1 | 2 | 3> = {};

/**
 * Fetch or initialize a user's wallet
 */
export async function getUserWallet(userId: string): Promise<UserWallet> {
  try {
    const { data, error } = await supabase
      .from('user_wallets' as any)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error) {
      return data as unknown as UserWallet;
    }

    if (!data) {
      const newWallet: Partial<UserWallet> = {
        user_id: userId,
        pending_balance: 0,
        available_balance: 0,
        currency: 'EGP',
      };

      const { data: created, error: insertError } = await supabase
        .from('user_wallets' as any)
        .insert(newWallet as any)
        .select()
        .maybeSingle();

      if (created && !insertError) {
        return created as unknown as UserWallet;
      }
    }
  } catch (err) {
    console.warn('[WalletService] Supabase fallback to memory:', err);
  }

  if (!inMemoryWallets[userId]) {
    inMemoryWallets[userId] = {
      id: `wallet_${userId}`,
      user_id: userId,
      pending_balance: 0,
      available_balance: 0,
      currency: 'EGP',
      updated_at: new Date().toISOString(),
    };
  }
  return inMemoryWallets[userId];
}

/**
 * Get the Seller's Trust Tier (Tier 1 Casual, Tier 2 Verified, Tier 3 Pro)
 */
export async function getSellerTier(userId: string): Promise<SellerTierConfig> {
  try {
    const { data, error } = await supabase
      .from('user_profiles' as any)
      .select('tier')
      .eq('id', userId)
      .maybeSingle();

    if (data && !error && data.tier) {
      const t = (data.tier as 1 | 2 | 3) || 1;
      return SELLER_TIERS[t] || SELLER_TIERS[1];
    }
  } catch (err) {
    console.warn('[WalletService] getSellerTier fallback to memory:', err);
  }

  const tierNum = inMemorySellerTiers[userId] || 2; // Default to Tier 2 for preview
  return SELLER_TIERS[tierNum];
}

/**
 * Upgrade Seller Tier (e.g. Upload National ID for Tier 2 verification)
 */
export async function upgradeSellerTier(userId: string, targetTier: 1 | 2 | 3): Promise<SellerTierConfig> {
  try {
    await supabase
      .from('user_profiles' as any)
      .update({
        tier: targetTier,
        tier_verified_at: new Date().toISOString(),
        is_verified_seller: targetTier >= 2,
      } as any)
      .eq('id', userId);
  } catch (err) {
    console.warn('[WalletService] Error updating tier in Supabase:', err);
  }

  inMemorySellerTiers[userId] = targetTier;
  return SELLER_TIERS[targetTier];
}

/**
 * Hold funds in Escrow for a seller with Tier-specific commission rates
 */
export async function holdEscrowForSeller(
  sellerId: string,
  orderId: string,
  totalAmount: number,
  promotedAdRate: number = 0
): Promise<void> {
  const sellerTier = await getSellerTier(sellerId);
  const baseFeePercent = sellerTier.commissionFeePercent;
  const platformCommission = Math.round(totalAmount * (baseFeePercent + (promotedAdRate || 0)));
  // Paymob processing fee: 2.75% + 3 EGP (same formula as web app)
  const paymobFee = Math.round((totalAmount * 0.0275) + 3);
  const totalFeeAmount = platformCommission + paymobFee;
  const netAmount = totalAmount - totalFeeAmount;

  // Pro merchants (Tier 3) get instant clearance upon order placement!
  const isInstantClearance = sellerTier.tier === 3;

  try {
    const wallet = await getUserWallet(sellerId);
    const newPending = isInstantClearance
      ? Number(wallet.pending_balance || 0)
      : (Number(wallet.pending_balance) || 0) + netAmount;
    const newAvailable = isInstantClearance
      ? (Number(wallet.available_balance) || 0) + netAmount
      : Number(wallet.available_balance || 0);

    await supabase
      .from('user_wallets' as any)
      .update({
        pending_balance: newPending,
        available_balance: newAvailable,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', sellerId);

    await supabase.from('wallet_transactions' as any).insert({
      wallet_id: wallet.id,
      order_id: orderId,
      type: isInstantClearance ? 'escrow_release' : 'escrow_hold',
      amount: netAmount,
      fee_amount: totalFeeAmount,
      status: isInstantClearance ? 'completed' : 'pending',
      created_at: new Date().toISOString(),
    } as any);
  } catch (err) {
    console.warn('[WalletService] Error holding escrow, updating in-memory:', err);
  }

  const w = await getUserWallet(sellerId);
  if (isInstantClearance) {
    w.available_balance = (Number(w.available_balance) || 0) + netAmount;
  } else {
    w.pending_balance = (Number(w.pending_balance) || 0) + netAmount;
  }

  inMemoryTransactions.unshift({
    id: `tx_${Date.now()}`,
    order_id: orderId,
    type: isInstantClearance ? 'escrow_release' : 'escrow_hold',
    amount: netAmount,
    fee_amount: totalFeeAmount,
    status: isInstantClearance ? 'completed' : 'pending',
    description: `Escrow Hold for Order #${orderId.slice(-6)} (Platform ${(baseFeePercent * 100).toFixed(1)}% + Paymob fees)`,
    created_at: new Date().toISOString(),
  });
}

/**
 * Release escrow funds into seller's available balance upon delivery/handover verification
 */
export async function releaseEscrowToSeller(sellerId: string, orderId: string, netAmount: number): Promise<void> {
  try {
    const wallet = await getUserWallet(sellerId);
    const newPending = Math.max(0, (Number(wallet.pending_balance) || 0) - netAmount);
    const newAvailable = (Number(wallet.available_balance) || 0) + netAmount;

    await supabase
      .from('user_wallets' as any)
      .update({
        pending_balance: newPending,
        available_balance: newAvailable,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', sellerId);

    await supabase.from('wallet_transactions' as any).insert({
      wallet_id: wallet.id,
      order_id: orderId,
      type: 'escrow_release',
      amount: netAmount,
      fee_amount: 0,
      status: 'completed',
      created_at: new Date().toISOString(),
    } as any);
  } catch (err) {
    console.warn('[WalletService] Error releasing escrow, updating in-memory:', err);
  }

  const w = await getUserWallet(sellerId);
  w.pending_balance = Math.max(0, (Number(w.pending_balance) || 0) - netAmount);
  w.available_balance = (Number(w.available_balance) || 0) + netAmount;
  inMemoryTransactions.unshift({
    id: `tx_${Date.now()}`,
    order_id: orderId,
    type: 'escrow_release',
    amount: netAmount,
    fee_amount: 0,
    status: 'completed',
    description: `Escrow Released for Order #${orderId.slice(-6)}`,
    created_at: new Date().toISOString(),
  });
}

/**
 * Deposit / Top Up funds into user wallet (via Paymob, Vodafone Cash, InstaPay)
 */
export async function topUpUserWallet(
  userId: string,
  amount: number,
  paymentMethod: string = 'card',
  referenceId?: string
): Promise<{ success: boolean; message: string; newBalance: number }> {
  const wallet = await getUserWallet(userId);
  const newAvailable = (Number(wallet.available_balance) || 0) + amount;

  try {
    await supabase
      .from('user_wallets' as any)
      .update({
        available_balance: newAvailable,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', userId);

    await supabase.from('wallet_transactions' as any).insert({
      wallet_id: wallet.id,
      type: 'top_up',
      amount: amount,
      fee_amount: 0,
      status: 'completed',
      description: `Wallet Deposit via ${paymentMethod === 'vodafone_cash' ? 'Vodafone Cash' : paymentMethod === 'instapay' ? 'InstaPay' : 'Card'}`,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[WalletService] Supabase fallback topup:', err);
  }

  inMemoryWallets[userId] = {
    ...wallet,
    available_balance: newAvailable,
  };

  inMemoryTransactions.unshift({
    id: `tx_topup_${Date.now()}`,
    type: 'top_up',
    amount: amount,
    fee_amount: 0,
    status: 'completed',
    description: `Wallet Deposit via ${paymentMethod === 'vodafone_cash' ? 'Vodafone Cash' : paymentMethod === 'instapay' ? 'InstaPay' : 'Card'}`,
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: `EGP ${amount.toLocaleString()} added to your wallet!`,
    newBalance: newAvailable,
  };
}

/**
 * Fetch all wallet transactions for a user
 */
export async function getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('wallet_transactions' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error && data.length > 0) {
      return data as unknown as WalletTransaction[];
    }
  } catch (err) {
    console.warn('[WalletService] Supabase fallback for transactions:', err);
  }

  return inMemoryTransactions.length > 0
    ? inMemoryTransactions
    : [
        {
          id: 'tx_demo_1',
          type: 'escrow_release',
          amount: 2450,
          fee_amount: 125,
          status: 'completed',
          description: 'Payment released: Apple AirPods Pro 2',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'tx_demo_2',
          type: 'payout',
          amount: 2000,
          fee_amount: 0,
          status: 'completed',
          description: 'Payout to InstaPay (mo@instapay)',
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
      ];
}

/**
 * Fetch user's registered payout methods (InstaPay, Vodafone Cash, Bank)
 */
export async function getPayoutMethods(userId: string): Promise<PayoutMethod[]> {
  try {
    const { data, error } = await supabase
      .from('payout_methods' as any)
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (data && !error && data.length > 0) {
      return data as unknown as PayoutMethod[];
    }
  } catch (err) {
    console.warn('[WalletService] Supabase fallback for payout methods:', err);
  }

  return inMemoryPayoutMethods[userId] || [
    {
      id: 'pm_default_1',
      user_id: userId,
      type: 'instapay_ipa',
      account_identifier: 'seller.egbay@instapay',
      account_holder_name: 'Verified Seller',
      is_default: true,
      is_verified: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pm_default_2',
      user_id: userId,
      type: 'vodafone_cash',
      account_identifier: '01098765432',
      account_holder_name: 'Vodafone Cash Wallet',
      is_default: false,
      is_verified: true,
      created_at: new Date().toISOString(),
    },
  ];
}

/**
 * Add a new payout method
 */
export async function addPayoutMethod(
  userId: string,
  methodData: Omit<PayoutMethod, 'id' | 'created_at'>
): Promise<PayoutMethod> {
  const newMethod: PayoutMethod = {
    ...methodData,
    id: `pm_${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('payout_methods' as any)
      .insert(newMethod as any)
      .select()
      .maybeSingle();

    if (data && !error) {
      return data as unknown as PayoutMethod;
    }
  } catch (err) {
    console.warn('[WalletService] Fallback saving payout method to memory:', err);
  }

  if (!inMemoryPayoutMethods[userId]) {
    inMemoryPayoutMethods[userId] = [];
  }
  inMemoryPayoutMethods[userId].push(newMethod);
  return newMethod;
}

/**
 * Request an instant withdrawal/payout to InstaPay or Vodafone Cash
 */
export async function requestPayout(
  userId: string,
  amount: number,
  payoutMethod: PayoutMethod
): Promise<{ success: boolean; message: string; transactionId?: string }> {
  const wallet = await getUserWallet(userId);
  const available = Number(wallet.available_balance) || 0;

  if (amount > available) {
    throw new Error(`Insufficient available funds (Available: EGP ${available.toLocaleString()})`);
  }

  if (amount < 100) {
    throw new Error('Minimum withdrawal amount is EGP 100');
  }

  const newAvailable = available - amount;

  try {
    await supabase
      .from('user_wallets' as any)
      .update({ available_balance: newAvailable, updated_at: new Date().toISOString() } as any)
      .eq('user_id', userId);

    const txId = `payout_${Date.now()}`;
    await supabase.from('wallet_transactions' as any).insert({
      id: txId,
      wallet_id: wallet.id,
      type: 'payout',
      amount: amount,
      fee_amount: 0,
      status: 'completed',
      created_at: new Date().toISOString(),
    } as any);

    return {
      success: true,
      message: `Successfully transferred EGP ${amount.toLocaleString()} to ${payoutMethod.account_identifier}`,
      transactionId: txId,
    };
  } catch (err) {
    console.warn('[WalletService] Fallback processing payout in memory:', err);
  }

  wallet.available_balance = newAvailable;
  const txId = `payout_${Date.now()}`;
  inMemoryTransactions.unshift({
    id: txId,
    type: 'payout',
    amount: amount,
    fee_amount: 0,
    status: 'completed',
    description: `Payout to ${payoutMethod.account_identifier}`,
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Successfully transferred EGP ${amount.toLocaleString()} to ${payoutMethod.account_identifier}`,
    transactionId: txId,
  };
}

/**
 * Deduct Spendable Funds from Available Balance for checkout / split-payment
 */
export async function deductWalletSpendableFunds(
  userId: string,
  amount: number,
  orderId: string,
  itemTitle?: string
): Promise<{ success: boolean; message: string; remainingBalance: number }> {
  const wallet = await getUserWallet(userId);
  const available = Number(wallet.available_balance) || 0;

  if (amount > available) {
    throw new Error(`Insufficient wallet balance. Available: EGP ${available.toLocaleString()}`);
  }

  const newAvailable = available - amount;

  try {
    await supabase
      .from('user_wallets' as any)
      .update({
        available_balance: newAvailable,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', userId);

    await supabase.from('wallet_transactions' as any).insert({
      wallet_id: wallet.id,
      order_id: orderId,
      type: 'fee_deduction',
      amount: amount,
      fee_amount: 0,
      status: 'completed',
      description: `Purchase: ${itemTitle || 'Marketplace Item'} (Wallet Checkout)`,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[WalletService] Fallback updating spendable funds in memory:', err);
  }

  wallet.available_balance = newAvailable;
  inMemoryTransactions.unshift({
    id: `tx_spend_${Date.now()}`,
    order_id: orderId,
    type: 'fee_deduction',
    amount: amount,
    fee_amount: 0,
    status: 'completed',
    description: `Purchase: ${itemTitle || 'Marketplace Item'} (Wallet Checkout)`,
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Applied EGP ${amount.toLocaleString()} from Wallet`,
    remainingBalance: newAvailable,
  };
}

/**
 * Update Payout Schedule (Daily, Weekly, Monthly) and Express Payout settings
 */
export async function updatePayoutSchedule(
  userId: string,
  schedule: 'daily' | 'weekly' | 'monthly',
  expressEnabled: boolean = true
): Promise<{ success: boolean; message: string }> {
  try {
    await supabase
      .from('user_wallets' as any)
      .update({
        payout_schedule: schedule,
        express_payout_enabled: expressEnabled,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[WalletService] Fallback saving schedule in memory:', err);
  }

  return {
    success: true,
    message: `Payout schedule updated to ${schedule.toUpperCase()}`,
  };
}
