import { supabase } from './supabase';
import { API_BASE } from './apiBase';

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
    // Payout requests are reviewed manually regardless of tier -- see
    // requestPayout below. This used to say "Instant", which nothing in
    // this system does; request_wallet_payout only ever files a pending
    // request.
    payoutSpeed: 'Manual review (InstaPay & Mobile Wallets)',
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
    payoutSpeed: 'Manual review (bank settlement)',
  },
};

/**
 * Fetch or initialize a user's wallet
 */
export async function getUserWallet(userId: string): Promise<UserWallet> {
  // Every user gets a wallet at signup (EgbayWeb 20260903120000), so a
  // missing row is an error, not something to paper over with an in-memory
  // zero-balance object that the screen would then present as real.
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Wallet not found for this account');
  return data as unknown as UserWallet;
}

/**
 * Get the Seller's Trust Tier (Tier 1 Casual, Tier 2 Verified, Tier 3 Pro)
 */
export async function getSellerTier(userId: string): Promise<SellerTierConfig> {
  try {
    // public_profiles, not user_profiles: the latter's only SELECT policy is
    // `auth.uid() = id` for authenticated alone, so reading it returns nothing
    // for anyone else's seller -- and nothing at all when signed out.
    const { data, error } = await supabase
      .from('public_profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle();

    if (data && !error && data.tier) {
      const t = (data.tier as 1 | 2 | 3) || 1;
      return SELLER_TIERS[t] || SELLER_TIERS[1];
    }
  } catch (err) {
    console.warn('[WalletService] getSellerTier read failed, assuming Tier 1:', err);
  }

  // Fall back to Tier 1, never Tier 2. Defaulting to "Verified Trader" on a
  // failed read showed every unverified seller as verified and quoted them the
  // lower commission rate. Tier 1 is the safe assumption: unverified until the
  // profile actually says otherwise.
  return SELLER_TIERS[1];
}

export class SellerVerificationUnavailable extends Error {
  constructor() {
    super('Seller verification is not available in the app yet.');
    this.name = 'SellerVerificationUnavailable';
  }
}

/**
 * Seller tier is NOT something the client may grant itself.
 *
 * This previously wrote `tier` and `is_verified_seller: true` straight into
 * user_profiles from the device, after nothing more than a 14-digit length
 * check on a National ID that was never sent anywhere or verified. Because the
 * table's UPDATE policy is a bare `auth.uid() = id` with no column restriction,
 * any signed-in user could hand themselves the "Verified" badge buyers rely on
 * and a lower commission rate. It then swallowed the error and reported success
 * regardless, so the UI said "Verification Approved!" either way.
 *
 * Web does this properly: ID photos go to a private storage bucket and a
 * `pending` row is filed in seller_verification_requests for human review (see
 * EgbayWeb app/seller-verification/page.tsx). Mobile has no upload flow yet, so
 * until it does this refuses rather than pretending -- and never claims a tier
 * the backend has not granted.
 */
export async function upgradeSellerTier(_userId: string, _targetTier: 1 | 2 | 3): Promise<SellerTierConfig> {
  throw new SellerVerificationUnavailable();
}

/**
 * Hold funds in Escrow for a seller with Tier-specific commission rates
 */
/**
 * Fetch all wallet transactions for a user
 */
export async function getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  // RLS scopes this to the caller; an empty wallet is an empty list. The old
  // fallback showed a demo "Payment released: Apple AirPods Pro 2, EGP 2,450"
  // to anyone with no history -- a transaction that never happened.
  const wallet = await getUserWallet(userId);
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as unknown as WalletTransaction[]) ?? []);
}

/**
 * Fetch user's registered payout methods (InstaPay, Vodafone Cash, Bank)
 */
export async function getPayoutMethods(userId: string): Promise<PayoutMethod[]> {
  const { data, error } = await supabase
    .from('payout_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });
  if (error) throw error;
  return ((data as unknown as PayoutMethod[]) ?? []);
}

/**
 * Add a new payout method
 */
export async function addPayoutMethod(
  userId: string,
  methodData: Omit<PayoutMethod, 'id' | 'created_at'>
): Promise<PayoutMethod> {
  const { data, error } = await supabase
    .from('payout_methods')
    .insert({ ...methodData, user_id: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PayoutMethod;
}

/**
 * Request a withdrawal/payout to InstaPay or Vodafone Cash.
 *
 * This *requests* a payout -- it is not instant and nothing here moves money.
 * The backend debits the available balance and files a `pending` payout request
 * for review; no code in this system fulfils one yet.
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

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}/api/wallet/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session && { 'Authorization': `Bearer ${session.access_token}` })
    },
    body: JSON.stringify({
      action: 'request_payout',
      amount,
      payoutMethodId: payoutMethod.id,
      payoutMethodIdentifier: payoutMethod.account_identifier
    })
  });

  // A failure here must surface as a failure. This previously returned
  // "Successfully transferred..." without ever reading the response, and fell
  // back on a network error to fabricating a *completed* payout transaction in
  // memory -- telling the user their money had been sent when nothing had
  // happened at all.
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('Could not reach the payout service. Your balance has not been changed.');
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Payout request failed. Your balance has not been changed.');
  }

  // request_wallet_payout only inserts a payout_requests row with status
  // 'pending' and a pending wallet_transactions row -- it debits the available
  // balance but transfers nothing. Nothing in this system fulfils a payout yet,
  // so this reports a request received, never a completed transfer.
  return {
    success: true,
    message: `Your request to withdraw EGP ${amount.toLocaleString()} to ${payoutMethod.account_identifier} is being reviewed.`,
    transactionId: data?.payoutRequestId || data?.txId,
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

  // The backend runs checkout_with_wallet(p_user_id, p_order_id) and is the
  // only thing that moves the balance. A failed call is a failed deduction --
  // this used to swallow the error and report the purchase as applied.
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}/api/wallet/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session && { 'Authorization': `Bearer ${session.access_token}` })
    },
    body: JSON.stringify({ action: 'deduct_spendable', amount, orderId, itemTitle })
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('Could not reach the wallet service. Your balance has not been changed.');
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Wallet payment failed. Your balance has not been changed.');
  }

  const remaining = Number(data.remainingBalance ?? available - amount);
  return {
    success: true,
    message: `Applied EGP ${amount.toLocaleString()} from Wallet`,
    remainingBalance: remaining,
  };
}

