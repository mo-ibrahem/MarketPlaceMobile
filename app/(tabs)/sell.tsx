import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  FileText,
  ImagePlus,
  MapPin,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useAuth } from "../../hooks/useAuth";
import { productService } from "../../src/services/lib/products";
import { supabase } from "../../src/services/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CATEGORIES = [
  { value: "Electronics", labelKey: "sell.categories.electronics", emoji: "📱" },
  { value: "Fashion",     labelKey: "sell.categories.fashion",     emoji: "👗" },
  { value: "Home",        labelKey: "sell.categories.home",        emoji: "🏠" },
  { value: "Toys",        labelKey: "sell.categories.toys",        emoji: "🧸" },
  { value: "Books",       labelKey: "sell.categories.books",       emoji: "📚" },
  { value: "Sports",      labelKey: "sell.categories.sports",      emoji: "⚽" },
  { value: "Beauty",      labelKey: "sell.categories.beauty",      emoji: "💄" },
  { value: "Automotive",  labelKey: "sell.categories.automotive",  emoji: "🚗" },
];

const CONDITIONS = [
  { value: "New",  labelKey: "sell.conditions.new",  desc: "Unused, original packaging", color: "#10B981", bg: "#D1FAE5" },
  { value: "Used", labelKey: "sell.conditions.used", desc: "Pre-owned, in good shape",    color: "#F59E0B", bg: "#FEF3C7" },
];

const EGYPTIAN_GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Luxor', 'Aswan', 'Asyut',
  'Beheira', 'Beni Suef', 'Dakahlia', 'Damietta', 'Fayoum',
  'Gharbia', 'Ismailia', 'Kafr El Sheikh', 'Matruh', 'Minya',
  'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia',
  'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
];

const STEPS = [
  { id: 1, label: "Photos",  icon: Camera    },
  { id: 2, label: "Details", icon: FileText  },
  { id: 3, label: "Pricing", icon: Tag },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SellScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  // Wizard step (1–3)
  const [step, setStep] = useState(1);

  // Form data
  const [images,    setImages]    = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [title,     setTitle]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [price,     setPrice]     = useState("");
  const [category,  setCategory]  = useState("Electronics");
  const [condition, setCondition] = useState("New");
  const [location,  setLocation]  = useState("");
  const [stock,     setStock]     = useState("1");
  const [isPromotedOnSale, setIsPromotedOnSale] = useState(false);
  const [promotedAdRate, setPromotedAdRate] = useState(0.08); // 8% default
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  // Progress animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Submit button scale
  const submitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: (step - 1) / (STEPS.length - 1),
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [step]);

  // Reset the entire form every time this tab comes into focus.
  // Tab screens stay mounted, so without this the success state or a
  // partially-filled form would persist when the user leaves and returns.
  useFocusEffect(
    useCallback(() => {
      setStep(1);
      setImages([]);
      setTitle('');
      setDesc('');
      setPrice('');
      setCategory('Electronics');
      setCondition('New');
      setLocation('');
      setLoading(false);
      setDone(false);
    }, [])
  );

  // Photo picker
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();
  }, []);

  const handlePickImage = async () => {
    const { granted } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(t("sell.permissionTitle"), t("sell.permissionMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("sell.openSettings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 0.65,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets].slice(0, 6));
    }
  };

  const removeImage = (idx: number) =>
    setImages(prev => prev.filter((_, i) => i !== idx));

  // Upload helpers
  const uploadImage = async (img: ImagePicker.ImagePickerAsset) => {
    const buf = await fetch(img.uri).then(r => r.arrayBuffer());
    const ext = img.uri.split(".").pop()?.toLowerCase() ?? "jpeg";
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, buf, { contentType: `image/${ext}` });
    if (error) throw error;
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  // Validation per step
  const canAdvance = () => {
    if (step === 1) return images.length > 0;
    if (step === 2) return title.trim().length > 0;
    return true;
  };

  const goNext = () => { if (step < 3) setStep(s => s + 1); };
  const goBack = () => { if (step > 1) setStep(s => s - 1); };

  // Submit
  const handleSubmit = async () => {
    if (!user) {
      Toast.show({ type: "error", text1: t("common.error"), text2: t("sell.notLoggedInError") });
      return;
    }
    if (!title || !price || images.length === 0) {
      Toast.show({ type: "error", text1: t("sell.missingFieldsTitle"), text2: t("sell.missingFieldsMessage") });
      return;
    }

    // Press animation
    Animated.sequence([
      Animated.timing(submitScale, { toValue: 0.94, duration: 100, useNativeDriver: true }),
      Animated.spring(submitScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    setLoading(true);
    try {
      const stockNum = Math.max(1, parseInt(stock, 10) || 1);
      const tags = [
        location ? `📍 ${location}` : '',
        `📦 Stock: ${stockNum}`,
      ].filter(Boolean).join('\n');
      const fullDescription = `${desc.trim()}\n\n${tags}`;

      const imageUrls = await Promise.all(images.map(uploadImage));
      await productService.createProduct({
        title: title.trim(),
        description: fullDescription,
        price: parseFloat(price),
        category,
        condition,
        images: imageUrls,
        is_promoted: isPromotedOnSale,
        promoted_ad_rate: isPromotedOnSale ? promotedAdRate : 0,
        is_promoted_on_sale: isPromotedOnSale,
      });
      setDone(true);
      // Reset the form after the success screen so the next visit starts fresh.
      // We do NOT call router.back() because this is a tab screen — there is
      // nothing on the stack to go back to, and the tab stays mounted anyway.
      setTimeout(() => {
        setDone(false);
        setStep(1);
        setImages([]);
        setTitle('');
        setDesc('');
        setPrice('');
        setCategory('Electronics');
        setCondition('New');
        setLocation('');
        setIsPromotedOnSale(false);
        setPromotedAdRate(0.08);
      }, 2400);
    } catch (err: any) {
      Toast.show({ type: "error", text1: t("common.error"), text2: err.message || t("sell.errorMessage") });
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.successContainer}>
          <LinearGradient colors={["#D1FAE5", "#A7F3D0"]} style={styles.successIcon}>
            <CheckCircle color="#10B981" size={52} />
          </LinearGradient>
          <Text style={styles.successTitle}>Listed! 🎉</Text>
          <Text style={styles.successSub}>{t("sell.successMessage")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={{ flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          {step > 1 ? (
            <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ArrowLeft size={22} color="#1E293B" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} />
          )}
          <Text style={styles.headerTitle}>{t("sell.screenTitle")}</Text>
          <Text style={styles.stepLabel}>{step} / 3</Text>
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["2%", "100%"],
                }),
              },
            ]}
          />
        </View>

      {/* ── Step pills ── */}
      <View style={styles.stepsRow}>
        {STEPS.map(s => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <View key={s.id} style={styles.stepPill}>
              <View style={[styles.stepCircle, (active || done) && styles.stepCircleActive]}>
                {done
                  ? <CheckCircle size={14} color="white" />
                  : <Icon size={14} color={active ? "white" : "#94A3B8"} />}
              </View>
              <Text style={[styles.stepText, active && styles.stepTextActive]}>{s.label}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Seller Tier Status Ribbon ── */}
      <TouchableOpacity
        style={styles.sellerTierRibbon}
        onPress={() => router.push('/seller-verification' as any)}
        activeOpacity={0.85}
      >
        <ShieldCheck size={16} color="#2563EB" />
        <Text style={styles.sellerTierRibbonText}>
          Tier 2 Verified: <Text style={{ fontWeight: '800', color: '#1E40AF' }}>50 Listings Quota (4% Fee)</Text>
        </Text>
        <Text style={styles.sellerTierRibbonCta}>Upgrade →</Text>
      </TouchableOpacity>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ════ STEP 1 — PHOTOS ════ */}
        {step === 1 && (
          <View>
            <Text style={styles.stepHeading}>Add your photos</Text>
            <Text style={styles.stepSub}>Great photos help your item sell faster. Add up to 6.</Text>

            {/* Photo grid */}
            <View style={styles.photoGrid}>
              {/* Add button */}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickImage} activeOpacity={0.8}>
                <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={styles.addPhotoBtnInner}>
                  <ImagePlus color="#6366F1" size={28} />
                  <Text style={styles.addPhotoLabel}>
                    {images.length === 0 ? "Add photos" : `Add more (${images.length}/6)`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Preview thumbnails */}
              {images.map((img, idx) => (
                <View key={idx} style={styles.thumbWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.thumb} />
                  {idx === 0 && (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>COVER</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeThumb} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeImage(idx)}>
                    <X size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {images.length === 0 && (
              <View style={styles.photoTip}>
                <Text style={styles.photoTipText}>💡 Tip: Use natural light and a clean background for the best results.</Text>
              </View>
            )}
          </View>
        )}

        {/* ════ STEP 2 — DETAILS ════ */}
        {step === 2 && (
          <View>
            <Text style={styles.stepHeading}>Item details</Text>
            <Text style={styles.stepSub}>Tell buyers exactly what you're selling.</Text>

            {/* Title */}
            <FormField icon={<Tag color="#6366F1" size={18} />} label={t("sell.productTitle")}>
              <TextInput
                style={styles.input}
                placeholder={t("sell.titlePlaceholder")}
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                returnKeyType="next"
              />
              <Text style={styles.charCount}>{title.length}/80</Text>
            </FormField>

            {/* Description */}
            <FormField icon={<FileText color="#6366F1" size={18} />} label={t("sell.productDescription")}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t("sell.descriptionPlaceholder")}
                placeholderTextColor="#94A3B8"
                value={desc}
                onChangeText={setDesc}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{desc.length}/500</Text>
            </FormField>

            {/* Category */}
            <Text style={styles.fieldLabel}>
              <Text style={styles.fieldLabelIcon}>🗂️ </Text>
              {t("sell.productCategory")}
            </Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.catChip, category === cat.value && styles.catChipActive]}
                  onPress={() => setCategory(cat.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, category === cat.value && styles.catLabelActive]}>
                    {t(cat.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location / Governorate */}
            <FormField icon={<MapPin color="#6366F1" size={18} />} label={t("sell.productLocation")}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.govRow}
              >
                {EGYPTIAN_GOVERNORATES.map(gov => (
                  <TouchableOpacity
                    key={gov}
                    style={[styles.govChip, location === gov && styles.govChipActive]}
                    onPress={() => setLocation(prev => prev === gov ? '' : gov)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.govChipText, location === gov && styles.govChipTextActive]}>
                      {gov}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </FormField>
          </View>
        )}

        {/* ════ STEP 3 — PRICING ════ */}
        {step === 3 && (
          <View>
            <Text style={styles.stepHeading}>Set your price</Text>
            <Text style={styles.stepSub}>Choose a competitive price to attract buyers quickly.</Text>

            {/* Price input */}
            <View style={styles.priceInputWrapper}>
              <View style={styles.priceIconBox}>
                <Text style={styles.priceIconText}>EGP</Text>
              </View>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Live EGP formatted badge */}
            {parseFloat(price) > 0 && (
              <View style={styles.livePriceTag}>
                <Text style={styles.livePriceLabel}>Buyer sees:</Text>
                <Text style={styles.livePriceValue}>
                  EGP {Math.round(parseFloat(price)).toLocaleString('en-EG')}
                </Text>
              </View>
            )}

            {/* Available Stock Quantity */}
            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
              <Text style={styles.fieldLabelIcon}>📦 </Text>
              Available Stock (Units)
            </Text>
            <View style={[styles.priceInputWrapper, { height: 48, marginTop: 6 }]}>
              <TextInput
                style={[styles.priceInput, { fontSize: 16, textAlign: 'left', paddingLeft: 16 }]}
                placeholder="1"
                placeholderTextColor="#CBD5E1"
                value={stock}
                onChangeText={setStock}
                keyboardType="number-pad"
              />
            </View>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4, marginHorizontal: 4 }}>
              When the last item sells, this listing is automatically removed from the market.
            </Text>

            {/* Condition */}
            <Text style={[styles.fieldLabel, { marginTop: 24 }]}>
              <Text style={styles.fieldLabelIcon}>✅ </Text>
              {t("sell.productCondition")}
            </Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.conditionCard, condition === c.value && { borderColor: c.color, borderWidth: 2.5 }]}
                  onPress={() => setCondition(c.value)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.conditionIconBg, { backgroundColor: c.bg }]}>
                    <Text style={{ fontSize: 22 }}>{c.value === "New" ? "✨" : "♻️"}</Text>
                  </View>
                  <Text style={[styles.conditionLabel, condition === c.value && { color: c.color }]}>
                    {t(c.labelKey)}
                  </Text>
                  <Text style={styles.conditionDesc}>{c.desc}</Text>
                  {condition === c.value && (
                    <View style={[styles.conditionCheckmark, { backgroundColor: c.color }]}>
                      <CheckCircle size={14} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* ════════ EBAY SELL FASTER TOGGLE (0 EGP UPFRONT) ════════ */}
            <View style={styles.sellFasterCard}>
              <View style={styles.sellFasterTop}>
                <View style={styles.sellFasterIconBox}>
                  <Sparkles color="#2563EB" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellFasterTitle}>Promote to Sell 50% Faster ⚡</Text>
                  <Text style={styles.sellFasterSub}>0 EGP Upfront • Pay only if item sells</Text>
                </View>
                <TouchableOpacity
                  style={[styles.togglePill, isPromotedOnSale && styles.togglePillActive]}
                  hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
                  onPress={() => setIsPromotedOnSale(!isPromotedOnSale)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.toggleCircle, isPromotedOnSale && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>

              {isPromotedOnSale && (
                <View style={styles.adRateSelectorWrap}>
                  <Text style={styles.adRatePrompt}>Select your Ad Rate (Deducted upon sale):</Text>
                  <View style={styles.adRatePillsRow}>
                    {[
                      { rate: 0.05, label: '5%', desc: 'Standard (2x views)' },
                      { rate: 0.08, label: '8%', desc: 'Suggested (3x views)' },
                      { rate: 0.12, label: '12%', desc: 'Turbo (5x views)' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.rate}
                        style={[styles.adRateChip, promotedAdRate === item.rate && styles.adRateChipActive]}
                        onPress={() => setPromotedAdRate(item.rate)}
                      >
                        <Text style={[styles.adRateChipLabel, promotedAdRate === item.rate && styles.adRateChipLabelActive]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.adRateChipDesc, promotedAdRate === item.rate && styles.adRateChipDescActive]}>
                          {item.desc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {parseFloat(price) > 0 && (
                    <View style={styles.adRateCalcBox}>
                      <Text style={styles.adRateCalcText}>
                        If sold for EGP {Math.round(parseFloat(price)).toLocaleString()}, ad fee is{' '}
                        <Text style={{ fontWeight: '800', color: '#2563EB' }}>
                          EGP {Math.round(parseFloat(price) * promotedAdRate).toLocaleString()}
                        </Text>{' '}
                        (deducted only after delivery).
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Listing summary card */}
            {(title || price) && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>LISTING PREVIEW</Text>
                <View style={styles.summaryRow}>
                  {images[0] && (
                    <Image source={{ uri: images[0].uri }} style={styles.summaryThumb} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryItemTitle} numberOfLines={2}>{title || "—"}</Text>
                    <Text style={styles.summaryItemPrice}>
                      {price ? `EGP ${Math.round(parseFloat(price || '0')).toLocaleString('en-EG')}` : "—"}
                    </Text>
                    <View style={styles.summaryTags}>
                      <View style={styles.summaryTag}><Text style={styles.summaryTagText}>{category}</Text></View>
                      <View style={[styles.summaryTag, { backgroundColor: condition === "New" ? "#D1FAE5" : "#FEF3C7" }]}>
                        <Text style={[styles.summaryTagText, { color: condition === "New" ? "#065F46" : "#92400E" }]}>{condition}</Text>
                      </View>
                      {location ? (
                        <View style={[styles.summaryTag, { backgroundColor: '#F0FDF4' }]}>
                          <Text style={[styles.summaryTagText, { color: '#166534' }]}>📍 {location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Spacer so CTA is never behind content */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={styles.bottomBar}>
        {step < 3 ? (
          <TouchableOpacity
            style={[styles.ctaButton, !canAdvance() && styles.ctaButtonDisabled]}
            onPress={goNext}
            disabled={!canAdvance()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canAdvance() ? ["#4F46E5", "#7C3AED"] : ["#E2E8F0", "#E2E8F0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={[styles.ctaText, !canAdvance() && styles.ctaTextDisabled]}>
                Continue
              </Text>
              <ArrowRight color={canAdvance() ? "white" : "#94A3B8"} size={20} />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: submitScale }], width: "100%" }}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#16A34A", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>{t("sell.listProduct")}</Text>
                    <CheckCircle color="white" size={20} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Form Field wrapper ───────────────────────────────────────────────────────

function FormField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formField}>
      <View style={styles.fieldLabelRow}>
        {icon}
        <Text style={styles.fieldLabelText}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const THUMB_SIZE = (SCREEN_WIDTH - 48 - 12) / 3; // 3-column grid

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },

  // Success
  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  successIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: { fontSize: 30, fontWeight: "800", color: "#1E293B", marginBottom: 10 },
  successSub: { fontSize: 16, color: "#64748B", textAlign: "center", lineHeight: 24 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  stepLabel: { fontSize: 14, fontWeight: "600", color: "#94A3B8" },

  // Progress
  progressTrack: {
    height: 5,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 20,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 4,
  },

  // Step pills
  stepsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    paddingVertical: 16,
  },
  stepPill: { alignItems: "center", gap: 5 },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: { backgroundColor: "#6366F1" },
  stepText: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  stepTextActive: { color: "#6366F1" },

  // Scroll content
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  // Seller Tier Ribbon
  sellerTierRibbon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  sellerTierRibbonText: { flex: 1, fontSize: 11, color: "#2563EB", fontWeight: "600" },
  sellerTierRibbonCta: { fontSize: 11, fontWeight: "800", color: "#2563EB" },

  // Step headings
  stepHeading: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  stepSub: { fontSize: 14, color: "#64748B", marginBottom: 24, lineHeight: 20 },

  // Photo grid
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  addPhotoBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#A5B4FC",
  },
  addPhotoBtnInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addPhotoLabel: { fontSize: 11, color: "#6366F1", fontWeight: "600", textAlign: "center" },
  thumbWrapper: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 16, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  coverBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#6366F1",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  coverBadgeText: { color: "white", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  removeThumb: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  photoTip: {
    marginTop: 20,
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  photoTipText: { fontSize: 13, color: "#92400E", lineHeight: 18 },

  // Form fields
  formField: { marginBottom: 20 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  fieldLabelText: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  fieldLabel: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  fieldLabelIcon: { fontSize: 16 },
  input: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E293B",
  },
  textArea: { height: 110, textAlignVertical: "top" },
  charCount: { fontSize: 11, color: "#94A3B8", textAlign: "right", marginTop: 4 },

  // Category grid
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catChip: {
    width: (SCREEN_WIDTH - 48 - 10) / 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catChipActive: { borderColor: "#6366F1", backgroundColor: "#EEF2FF" },
  catEmoji: { fontSize: 20 },
  catLabel: { fontSize: 14, fontWeight: "600", color: "#475569" },
  catLabelActive: { color: "#6366F1" },

  // Pricing
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#BFDBFE",
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  priceIconBox: {
    padding: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  priceIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  priceInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "800",
    color: "#1E293B",
    paddingRight: 20,
    letterSpacing: -0.5,
  },
  livePriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  livePriceLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  livePriceValue: { fontSize: 12, color: '#2563EB', fontWeight: '800' },

  // Condition cards
  conditionRow: { flexDirection: "row", gap: 12 },
  conditionCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  conditionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  conditionLabel: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  conditionDesc: { fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 15 },
  conditionCheckmark: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },

  // Sell Faster Promoted Listings
  sellFasterCard: {
    marginTop: 24,
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    padding: 16,
  },
  sellFasterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellFasterIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  sellFasterTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  sellFasterSub: { fontSize: 11, color: '#2563EB', fontWeight: '600', marginTop: 1 },
  togglePill: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#CBD5E1',
    padding: 3,
    justifyContent: 'center',
  },
  togglePillActive: { backgroundColor: '#0F172A' },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  toggleCircleActive: { alignSelf: 'flex-end' },
  adRateSelectorWrap: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#DBEAFE' },
  adRatePrompt: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  adRatePillsRow: { flexDirection: 'row', gap: 8 },
  adRateChip: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    alignItems: 'center',
  },
  adRateChipActive: { borderColor: '#2563EB', backgroundColor: '#DBEAFE' },
  adRateChipLabel: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  adRateChipLabelActive: { color: '#1D4ED8' },
  adRateChipDesc: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },
  adRateChipDescActive: { color: '#1E40AF', fontWeight: '600' },
  adRateCalcBox: {
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adRateCalcText: { fontSize: 11, color: '#475569', lineHeight: 16 },

  // Summary card
  summaryCard: {
    marginTop: 28,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryCardTitle: { fontSize: 12, fontWeight: "700", color: "#94A3B8", marginBottom: 14, letterSpacing: 0.8 },
  summaryRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  summaryThumb: { width: 70, height: 70, borderRadius: 12 },
  summaryItemTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 4, lineHeight: 20 },
  summaryItemPrice: { fontSize: 18, fontWeight: "800", color: "#2563EB", marginBottom: 8 },
  summaryTags: { flexDirection: "row", gap: 6, flexWrap: 'wrap' },
  summaryTag: { backgroundColor: "#EEF2FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  summaryTagText: { fontSize: 11, fontWeight: "700", color: "#6366F1" },

  // Governorate picker
  govRow: { gap: 8, paddingBottom: 4 },
  govChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  govChipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  govChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  govChipTextActive: { color: '#6366F1', fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  ctaButton: { width: "100%", borderRadius: 18, overflow: "hidden" },
  ctaGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 17,
  },
  ctaButtonDisabled: { opacity: 0.7 },
  ctaText: { fontSize: 17, fontWeight: "800", color: "white" },
  ctaTextDisabled: { color: "#94A3B8" },
});
