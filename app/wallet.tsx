import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Building,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
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
import Toast from 'react-native-toast-message';
import { useAuth } from '../hooks/useAuth';
import {
  getPayoutMethods,
  getUserWallet,
  getWalletTransactions,
  requestPayout,
  type PayoutMethod,
  type UserWallet,
  type WalletTransaction,
} from '../src/services/lib/walletService';

export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawal Modal state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const loadWalletData = useCallback(async () => {
    if (!user) return;
    try {
      const [w, txs, pms] = await Promise.all([
        getUserWallet(user.id),
        getWalletTransactions(user.id),
        getPayoutMethods(user.id),
      ]);
      setWallet(w);
      setTransactions(txs);
      setPayoutMethods(pms);
      if (pms.length > 0 && !selectedMethod) {
        setSelectedMethod(pms.find((p) => p.is_default) || pms[0]);
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

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
      Toast.show({ type: 'success', text1: 'Payout Processed! 💸', text2: res.message });
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      await loadWalletData();
    } catch (err: any) {
      Alert.alert('Payout Error', err?.message || 'Failed to process payout');
    } finally {
      setWithdrawing(false);
    }
  };

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
              <TouchableOpacity
                style={[styles.withdrawHeroBtn, available <= 0 && { opacity: 0.6 }]}
                disabled={available <= 0}
                onPress={() => setWithdrawModalVisible(true)}
                activeOpacity={0.85}
              >
                <ArrowUpRight color="white" size={18} />
                <Text style={styles.withdrawHeroBtnText}>Withdraw Funds</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.payoutSettingsHeroBtn}
                onPress={() => router.push('/payout-settings' as any)}
                activeOpacity={0.85}
              >
                <Building color="#94A3B8" size={16} />
                <Text style={styles.payoutSettingsHeroBtnText}>Payout Accounts</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Quick Payout Method Card Preview */}
          <View style={styles.payoutBanner}>
            <View style={styles.payoutIconWrap}>
              <Smartphone color="#2563EB" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutBannerTitle}>Instant InstaPay & Wallet Payouts</Text>
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
            <Text style={styles.txSectionTitle}>Transaction Activity</Text>
            <TouchableOpacity onPress={loadWalletData} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <RefreshCw color="#64748B" size={13} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clock color="#94A3B8" size={32} />
              <Text style={styles.emptyTitle}>No Transactions Yet</Text>
              <Text style={styles.emptySub}>
                When you sell an item or receive an escrow payment, it will appear in your ledger here.
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => {
                const isPositive = tx.type === 'escrow_release' || tx.type === 'deposit';
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
    marginBottom: 16,
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

  balanceLabel: { fontSize: 10, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
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
  pendingSub: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 10 },
  pendingValue: { color: '#FCD34D', fontSize: 15, fontWeight: '800' },

  heroActionsRow: { flexDirection: 'row', gap: 10 },
  withdrawHeroBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
  },
  withdrawHeroBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  payoutSettingsHeroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  payoutSettingsHeroBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },

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
    marginBottom: 12,
  },
  txSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

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
  txStatusBadge: { fontSize: 9, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
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
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  modalInputGroup: { marginBottom: 10 },
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

  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
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
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitText: { fontSize: 14, fontWeight: '800', color: 'white' },
});
