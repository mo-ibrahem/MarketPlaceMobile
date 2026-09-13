import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Building,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  UserCheck,
  Wallet,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import {
  getPayoutMethods,
  getSellerTier,
  getUserWallet,
  getWalletTransactions,
  requestPayout,
  upgradeSellerTier,
  SELLER_TIERS,
  type PayoutMethod,
  type SellerTierConfig,
  type UserWallet,
  type WalletTransaction,
} from '../src/services/lib/walletService';
import { DIGITAL_PURCHASES_ENABLED, PAYMENTS_ENABLED } from '../src/services/lib/platformCommerce';
import { API_BASE } from '../src/services/lib/apiBase';
import NotAvailableYet from '../src/components/NotAvailableYet';
import { supabase } from '../src/services/lib/supabase';
export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [sellerTier, setSellerTier] = useState<SellerTierConfig>(SELLER_TIERS[2]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Top Up Modal state
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);

  // Withdrawal Modal state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // KYC Upgrade Modal state
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [nationalIdNum, setNationalIdNum] = useState('');
  const [upgradingTier, setUpgradingTier] = useState(false);

  // eBay Transaction Category Filter
  const [txFilter, setTxFilter] = useState<'all' | 'escrow' | 'payout' | 'top_up' | 'boost'>('all');

  const loadWalletData = useCallback(async () => {
    // Classifieds mode: nothing here can be reached, so don't even fetch.
    if (!PAYMENTS_ENABLED) { setLoading(false); return; }
    if (!user) return;
    try {
      const [w, txs, pms, tier] = await Promise.all([
        getUserWallet(user.id),
        getWalletTransactions(user.id),
        getPayoutMethods(user.id),
        getSellerTier(user.id),
      ]);
      setWallet(w);
      setTransactions(txs);
      setPayoutMethods(pms);
      setSellerTier(tier);
      if (pms.length > 0 && !selectedMethod) {
        setSelectedMethod(pms.find((p) => p.is_default) || pms[0]);
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedMethod]);

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === 'all') return true;
    if (txFilter === 'escrow') return tx.type === 'escrow_hold' || tx.type === 'escrow_release';
    if (txFilter === 'payout') return tx.type === 'payout';
    if (txFilter === 'top_up') return tx.type === 'top_up' || tx.type === 'deposit';
    if (txFilter === 'boost') return tx.type === 'fee_deduction';
    return true;
  });

  const searchParams = useLocalSearchParams<{ success?: string; amount_cents?: string; id?: string; order?: string; txn_response_code?: string }>();

  useEffect(() => {
    loadWalletData();

    // Check if returning from Paymob approval on web or deep link
    const isApproved =
      searchParams.success === 'true' ||
      searchParams.txn_response_code === 'APPROVED' ||
      (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('success') === 'true'));

    if (isApproved) {
      // Show a toast that payment is being verified by the server
      Toast.show({
        type: 'info',
        text1: 'Verifying Payment... 🔄',
        text2: 'Please wait a moment while we confirm your top-up.',
      });
      
      // Reload wallet data to check if the backend webhook has credited the wallet
      loadWalletData();
    }
  }, [loadWalletData, user, searchParams]);

  const handleTopUpSubmit = async () => {
    if (!user) return;
    const amount = Number(topUpAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Please enter a valid deposit amount' });
      return;
    }
    if (amount < 10) {
      Toast.show({ type: 'error', text1: 'Minimum deposit is EGP 10' });
      return;
    }

    // Card via Paymob is the only deposit path that exists; the Vodafone Cash /
    // InstaPay options here quoted a placeholder number and promised a credit
    // "within 1 hour" that nothing fulfils.
    setToppingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/wallet/topup/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to start payment session');
      }

      setTopUpModalVisible(false);
      setTopUpAmount('');
      router.push({
        pathname: '/payment',
        params: {
          paymentToken: data.paymentToken,
          orderId: data.topupId, // Pass topup ID to check status
          topUpAmount: amount.toString(),
        },
      } as any);
    } catch (err: any) {
      Alert.alert('Deposit Error', err?.message || 'Could not start payment. Try again.');
    } finally {
      setToppingUp(false);
    }
  };


  const handleWithdrawSubmit = async () => {
    if (!user || !wallet || !selectedMethod) {
      Toast.show({ type: 'error', text1: 'Please select a payout account' });
      return;
    }

    const amount = Number(withdrawAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Please enter a valid amount' });
      return;
    }

    if (amount > Number(wallet.available_balance || 0)) {
      Toast.show({ type: 'error', text1: 'Amount exceeds available balance' });
      return;
    }

    setWithdrawing(true);
    try {
      const res = await requestPayout(user.id, amount, selectedMethod);
      // Never "Processed": the backend files a pending payout request for
      // review and transfers nothing.
      Toast.show({ type: 'success', text1: 'Payout Requested 💸', text2: res.message });
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      await loadWalletData();
    } catch (err: any) {
      Alert.alert('Payout Error', err?.message || 'Failed to process payout');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleUpgradeTier = async () => {
    if (!user) return;
    if (nationalIdNum.length !== 14) {
      Toast.show({ type: 'error', text1: 'Egyptian National ID must be 14 digits' });
      return;
    }

    setUpgradingTier(true);
    try {
      // upgradeSellerTier now refuses: a National ID typed into the app was
      // never checked by anything, and the client must not grant itself the
      // Verified badge or a lower fee.
      await upgradeSellerTier(user.id, 2);
      setTierModalVisible(false);
    } catch (err: any) {
      Alert.alert(
        'Verification unavailable',
        err?.message ||
          'Seller verification needs ID documents reviewed by our team, which the app cannot do yet. Your tier is unchanged.',
      );
    } finally {
      setUpgradingTier(false);
    }
  };

  // Classifieds mode: there is no wallet right now (see PLAN-CLASSIFIEDS-MODE.md).
  if (!PAYMENTS_ENABLED) {
    return <NotAvailableYet />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading your EgyBay Wallet…</Text>
      </View>
    );
  }

  const available = Number(wallet?.available_balance || 0);
  const pending = Number(wallet?.pending_balance || 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>My Wallet & Earnings</Text>
        <TouchableOpacity
          onPress={() => router.push('/payout-settings' as any)}
          style={styles.settingsBtn}
        >
          <Settings color="#475569" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadWalletData(); }} />
        }
      >
        <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          {/* Main Wallet Hero Card */}
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceHeroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.walletIconBox}>
                <Wallet color="white" size={20} />
              </View>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>EGP (Egyptian Pound)</Text>
              </View>
            </View>

            {/* Available Balance */}
            <Text style={styles.balanceLabel}>AVAILABLE FOR WITHDRAWAL</Text>
            <Text style={styles.balanceValue}>EGP {available.toLocaleString()}</Text>

            {/* Pending Escrow Balance Box */}
            <View style={styles.pendingBox}>
              <View style={styles.pendingLeft}>
                <Lock color="#F59E0B" size={16} />
                <View>
                  <Text style={styles.pendingLabel}>Pending in Escrow</Text>
                  <Text style={styles.pendingSub}>Releases upon buyer inspection</Text>
                </View>
              </View>
              <Text style={styles.pendingValue}>EGP {pending.toLocaleString()}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.heroActionsRow}>
              {/* Wallet balance on mobile only buys boosts and live passes
                  (digital), so card deposits on iOS would be in-app currency
                  sold outside IAP (Guideline 3.1.1). Payouts stay. */}
              {DIGITAL_PURCHASES_ENABLED && (
                <TouchableOpacity
                  style={styles.topUpHeroBtn}
                  onPress={() => setTopUpModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Plus color="white" size={16} />
                  <Text style={styles.topUpHeroBtnText}>Add Funds</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.withdrawHeroBtn, available <= 0 && { opacity: 0.6 }]}
                disabled={available <= 0}
                onPress={() => setWithdrawModalVisible(true)}
                activeOpacity={0.85}
              >
                <ArrowUpRight color="white" size={16} />
                <Text style={styles.withdrawHeroBtnText}>Withdraw</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.payoutSettingsHeroBtn}
                onPress={() => router.push('/payout-settings' as any)}
                activeOpacity={0.85}
              >
                <Building color="#94A3B8" size={16} />
                <Text style={styles.payoutSettingsHeroBtnText}>Accounts</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* ════════ SELLER TRUST TIER & ESCROW POLICY CARD (eBay Style) ════════ */}
          <View style={styles.tierStatusCard}>
            <View style={styles.tierStatusHeader}>
              <View style={styles.tierBadgeBox}>
                <ShieldCheck color="#2563EB" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.tierNameText}>{sellerTier.name}</Text>
                  <View style={styles.tierTagPill}>
                    <Text style={styles.tierTagPillText}>{sellerTier.badge}</Text>
                  </View>
                </View>
                <Text style={styles.tierSubText}>{sellerTier.kycRequirement}</Text>
              </View>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => router.push('/seller-verification' as any)}
                activeOpacity={0.85}
              >
                <Sparkles size={13} color="#2563EB" />
                <Text style={styles.upgradeBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tierDivider} />

            {/* Tier Rules Grid */}
            <View style={styles.tierGrid}>
              <View style={styles.tierGridItem}>
                <Text style={styles.tierGridLabel}>Commission Fee</Text>
                <Text style={styles.tierGridValue}>{(sellerTier.commissionFeePercent * 100).toFixed(1)}%</Text>
              </View>
              <View style={styles.tierGridItem}>
                <Text style={styles.tierGridLabel}>Monthly Limit</Text>
                <Text style={styles.tierGridValue}>
                  {sellerTier.listingLimitAmount > 1000000
                    ? 'Unlimited'
                    : `EGP ${(sellerTier.listingLimitAmount / 1000).toFixed(0)}K`}
                </Text>
              </View>
              <View style={styles.tierGridItem}>
                <Text style={styles.tierGridLabel}>Hold Release</Text>
                <Text style={styles.tierGridValue} numberOfLines={1}>
                  {sellerTier.tier === 3 ? 'Instant' : 'PIN / Delivery'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Payout Method Card Preview */}
          <View style={styles.payoutBanner}>
            <View style={styles.payoutIconWrap}>
              <Smartphone color="#2563EB" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutBannerTitle}>Payout accounts</Text>
              <Text style={styles.payoutBannerSub}>
                {payoutMethods.length > 0
                  ? `Default: ${payoutMethods[0].account_identifier} (${payoutMethods[0].type.toUpperCase()})`
                  : 'Add your InstaPay address or Vodafone Cash number'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/payout-settings' as any)}
              style={styles.manageBtn}
            >
              <Text style={styles.manageBtnText}>Manage</Text>
              <ChevronRight color="#2563EB" size={14} />
            </TouchableOpacity>
          </View>

          {/* Transaction History Section */}
          <View style={styles.txSectionHeader}>
            <Text style={styles.txSectionTitle}>Financial Activity & Ledger</Text>
            <TouchableOpacity onPress={loadWalletData} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <RefreshCw color="#64748B" size={13} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Transaction Category Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterChip, txFilter === 'all' && styles.filterChipActive]}
              onPress={() => setTxFilter('all')}
            >
              <Text style={[styles.filterChipText, txFilter === 'all' && styles.filterChipTextActive]}>
                All ({transactions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, txFilter === 'escrow' && styles.filterChipActive]}
              onPress={() => setTxFilter('escrow')}
            >
              <Text style={[styles.filterChipText, txFilter === 'escrow' && styles.filterChipTextActive]}>
                🟢 Sales (Escrow)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, txFilter === 'payout' && styles.filterChipActive]}
              onPress={() => setTxFilter('payout')}
            >
              <Text style={[styles.filterChipText, txFilter === 'payout' && styles.filterChipTextActive]}>
                🔴 Payouts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, txFilter === 'top_up' && styles.filterChipActive]}
              onPress={() => setTxFilter('top_up')}
            >
              <Text style={[styles.filterChipText, txFilter === 'top_up' && styles.filterChipTextActive]}>
                ➕ Deposits
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, txFilter === 'boost' && styles.filterChipActive]}
              onPress={() => setTxFilter('boost')}
            >
              <Text style={[styles.filterChipText, txFilter === 'boost' && styles.filterChipTextActive]}>
                ⚡ Ad Boosts
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clock color="#94A3B8" size={32} />
              <Text style={styles.emptyTitle}>No Transactions in this Filter</Text>
              <Text style={styles.emptySub}>
                When transactions in this category occur, they will appear in your ledger here.
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {filteredTransactions.map((tx) => {
                // Real rows use 'top_up' (see wallet_topups webhook); a deposit was
                // rendering as "-EGP 30,000" because only 'deposit' was treated as money in.
                const isPositive = tx.type === 'escrow_release' || tx.type === 'deposit' || tx.type === 'top_up';
                const isPending = tx.type === 'escrow_hold';
                return (
                  <View key={tx.id} style={styles.txCard}>
                    <View
                      style={[
                        styles.txIconWrap,
                        isPending
                          ? { backgroundColor: '#FEF3C7' }
                          : isPositive
                          ? { backgroundColor: '#ECFDF5' }
                          : { backgroundColor: '#EFF6FF' },
                      ]}
                    >
                      {isPending ? (
                        <Lock color="#D97706" size={18} />
                      ) : isPositive ? (
                        <ArrowDownLeft color="#059669" size={18} />
                      ) : (
                        <ArrowUpRight color="#2563EB" size={18} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.txDesc} numberOfLines={1}>
                        {tx.description ||
                          (tx.type === 'escrow_hold'
                            ? 'Escrow Hold (Item Sold)'
                            : tx.type === 'escrow_release'
                            ? 'Escrow Released to Balance'
                            : 'Payout Withdrawal')}
                      </Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.txAmount,
                          isPending
                            ? { color: '#D97706' }
                            : isPositive
                            ? { color: '#059669' }
                            : { color: '#0F172A' },
                        ]}
                      >
                        {isPending ? '' : isPositive ? '+' : '-'}EGP {Number(tx.amount).toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          styles.txStatusBadge,
                          tx.status === 'completed' ? styles.statusCompleted : styles.statusPending,
                        ]}
                      >
                        {tx.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Top Up Modal */}
      <Modal visible={topUpModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Funds to Wallet 💳</Text>
            <Text style={styles.modalSub}>
              Deposit with an Egyptian bank card. Funds appear once Paymob confirms the payment.
            </Text>

            {/* Amount Input */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Deposit Amount (EGP)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                placeholder="e.g. 500"
                keyboardType="numeric"
              />
            </View>

            {/* Preset Amount Pills */}
            <View style={styles.pillsRow}>
              {[100, 250, 500, 1000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.amountPill}
                  onPress={() => setTopUpAmount(amt.toString())}
                >
                  <Text style={styles.amountPillText}>+{amt} EGP</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.pmOptionCard}>
              <CreditCard size={18} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pmOptionName}>Bank Card (Visa / Mastercard / Meeza)</Text>
                <Text style={styles.pmOptionId}>Secure checkout by Paymob</Text>
              </View>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setTopUpModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleTopUpSubmit}
                disabled={toppingUp}
              >
                {toppingUp ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Add EGP {topUpAmount || '0'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal visible={withdrawModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Withdraw Available Funds</Text>
            <Text style={styles.modalSub}>
              Available balance: <Text style={{ fontWeight: '800', color: '#0F172A' }}>EGP {available.toLocaleString()}</Text>
            </Text>

            {/* Amount Input */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Withdrawal Amount (EGP)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder={`Max ${available}`}
                keyboardType="numeric"
              />
            </View>

            {/* Preset Amount Pills */}
            <View style={styles.presetRow}>
              {[500, 1000, 2500, available].map((amt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.presetChip}
                  onPress={() => setWithdrawAmount(amt.toString())}
                >
                  <Text style={styles.presetChipText}>{i === 3 ? 'ALL' : `EGP ${amt}`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Destination Selector */}
            <Text style={[styles.modalInputLabel, { marginTop: 14 }]}>Destination Account</Text>
            {payoutMethods.map((pm) => (
              <TouchableOpacity
                key={pm.id}
                style={[
                  styles.pmOptionCard,
                  selectedMethod?.id === pm.id && styles.pmOptionActive,
                ]}
                onPress={() => setSelectedMethod(pm)}
              >
                <Smartphone size={18} color={selectedMethod?.id === pm.id ? '#2563EB' : '#64748B'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pmOptionName}>{pm.account_holder_name}</Text>
                  <Text style={styles.pmOptionId}>{pm.account_identifier} ({pm.type.toUpperCase()})</Text>
                </View>
                {selectedMethod?.id === pm.id && <CheckCircle2 color="#2563EB" size={18} />}
              </TouchableOpacity>
            ))}

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setWithdrawModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleWithdrawSubmit}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Confirm Payout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KYC Seller Tier Upgrade Modal */}
      <Modal visible={tierModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldCheck color="#2563EB" size={24} />
              <Text style={styles.modalTitle}>Seller Tier Verification</Text>
            </View>
            <Text style={styles.modalSub}>
              Upgrade to <Text style={{ fontWeight: '800', color: '#0F172A' }}>Tier 2 (Verified Trader)</Text> to reduce commission to 4%, increase monthly selling limit to 150,000 EGP, and get the Verified Trader Badge 🛡️.
            </Text>

            {/* National ID Input */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Egyptian National ID Number (الرقم القومي - 14 رقم)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={nationalIdNum}
                onChangeText={setNationalIdNum}
                placeholder="2980101XXXXXXX"
                keyboardType="number-pad"
                maxLength={14}
              />
            </View>

            {/* Document Upload Buttons */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadBox}>
                <Upload size={18} color="#2563EB" />
                <Text style={styles.uploadText}>ID Front (وجه البطاقة)</Text>
                <Text style={styles.uploadSub}>Verified</Text>
              </View>
              <View style={styles.uploadBox}>
                <Upload size={18} color="#2563EB" />
                <Text style={styles.uploadText}>ID Back (ظهر البطاقة)</Text>
                <Text style={styles.uploadSub}>Verified</Text>
              </View>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setTierModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleUpgradeTier}
                disabled={upgradingTier}
              >
                {upgradingTier ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit for Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '600' },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { padding: 16 },

  balanceHeroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  walletIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currencyBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },

  balanceLabel: { fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  balanceValue: { fontSize: 32, fontWeight: '900', color: 'white', marginBottom: 16 },

  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pendingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingLabel: { color: 'white', fontSize: 12, fontWeight: '700' },
  pendingSub: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 },
  pendingValue: { color: '#FCD34D', fontSize: 15, fontWeight: '800' },

  heroActionsRow: { flexDirection: 'row', gap: 8 },
  topUpHeroBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 12,
  },
  topUpHeroBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
  withdrawHeroBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
  },
  withdrawHeroBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
  payoutSettingsHeroBtn: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  payoutSettingsHeroBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },

  pillsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  amountPill: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  amountPillText: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },

  // Tier Status Card
  tierStatusCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  tierStatusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierBadgeBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  tierNameText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  tierTagPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tierTagPillText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  tierSubText: { fontSize: 11, color: '#64748B', marginTop: 1 },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  upgradeBtnText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  tierDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  tierGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  tierGridItem: { alignItems: 'center', flex: 1 },
  tierGridLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginBottom: 2 },
  tierGridValue: { fontSize: 13, fontWeight: '800', color: '#0F172A' },

  payoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  payoutIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutBannerTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  payoutBannerSub: { fontSize: 11, color: '#64748B' },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },

  txSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  txSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

  filterScroll: { flexDirection: 'row', gap: 6, marginBottom: 12, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterChipTextActive: { color: '#2563EB', fontWeight: '800' },

  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 10, marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 16 },

  txList: { gap: 8 },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txIconWrap: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  txDesc: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  txDate: { fontSize: 11, color: '#94A3B8' },
  txAmount: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  txStatusBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  statusCompleted: { backgroundColor: '#ECFDF5', color: '#059669' },
  statusPending: { backgroundColor: '#FEF3C7', color: '#D97706' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },
  modalInputGroup: { marginBottom: 12 },
  modalInputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  modalTextInput: {
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  pmOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  pmOptionActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  pmOptionName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  pmOptionId: { fontSize: 11, color: '#64748B' },

  uploadRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  uploadBox: {
    flex: 1,
    height: 76,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadText: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  uploadSub: { fontSize: 11, color: '#059669', fontWeight: '700' },

  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  modalSubmitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitText: { fontSize: 14, fontWeight: '800', color: 'white' },
});
