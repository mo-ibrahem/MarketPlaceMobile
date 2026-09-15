import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  Eye,
  FileText,
  ImagePlus,
  Info,
  MapPin,
  Plus as PlusIcon,
  Share2,
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
  Share,
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
import { SELLER_TIERS, getSellerTier, type SellerTierConfig } from "../../src/services/lib/walletService";
import { PAYMENTS_ENABLED } from "../../src/services/lib/platformCommerce";
import { supabase } from "../../src/services/lib/supabase";
import { imageUploadType } from '../../src/services/lib/imageUpload';

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
  { id: 4, label: "Review",  icon: CheckCircle },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SellScreen() {
  const { user } = useAuth();
  // Real tier -- this ribbon used to hardcode "Tier 2 Verified" for everyone.
  const [sellerTier, setSellerTier] = useState<SellerTierConfig>(SELLER_TIERS[1]);
  useEffect(() => {
    // Classifieds mode: there is no tier/fee/payout system right now, so
    // don't even fetch (see PLAN-CLASSIFIEDS-MODE.md).
    if (!PAYMENTS_ENABLED || !user) return;
    getSellerTier(user.id).then(setSellerTier).catch(() => {});
  }, [user]);
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
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [postedId,  setPostedId]  = useState<string | null>(null);

  // Progress animation
  const [progressAnim] = useState(() => new Animated.Value(0));
  // Submit button scale
  const [submitScale] = useState(() => new Animated.Value(1));

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
      setPostedId(null);
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
    const { contentType, extension } = imageUploadType(img);
    const path = `${user!.id}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, buf, { contentType });
    if (error) throw error;
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  // Validation per step
  const canAdvance = () => {
    if (step === 1) return images.length > 0;
    if (step === 2) return title.trim().length > 0;
    if (step === 3) return parseFloat(price) > 0;
    return true;
  };

  const goNext = () => { if (step < 4) setStep(s => s + 1); };
  const goBack = () => { if (step > 1) setStep(s => s - 1); };

  const resetForm = () => {
    setDone(false);
    setPostedId(null);
    setStep(1);
    setImages([]);
    setTitle('');
    setDesc('');
    setPrice('');
    setCategory('Electronics');
    setCondition('New');
    setLocation('');
  };

  const [comparable, setComparable] = useState<{ min: number; max: number; count: number } | null>(null);
  useEffect(() => {
    if (step !== 3 || !category) return;
    productService.getComparablePriceRange(category).then(setComparable).catch(() => setComparable(null));
  }, [step, category]);

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
      const created = await productService.createProduct({
        title: title.trim(),
        description: fullDescription,
        price: parseFloat(price),
        category,
        condition,
        images: imageUrls,
      });
      // The success screen (8e) is a real destination the seller reads and
      // acts on -- share it, open it, list another -- not a toast that
      // auto-dismisses. It used to reset the whole form and drop the
      // screen after 2.4s, before anyone could tap "View your listing".
      setPostedId(created.id);
      setDone(true);
    } catch (err: any) {
      Toast.show({ type: "error", text1: t("common.error"), text2: err.message || t("sell.errorMessage") });
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    const shareUrl = postedId ? `https://www.egbay.shop/products/${postedId}` : '';
    const shareText = `${title} — EGP ${Math.round(parseFloat(price || '0')).toLocaleString('en-EG')}\n${shareUrl}`;
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.postedScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.postedCheck}>
            <CheckCircle color="#059669" size={28} />
          </View>
          <Text style={styles.postedTitle}>
            {location ? `It is live in ${location}` : 'It is live'}
          </Text>
          <Text style={styles.postedSub}>
            Buyers can see it now. Their questions land in Chats — the faster you answer, the higher your listing ranks.
          </Text>

          <View style={styles.postedRow}>
            {images[0] && <Image source={{ uri: images[0].uri }} style={styles.postedThumb} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.postedItemTitle} numberOfLines={1}>{title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text style={styles.postedLive}>LIVE</Text>
                <Text style={{ color: '#CBD5E1' }}>·</Text>
                <Text style={styles.postedJustNow}>just now</Text>
              </View>
            </View>
            <Text style={styles.postedPrice}>
              {price ? Math.round(parseFloat(price)).toLocaleString('en-EG') : ''}
            </Text>
          </View>

          <Text style={styles.postedSectionLabel}>GET IT SEEN</Text>
          <TouchableOpacity
            style={styles.postedActionRow}
            onPress={() => {
              const encoded = encodeURIComponent(shareText);
              Linking.openURL(`https://wa.me/?text=${encoded}`).catch(() => {
                Share.share({ message: shareText });
              });
            }}
          >
            <View style={styles.postedActionLeft}>
              <Share2 size={18} color="#0F172A" />
              <Text style={styles.postedActionText}>Share on WhatsApp</Text>
            </View>
            <ArrowRight color="#CBD5E1" size={16} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postedActionRow}
            disabled={!postedId}
            onPress={() => postedId && router.push(`/products/${postedId}` as any)}
          >
            <View style={styles.postedActionLeft}>
              <Eye size={18} color="#0F172A" />
              <Text style={styles.postedActionText}>View your listing</Text>
            </View>
            <ArrowRight color="#CBD5E1" size={16} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.postedActionRow, { borderBottomWidth: 0 }]} onPress={resetForm}>
            <View style={styles.postedActionLeft}>
              <PlusIcon size={18} color="#0F172A" strokeWidth={2.4} />
              <Text style={styles.postedActionText}>Sell another item</Text>
            </View>
            <ArrowRight color="#CBD5E1" size={16} />
          </TouchableOpacity>
        </ScrollView>
        <View style={styles.postedBottomBar}>
          <TouchableOpacity
            style={[styles.ctaButton, styles.ctaFlat]}
            onPress={() => { resetForm(); router.push('/(tabs)' as any); }}
          >
            <Text style={styles.ctaText}>Back to home</Text>
          </TouchableOpacity>
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
          <Text style={styles.stepLabel}>{step} / 4</Text>
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

      {/* ── Seller Tier Status Ribbon ──
          Hidden while PAYMENTS_ENABLED is false: there is no tier, fee or
          payout system right now (see PLAN-CLASSIFIEDS-MODE.md). */}
      {PAYMENTS_ENABLED && (
        <TouchableOpacity
          style={styles.sellerTierRibbon}
          onPress={() => router.push('/seller-verification' as any)}
          activeOpacity={0.85}
        >
          <ShieldCheck size={16} color="#2563EB" />
          <Text style={styles.sellerTierRibbonText}>
            {sellerTier.name}: <Text style={{ fontWeight: '800', color: '#1E40AF' }}>{sellerTier.listingLimitCount >= 999999 ? "Unlimited" : sellerTier.listingLimitCount} listings · {(sellerTier.commissionFeePercent * 100).toFixed(1)}% fee</Text>
          </Text>
          <Text style={styles.sellerTierRibbonCta}>Payout setup →</Text>
        </TouchableOpacity>
      )}

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

            {/* Photo grid -- filled thumbnails first (cover badge on the
                first, remove on each), the dashed add-tile last with a real
                count. Used to be one big indigo-gradient "Add photos" tile
                first and thumbnails trailing it; the approved build's grid
                reads left-to-right in posting order, cover first. */}
            <View style={styles.photoGrid}>
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

              {images.length < 6 && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickImage} activeOpacity={0.8}>
                  <View style={styles.addPhotoIconCircle}>
                    <ImagePlus color="#0F172A" size={22} />
                  </View>
                  <Text style={styles.addPhotoLabel}>Add photo</Text>
                  <Text style={styles.addPhotoCount}>{images.length} OF 6</Text>
                </TouchableOpacity>
              )}
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
            <Text style={styles.stepSub}>Tell buyers exactly what you&apos;re selling.</Text>

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

            {/* The "Promote to sell 50% faster" toggle was removed. It set
                is_promoted on insert (the only legitimate path is purchase_boost)
                and quoted an ad fee and view multipliers nothing in the backend
                reads or charges. Boosts live at /boost/[productId]. */}

            {/* "Priced to sell": the real range of other active listings in
                this category right now -- never a range of sold prices this
                app does not reliably track (see getComparablePriceRange). */}
            {!!comparable && (
              <View style={styles.comparableBox}>
                <View style={styles.comparableDotRow}>
                  <View style={styles.comparableDot} />
                  <Text style={styles.comparableDotLabel}>Priced to sell</Text>
                </View>
                <Text style={styles.comparableText}>
                  {comparable.count} similar {category} listings are currently priced between{' '}
                  <Text style={{ fontWeight: '800', color: '#0F172A' }}>EGP {comparable.min.toLocaleString('en-EG')}</Text>
                  {' '}and{' '}
                  <Text style={{ fontWeight: '800', color: '#0F172A' }}>EGP {comparable.max.toLocaleString('en-EG')}</Text>.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ════ STEP 4 — REVIEW ════ */}
        {step === 4 && (
          <View>
            <Text style={styles.stepHeading}>This is what buyers see</Text>
            <Text style={styles.stepSub}>Check it over, then post.</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>IN THE FEED</Text>
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

            <View style={styles.reviewRows}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>CATEGORY</Text>
                <Text style={styles.reviewRowValue}>{category}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>CONDITION</Text>
                <Text style={styles.reviewRowValue}>{condition}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>PHOTOS</Text>
                <Text style={styles.reviewRowValue}>{images.length}</Text>
              </View>
              <View style={[styles.reviewRow, styles.reviewRowLast]}>
                <Text style={styles.reviewRowLabel}>QUANTITY</Text>
                <Text style={styles.reviewRowValue}>{stock || '1'}</Text>
              </View>
            </View>

            <View style={styles.confirmRow}>
              <Info size={14} color="#94A3B8" style={{ marginTop: 2 }} />
              <Text style={styles.confirmText}>
                By posting you confirm the item is yours to sell and allowed on Egbay.
              </Text>
            </View>
          </View>
        )}

        {/* Spacer so CTA is never behind content */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={styles.bottomBar}>
        {step < 4 ? (
          <TouchableOpacity
            style={[styles.ctaButton, styles.ctaFlat, !canAdvance() && styles.ctaButtonDisabled]}
            onPress={goNext}
            disabled={!canAdvance()}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, !canAdvance() && styles.ctaTextDisabled]}>
              Continue
            </Text>
            <ArrowRight color={canAdvance() ? "white" : "#94A3B8"} size={20} />
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: submitScale }], width: "100%" }}>
            <TouchableOpacity
              style={[styles.ctaButton, styles.ctaFlat]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.ctaText}>{t("sell.listProduct")}</Text>
              )}
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

  // Success / posted (8e)
  postedScroll: { padding: 20, paddingTop: 100, paddingBottom: 40 },
  postedCheck: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  postedTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -1.5, color: "#0F172A", lineHeight: 38, marginTop: 20 },
  postedSub: { fontSize: 15, color: "#64748B", lineHeight: 22, marginTop: 8 },
  postedRow: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 26,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#E2E8F0", borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  postedThumb: { width: 60, height: 60, borderRadius: 10 },
  postedItemTitle: { fontSize: 14, fontWeight: "600", color: "#0F172A", lineHeight: 19 },
  postedLive: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#059669" },
  postedJustNow: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  postedPrice: { fontSize: 17, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  postedSectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: "#94A3B8", marginTop: 26, marginBottom: 12 },
  postedActionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  postedActionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  postedActionText: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  postedBottomBar: { borderTopWidth: 1, borderTopColor: "#E2E8F0", padding: 20, paddingTop: 12 },

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
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  addPhotoIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  addPhotoLabel: { fontSize: 13, color: "#0F172A", fontWeight: "700", textAlign: "center" },
  addPhotoCount: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#94A3B8" },
  thumbWrapper: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 16, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  coverBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#0F172A",
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
    // Same breathing room below the grid as every FormField has, so the
    // Location heading does not sit on the last row of category cards.
    marginBottom: 20,
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
  // Approved build: no gradients -- the Continue and Post pills used
  // #4F46E5->#7C3AED and #16A34A->#059669; both are flat ink now, the same
  // action colour as every other pill in the app.
  ctaFlat: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 17,
    backgroundColor: "#0F172A",
  },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 17, fontWeight: "800", color: "white" },
  ctaTextDisabled: { color: "#94A3B8" },

  comparableBox: { marginTop: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14 },
  comparableDotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  comparableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  comparableDotLabel: { fontSize: 13, fontWeight: "800", color: "#059669" },
  comparableText: { fontSize: 13, color: "#475569", lineHeight: 19, marginTop: 6 },

  reviewRows: { marginTop: 22 },
  reviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  reviewRowLast: { borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  reviewRowLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "#94A3B8" },
  reviewRowValue: { fontSize: 14, fontWeight: "700", color: "#0F172A" },

  confirmRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 18 },
  confirmText: { fontSize: 12.5, color: "#94A3B8", fontWeight: "600", lineHeight: 18, flex: 1 },
});
