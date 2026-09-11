import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Banknote,
  Building,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../hooks/useAuth';
import {
  addPayoutMethod,
  getPayoutMethods,
  getUserWallet,
  updatePayoutSchedule,
  type PayoutMethod,
} from '../src/services/lib/walletService';

export default function PayoutSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // eBay Payout Schedule & Settings
  const [payoutSchedule, setPayoutSchedule] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [expressPayoutEnabled, setExpressPayoutEnabled] = useState(true);

  // Form State
  const [type, setType] = useState<PayoutMethod['type']>('instapay_ipa');
  const [identifier, setIdentifier] = useState('');
  const [holderName, setHolderName] = useState(user?.user_metadata?.full_name || '');

  const loadData = async () => {
    if (!user) return;
    try {
      const [methodsData, walletData] = await Promise.all([
        getPayoutMethods(user.id),
        getUserWallet(user.id),
      ]);
      setMethods(methodsData);
      if ((walletData as any)?.payout_schedule) {
        setPayoutSchedule((walletData as any).payout_schedule);
      }
      if ((walletData as any)?.express_payout_enabled !== undefined) {
        setExpressPayoutEnabled((walletData as any).express_payout_enabled);
      }
    } catch (err) {
      console.error('Error loading payout settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSelectSchedule = async (newSchedule: 'daily' | 'weekly' | 'monthly') => {
    if (!user) return;
    setPayoutSchedule(newSchedule);
    try {
      await updatePayoutSchedule(user.id, newSchedule, expressPayoutEnabled);
      Toast.show({ type: 'success', text1: `Schedule updated to ${newSchedule.toUpperCase()}! 📅` });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleExpress = async () => {
    if (!user) return;
    const newVal = !expressPayoutEnabled;
    setExpressPayoutEnabled(newVal);
    try {
      await updatePayoutSchedule(user.id, payoutSchedule, newVal);
      Toast.show({
        type: 'success',
        text1: newVal ? '⚡ Instant Express Payouts Enabled' : 'Standard Payouts Enabled',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMethod = async () => {
    if (!user) return;
    if (!identifier.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter account identifier (phone or IPA)' });
      return;
    }
    if (!holderName.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter account holder name' });
      return;
    }

    setSaving(true);
    try {
      await addPayoutMethod(user.id, {
        user_id: user.id,
        type,
        account_identifier: identifier.trim(),
        account_holder_name: holderName.trim(),
        is_default: methods.length === 0,
        is_verified: true,
      });

      Toast.show({ type: 'success', text1: 'Payout Account Added! 🎉' });
      setModalVisible(false);
      setIdentifier('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add payout method');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading payout accounts…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Payout Settings & Schedule</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addIconBtn}>
          <Plus color="#2563EB" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          {/* Trust Banner */}
          <View style={styles.infoBanner}>
            <ShieldCheck color="#2563EB" size={22} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Instant Egyptian Payout Channels 🇪🇬</Text>
              <Text style={styles.infoBannerSub}>
                When escrow funds are released, you can transfer your earnings instantly to your InstaPay address or Mobile Wallet with zero delay.
              </Text>
            </View>
          </View>

          {/* ════════ EBAY AUTOMATED PAYOUT SCHEDULE ════════ */}
          <Text style={styles.sectionHeading}>Automated Payout Schedule</Text>
          <View style={styles.scheduleCard}>
            <TouchableOpacity
              style={[styles.scheduleOption, payoutSchedule === 'daily' && styles.scheduleOptionActive]}
              onPress={() => handleSelectSchedule('daily')}
              activeOpacity={0.85}
            >
              <View style={[styles.scheduleIconBox, payoutSchedule === 'daily' && styles.scheduleIconBoxActive]}>
                <Clock color={payoutSchedule === 'daily' ? '#2563EB' : '#64748B'} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.scheduleTitleRow}>
                  <Text style={styles.scheduleTitle}>Daily Payouts</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>FASTEST</Text>
                  </View>
                </View>
                <Text style={styles.scheduleSub}>Every morning at 8:00 AM for cleared balance</Text>
              </View>
              <CheckCircle2 color={payoutSchedule === 'daily' ? '#2563EB' : '#CBD5E1'} size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scheduleOption, payoutSchedule === 'weekly' && styles.scheduleOptionActive]}
              onPress={() => handleSelectSchedule('weekly')}
              activeOpacity={0.85}
            >
              <View style={[styles.scheduleIconBox, payoutSchedule === 'weekly' && styles.scheduleIconBoxActive]}>
                <Calendar color={payoutSchedule === 'weekly' ? '#2563EB' : '#64748B'} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleTitle}>Weekly Payouts</Text>
                <Text style={styles.scheduleSub}>Every Tuesday in a single batch</Text>
              </View>
              <CheckCircle2 color={payoutSchedule === 'weekly' ? '#2563EB' : '#CBD5E1'} size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scheduleOption, payoutSchedule === 'monthly' && styles.scheduleOptionActive]}
              onPress={() => handleSelectSchedule('monthly')}
              activeOpacity={0.85}
            >
              <View style={[styles.scheduleIconBox, payoutSchedule === 'monthly' && styles.scheduleIconBoxActive]}>
                <Calendar color={payoutSchedule === 'monthly' ? '#2563EB' : '#64748B'} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleTitle}>Monthly Payouts</Text>
                <Text style={styles.scheduleSub}>1st Tuesday of every month</Text>
              </View>
              <CheckCircle2 color={payoutSchedule === 'monthly' ? '#2563EB' : '#CBD5E1'} size={20} />
            </TouchableOpacity>
          </View>

          {/* ════════ EXPRESS PAYOUT TOGGLE ════════ */}
          <View style={styles.expressCard}>
            <View style={styles.expressLeft}>
              <View style={styles.expressIconBox}>
                <Zap color="#D97706" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expressTitle}>⚡ 24/7 Express Payouts</Text>
                <Text style={styles.expressSub}>
                  Instant on-demand transfers to InstaPay IPA within 30 seconds
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.togglePill, expressPayoutEnabled && styles.togglePillActive]}
              onPress={handleToggleExpress}
              activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
          >
              <View style={[styles.toggleCircle, expressPayoutEnabled && styles.toggleCircleActive]} />
            </TouchableOpacity>
          </View>

          {/* Accounts List */}
          <Text style={styles.sectionHeading}>Configured Accounts</Text>
          <View style={styles.accountsList}>
            {methods.map((pm) => (
              <View key={pm.id} style={styles.accountCard}>
                <View style={styles.accountIconBox}>
                  {pm.type === 'instapay_ipa' ? (
                    <Building color="#2563EB" size={20} />
                  ) : pm.type === 'bank_account' ? (
                    <Banknote color="#059669" size={20} />
                  ) : (
                    <Smartphone color="#D97706" size={20} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.accountTitleRow}>
                    <Text style={styles.accountName}>{pm.account_holder_name}</Text>
                    {pm.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.accountIdentifier}>
                    {pm.account_identifier} • {pm.type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>

                <CheckCircle2 color={pm.is_default ? '#2563EB' : '#CBD5E1'} size={20} />
              </View>
            ))}
          </View>

          {/* Add Account Button */}
          <TouchableOpacity
            style={styles.addAccountBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Plus color="#2563EB" size={18} />
            <Text style={styles.addAccountBtnText}>Add New Payout Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Payout Account</Text>
            <Text style={styles.modalSub}>Select your preferred channel to receive your earnings.</Text>

            {/* Type Selector */}
            <Text style={styles.inputLabel}>Account Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeChip, type === 'instapay_ipa' && styles.typeChipActive]}
                onPress={() => setType('instapay_ipa')}
              >
                <Text style={[styles.typeChipText, type === 'instapay_ipa' && styles.typeChipTextActive]}>
                  InstaPay (IPA)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeChip, type === 'vodafone_cash' && styles.typeChipActive]}
                onPress={() => setType('vodafone_cash')}
              >
                <Text style={[styles.typeChipText, type === 'vodafone_cash' && styles.typeChipTextActive]}>
                  Vodafone Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeChip, type === 'orange_cash' && styles.typeChipActive]}
                onPress={() => setType('orange_cash')}
              >
                <Text style={[styles.typeChipText, type === 'orange_cash' && styles.typeChipTextActive]}>
                  Orange Cash
                </Text>
              </TouchableOpacity>
            </View>

            {/* Identifier Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {type === 'instapay_ipa' ? 'InstaPay IPA Address' : 'Mobile Wallet Number (+20)'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={type === 'instapay_ipa' ? 'e.g. yourname@instapay' : '010XXXXXXXX'}
                value={identifier}
                onChangeText={setIdentifier}
              />
            </View>

            {/* Holder Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Holder Full Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Full name as registered on account"
                value={holderName}
                onChangeText={setHolderName}
              />
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddMethod} disabled={saving}>
                {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveBtnText}>Save Account</Text>}
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
  addIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: { padding: 16 },

  // Payout Schedule Styles
  scheduleCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  scheduleOptionActive: { backgroundColor: '#F8FAFF' },
  scheduleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleIconBoxActive: { backgroundColor: '#EFF6FF' },
  scheduleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  recommendedBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  recommendedBadgeText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  scheduleSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  // Express Payout Styles
  expressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  expressLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  expressIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expressTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  expressSub: { fontSize: 11, color: '#B45309', marginTop: 1 },

  togglePill: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  togglePillActive: { backgroundColor: '#10B981' },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  toggleCircleActive: { alignSelf: 'flex-end' },

  infoBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  infoBannerTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 3 },
  infoBannerSub: { fontSize: 11, color: '#3B82F6', lineHeight: 16 },

  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },

  accountsList: { gap: 10, marginBottom: 16 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  accountIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  accountName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  defaultBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  defaultBadgeText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  accountIdentifier: { fontSize: 12, color: '#64748B' },

  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
  },
  addAccountBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 16 },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  typeChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  typeChipTextActive: { color: '#2563EB' },

  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  modalInput: {
    height: 46,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },

  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  saveBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: 'white' },
});
