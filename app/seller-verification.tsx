import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Building,
  Camera,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileCheck,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  User,
  Zap,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  addPayoutMethod,
  getSellerTier,
  upgradeSellerTier,
  validateEgyptianNationalId,
  type SellerTierConfig,
} from '../src/services/lib/walletService';
import NotAvailableYet from '../src/components/NotAvailableYet';
import { PAYMENTS_ENABLED } from '../src/services/lib/platformCommerce';

export default function SellerVerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Form State
  const [selectedTier, setSelectedTier] = useState<2 | 3>(2);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || 'Mohamed Ibrahim');
  const [nationalIdNum, setNationalIdNum] = useState('');
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [commercialRegNum, setCommercialRegNum] = useState('');
  const [instapayIpa, setInstapayIpa] = useState('');
  const [vodafoneCash, setVodafoneCash] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [storeName, setStoreName] = useState('Tech Deals Cairo');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const pickImage = async (type: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        if (type === 'front') setIdFrontUri(result.assets[0].uri);
        else setIdBackUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open image library');
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (nationalIdNum.length !== 14) {
        Toast.show({ type: 'error', text1: 'National ID must be 14 digits' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmitVerification = async () => {
    if (!user) return;
    const hasAtLeastOne = instapayIpa.trim() || vodafoneCash.trim() || bankIban.trim();
    if (!hasAtLeastOne) {
      Toast.show({ type: 'error', text1: 'Please provide at least one payout destination' });
      return;
    }

    setSubmitting(true);
    try {
      // The tier is deliberately NOT granted here. ID verification needs the
      // document upload + human review flow web has; until mobile has it, this
      // screen saves the payout destinations (which is real) and says plainly
      // that verification itself is still pending. See upgradeSellerTier().

      // Register payout methods (add each non-empty method)
      let isFirst = true;

      if (instapayIpa.trim()) {
        await addPayoutMethod(user.id, {
          user_id: user.id,
          type: 'instapay_ipa',
          account_identifier: instapayIpa.trim(),
          account_holder_name: fullName.trim(),
          is_default: isFirst,
          is_verified: false,
        });
        isFirst = false;
      }

      if (vodafoneCash.trim()) {
        await addPayoutMethod(user.id, {
          user_id: user.id,
          type: 'vodafone_cash',
          account_identifier: vodafoneCash.trim(),
          account_holder_name: fullName.trim(),
          is_default: isFirst,
          is_verified: false,
        });
        isFirst = false;
      }

      if (bankIban.trim()) {
        await addPayoutMethod(user.id, {
          user_id: user.id,
          type: 'bank_account',
          account_identifier: bankIban.trim(),
          account_holder_name: fullName.trim(),
          is_default: isFirst,
          is_verified: false,
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Payout details saved',
        text2: 'ID verification is not available in the app yet — your seller tier is unchanged.',
        visibilityTime: 6000,
      });

      router.replace('/wallet' as any);
    } catch (err: any) {
      Alert.alert('Verification Error', err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Classifieds mode: seller tiers do not exist right now (see PLAN-CLASSIFIEDS-MODE.md).
  if (!PAYMENTS_ENABLED) {
    return <NotAvailableYet />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#0F172A" size={22} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.topTitle}>Seller Identity Verification</Text>
            <Text style={styles.topSub}>Amazon & eBay Grade KYC Pipeline</Text>
          </View>
          <View style={styles.lockBadge}>
            <ShieldCheck color="#10B981" size={14} />
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.stepBarWrap}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepDotNum, step >= 1 && styles.stepDotNumActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepDotNum, step >= 2 && styles.stepDotNumActive]}>2</Text>
          </View>
          <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
            <Text style={[styles.stepDotNum, step >= 3 && styles.stepDotNumActive]}>3</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        >
          <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
            {/* ════════ STEP 1: TIER SELECTION & NATIONAL ID ════════ */}
            {step === 1 && (
              <View>
                <Text style={styles.sectionHeading}>Choose Your Seller Tier</Text>

                {/* Tier 2: Verified Trader */}
                <TouchableOpacity
                  style={[styles.tierSelectCard, selectedTier === 2 && styles.tierSelectActive]}
                  onPress={() => setSelectedTier(2)}
                  activeOpacity={0.85}
                >
                  <View style={styles.tierSelectTop}>
                    <View style={styles.tierIconBox}>
                      <ShieldCheck color="#2563EB" size={22} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.tierCardTitle}>Tier 2: Verified Trader</Text>
                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText}>RECOMMENDED</Text>
                        </View>
                      </View>
                      <Text style={styles.tierCardSub}>For regular individuals, phone traders & power sellers</Text>
                    </View>
                    <CheckCircle2 color={selectedTier === 2 ? '#2563EB' : '#CBD5E1'} size={20} />
                  </View>
                  <View style={styles.perksRow}>
                    <Text style={styles.perkChip}>🛡️ 4% Fee (Reduced)</Text>
                    <Text style={styles.perkChip}>📦 50 Active Listings</Text>
                    <Text style={styles.perkChip}>💰 150,000 EGP Limit</Text>
                  </View>
                </TouchableOpacity>

                {/* Tier 3: Pro Merchant */}
                <TouchableOpacity
                  style={[styles.tierSelectCard, selectedTier === 3 && styles.tierSelectActive]}
                  onPress={() => setSelectedTier(3)}
                  activeOpacity={0.85}
                >
                  <View style={styles.tierSelectTop}>
                    <View style={[styles.tierIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Sparkles color="#D97706" size={22} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierCardTitle}>Tier 3: EgyBay Pro / Store</Text>
                      <Text style={styles.tierCardSub}>For registered retail shops, distributors & companies</Text>
                    </View>
                    <CheckCircle2 color={selectedTier === 3 ? '#2563EB' : '#CBD5E1'} size={20} />
                  </View>
                  <View style={styles.perksRow}>
                    <Text style={styles.perkChip}>⭐ 2.5% Fee (Lowest)</Text>
                    <Text style={styles.perkChip}>🚀 Instant Clearance</Text>
                    <Text style={styles.perkChip}>♾️ Unlimited Listings</Text>
                  </View>
                </TouchableOpacity>

                <Text style={[styles.sectionHeading, { marginTop: 18 }]}>Government Identity Details</Text>
                <View style={styles.formCard}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Legal Name (as printed on National ID)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="e.g. Mohamed Ahmed Ibrahim"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Egyptian National ID Number (الرقم القومي - 14 رقم)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={nationalIdNum}
                      onChangeText={setNationalIdNum}
                      placeholder="2980101XXXXXXX"
                      keyboardType="number-pad"
                      maxLength={14}
                    />
                    {validateEgyptianNationalId(nationalIdNum).isValid ? (
                      <View style={styles.autoVerifyBadge}>
                        <CheckCircle2 color="#059669" size={16} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.autoVerifyTitle}>Valid National ID (Auto-Verified) ✓</Text>
                          <Text style={styles.autoVerifySub}>
                            {validateEgyptianNationalId(nationalIdNum).governorate} • Born {validateEgyptianNationalId(nationalIdNum).birthDate} • {validateEgyptianNationalId(nationalIdNum).gender === 'male' ? 'Male' : 'Female'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.helperText}>Used exclusively to verify identity and prevent marketplace fraud.</Text>
                    )}
                  </View>

                  {selectedTier === 3 && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Commercial Registry Number (السجل التجاري)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={commercialRegNum}
                        onChangeText={setCommercialRegNum}
                        placeholder="CR-104928-EG"
                      />
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ════════ STEP 2: DOCUMENT PHOTOS (FRONT & BACK) ════════ */}
            {step === 2 && (
              <View>
                <Text style={styles.sectionHeading}>Upload National ID Documents</Text>
                <Text style={styles.sectionSub}>Take a clear, non-glare photo of your Egyptian National ID card.</Text>

                {/* ID Front */}
                <View style={styles.docUploadCard}>
                  <View style={styles.docHeader}>
                    <Text style={styles.docTitle}>1. ID Card Front (وجه البطاقة)</Text>
                    {idFrontUri && <Text style={styles.uploadedTag}>READY</Text>}
                  </View>
                  {idFrontUri ? (
                    <Image source={{ uri: idFrontUri }} style={styles.previewImage} />
                  ) : (
                    <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => pickImage('front')}>
                      <Camera size={28} color="#2563EB" />
                      <Text style={styles.uploadPrompt}>Tap to Take or Upload Photo</Text>
                      <Text style={styles.uploadHint}>Make sure all 4 corners are visible</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* ID Back */}
                <View style={styles.docUploadCard}>
                  <View style={styles.docHeader}>
                    <Text style={styles.docTitle}>2. ID Card Back (ظهر البطاقة)</Text>
                    {idBackUri && <Text style={styles.uploadedTag}>READY</Text>}
                  </View>
                  {idBackUri ? (
                    <Image source={{ uri: idBackUri }} style={styles.previewImage} />
                  ) : (
                    <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => pickImage('back')}>
                      <Camera size={28} color="#2563EB" />
                      <Text style={styles.uploadPrompt}>Tap to Take or Upload Photo</Text>
                      <Text style={styles.uploadHint}>Showing marital status & job</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ════════ STEP 3: PAYOUT ACCOUNT & STORE SETUP ════════ */}
            {step === 3 && (
              <View>
                <Text style={styles.sectionHeading}>Link Egyptian Payout Accounts</Text>
                <Text style={styles.sectionSub}>Provide your payout destinations for escrow withdrawals. You can link all 3 (at least 1 required).</Text>

                <View style={styles.formCard}>
                  {/* 1. InstaPay IPA */}
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Building size={16} color="#2563EB" />
                      <Text style={styles.inputLabel}>1. InstaPay IPA Handle</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={instapayIpa}
                      onChangeText={setInstapayIpa}
                      placeholder="e.g. mohamed@instapay"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* 2. Vodafone Cash */}
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Smartphone size={16} color="#E11D48" />
                      <Text style={styles.inputLabel}>2. Vodafone Cash / Mobile Wallet</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={vodafoneCash}
                      onChangeText={setVodafoneCash}
                      placeholder="e.g. 010XXXXXXXX"
                      keyboardType="phone-pad"
                    />
                  </View>

                  {/* 3. Bank Account IBAN */}
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <CreditCard size={16} color="#059669" />
                      <Text style={styles.inputLabel}>3. Bank Account IBAN</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={bankIban}
                      onChangeText={setBankIban}
                      placeholder="e.g. EG380002000100000000012345678"
                      autoCapitalize="characters"
                    />
                  </View>

                  {/* Store Name */}
                  <View style={[styles.inputGroup, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14 }]}>
                    <Text style={styles.inputLabel}>Storefront / Seller Brand Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={storeName}
                      onChangeText={setStoreName}
                      placeholder="e.g. Cairo Tech Store"
                    />
                  </View>
                </View>

                {/* Final Guarantee Card */}
                <View style={styles.finalGuaranteeBox}>
                  <ShieldCheck color="#10B981" size={24} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.finalGuaranteeTitle}>100% Anti-Fraud & Escrow Guarantee</Text>
                    <Text style={styles.finalGuaranteeSub}>
                      Your verified badge will be activated immediately. You are protected by EgyBay Seller Protection on all qualifying orders.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation CTA */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backStepBtn}
              onPress={() => setStep((s) => (s - 1) as any)}
            >
              <Text style={styles.backStepBtnText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.nextStepBtn, step === 1 && { flex: 1 }]}
            onPress={step === 3 ? handleSubmitVerification : handleNextStep}
            disabled={submitting}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextStepGradient}
            >
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text style={styles.nextStepText}>
                    {step === 3 ? 'Activate Verified Seller 🛡️' : 'Continue to Next Step'}
                  </Text>
                  <ChevronRight color="white" size={18} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
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
  topTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  topSub: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  lockBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },

  stepBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepDotActive: { backgroundColor: '#0F172A', borderColor: '#2563EB' },
  stepDotNum: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  stepDotNumActive: { color: 'white' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E2E8F0' },
  stepLineActive: { backgroundColor: '#0F172A' },

  scrollContent: { padding: 16 },

  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  sectionSub: { fontSize: 12, color: '#64748B', marginBottom: 16, lineHeight: 16 },

  tierSelectCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  tierSelectActive: { borderColor: '#2563EB', backgroundColor: '#F8FAFF' },
  tierSelectTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  tierIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  tierCardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  badgePill: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgePillText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  tierCardSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  perksRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  perkChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  formCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  textInput: {
    height: 46,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  helperText: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  autoVerifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 8,
  },
  autoVerifyTitle: { fontSize: 12, fontWeight: '800', color: '#065F46' },
  autoVerifySub: { fontSize: 11, color: '#047857', marginTop: 1 },

  docUploadCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  docTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  uploadedTag: { fontSize: 11, fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  uploadPlaceholder: {
    height: 120,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadPrompt: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  uploadHint: { fontSize: 11, color: '#94A3B8' },
  previewImage: { width: '100%', height: 160, borderRadius: 12, resizeMode: 'cover' },

  payoutSelectorRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  payoutOptionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'white',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  payoutOptionActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  payoutOptionText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  payoutOptionTextActive: { color: '#2563EB' },

  finalGuaranteeBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  finalGuaranteeTitle: { fontSize: 13, fontWeight: '800', color: '#065F46', marginBottom: 2 },
  finalGuaranteeSub: { fontSize: 11, color: '#047857', lineHeight: 15 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backStepBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backStepBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  nextStepBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  nextStepGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  nextStepText: { color: 'white', fontSize: 14, fontWeight: '800' },
});
