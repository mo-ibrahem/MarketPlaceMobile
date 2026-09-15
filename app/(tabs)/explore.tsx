import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Camera,
  ChevronRight,
  Edit3,
  Eye,
  FileEdit,
  Heart,
  Package,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { getSellerReplyBadge } from '../../src/services/lib/reputationStats';
import {
  SELLER_TIERS,
  getSellerTier,
  getUserWallet,
  type SellerTierConfig,
  type UserWallet,
} from '../../src/services/lib/walletService';
import {
  productService,
  profileService,
  type Product,
  type UserProfile,
} from '../../src/services/lib/products';
import { auth, supabase } from '../../src/services/lib/supabase';
import { imageUploadType } from '../../src/services/lib/imageUpload';
import { deleteMyAccount, isBackendMissing, SAFETY_EMAIL } from '../../src/services/lib/moderationService';
import { PAYMENTS_ENABLED } from '../../src/services/lib/platformCommerce';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'products', label: 'Listings', icon: Package  },
  { id: 'wishlist', label: 'Saved',    icon: Heart    },
  { id: 'drafts',   label: 'Drafts',   icon: FileEdit },
  { id: 'settings', label: 'Settings', icon: User     },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();
  const isRTL = language === 'ar';

  const [profile,          setProfile]          = useState<UserProfile | null>(null);
  const [userProducts,     setUserProducts]     = useState<Product[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [draftProducts,    setDraftProducts]    = useState<Product[]>([]);
  const [replyBadge,       setReplyBadge]       = useState<string | null>(null);
  const [soldCount,        setSoldCount]        = useState(0);
  const [isLoading,        setIsLoading]        = useState(true);
  const [activeTab,        setActiveTab]        = useState<TabId>('products');
  const [wallet,           setWallet]           = useState<UserWallet | null>(null);
  const [sellerTier,       setSellerTier]       = useState<SellerTierConfig>(SELLER_TIERS[1]);
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);

  const [editProfileData, setEditProfileData] = useState({ full_name: '', phone: '' });
  const [passwordData,    setPasswordData]    = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword,    setShowPassword]    = useState(false);

  // ── Permissions ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      // Classifieds mode: there is no wallet, tier or completed-sale count
      // right now, so don't even fetch them (see PLAN-CLASSIFIEDS-MODE.md).
      const [profileData, products, wishlist, drafts, sold, userWallet, tier] = await Promise.all([
        profileService.getProfile(user.id),
        productService.getProductsBySeller(user.id),
        productService.getWishlist(),
        productService.getMyDrafts(),
        PAYMENTS_ENABLED ? productService.getSoldCountBySeller(user.id) : Promise.resolve(0),
        PAYMENTS_ENABLED ? getUserWallet(user.id).catch(() => null) : Promise.resolve(null),
        PAYMENTS_ENABLED ? getSellerTier(user.id) : Promise.resolve(SELLER_TIERS[1]),
      ]);
      setProfile(profileData);
      setUserProducts(products);
      setWishlistProducts(wishlist);
      setDraftProducts(drafts);
      setSoldCount(sold);
      setWallet(userWallet);
      getSellerReplyBadge(user.id).then(setReplyBadge).catch(() => {});
      setSellerTier(tier);
      // The badge tracks is_verified_seller, not the tier number -- the two can
      // disagree, and only the flag means a human checked an ID.
      setIsVerifiedSeller(!!(profileData as any)?.is_verified_seller);
      setEditProfileData({
        full_name: profileData?.full_name || '',
        phone:     profileData?.phone     || '',
      });
    } catch (e) {
      console.error('Profile: load failed', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load your profile.' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => { if (user) loadUserData(); }, [user, loadUserData])
  );

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleAvatarUpload = async () => {
    const { granted } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!granted) {
      Toast.show({ type: 'info', text1: 'Permission Required', text2: 'Enable photo access in Settings.', visibilityTime: 5000 });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.6,
    });
    if (!result.canceled && user) {
      const img = result.assets[0];
      setIsLoading(true);
      try {
        const buf     = await fetch(img.uri).then(r => r.arrayBuffer());
        const { contentType, extension } = imageUploadType(img);
        const path    = `${user.id}/${Date.now()}.${extension}`;
        const { error } = await supabase.storage.from('avatars').upload(path, buf, { contentType });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        await profileService.updateProfile(user.id, { avatar_url: publicUrl });
        await loadUserData();
        Toast.show({ type: 'success', text1: 'Avatar updated!' });
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: e.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await profileService.updateProfile(user.id, {
        full_name: editProfileData.full_name,
        phone:     editProfileData.phone,
      });
      await loadUserData();
      Toast.show({ type: 'success', text1: 'Profile saved!' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update profile.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Toast.show({ type: 'error', text1: 'Passwords don\'t match' }); return;
    }
    if (passwordData.newPassword.length < 6) {
      Toast.show({ type: 'error', text1: 'Password too short', text2: 'Minimum 6 characters.' }); return;
    }
    setIsLoading(true);
    const { error } = await auth.supabase.auth.updateUser({ password: passwordData.newPassword });
    if (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Password updated!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    }
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        await auth.signOut();
        router.replace('/login');
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await auth.signOut(); router.replace('/login'); } },
    ]);
  };

  const handleDeleteProduct = async (productId: string) => {
    const doDelete = async () => {
      try {
        const outcome = await productService.deleteProduct(productId);
        Toast.show(
          outcome === 'deleted'
            ? { type: 'success', text1: 'Listing deleted.' }
            : { type: 'success', text1: 'Listing withdrawn.', text2: 'It has orders, so it was hidden rather than deleted.' },
        );
        loadUserData();
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Failed to delete listing.', text2: err?.message });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('This action cannot be undone. Delete listing?')) {
        await doDelete();
      }
      return;
    }

    Alert.alert('Delete Listing', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: doDelete,
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    // Guideline 5.1.1(v): deletion must be real and in-app. The RPC either
    // removes the account or throws; nothing is claimed on a thrown error.
    const doDelete = async () => {
      let result: { status: 'complete' | 'pending'; receipt?: string };
      try {
        result = await deleteMyAccount();
      } catch (err: any) {
        const msg = isBackendMissing(err)
          ? `In-app deletion is temporarily unavailable. Please try again or contact ${SAFETY_EMAIL}.`
          : (err?.message || 'Failed to delete account');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Account not deleted', msg);
        return;
      }
      await auth.signOut();
      Toast.show({ type: 'success',
        text1: result.status === 'complete' ? 'Account deleted' : 'Deletion requested',
        text2: result.status === 'complete' ? 'Your account and uploaded content have been removed.' : 'Access is disabled. You can check cleanup progress on the next screen.',
      });
      router.replace(result.receipt ? { pathname: '/account-deletion', params: { receipt: result.receipt } } : '/login');
    };

    const body =
      'This permanently deletes your account, listings, uploaded images and the messages you sent. You lose access immediately. ' +
      'Transaction records remain without your account identity; other people keep their own messages. Cleanup may continue automatically if a service is temporarily unavailable. This cannot be undone.';

    if (Platform.OS === 'web') {
      if (window.confirm(body)) await doDelete();
      return;
    }

    Alert.alert('Delete Account • حذف الحساب', body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Permanently', style: 'destructive', onPress: doDelete },
    ]);
  };

  // ── Loading / guard ──────────────────────────────────────────────────────────

  if (authLoading || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Profile…</Text>
      </View>
    );
  }
  if (!user) return null;

  // ── Sub-renders ──────────────────────────────────────────────────────────────

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';
  const initials    = displayName.slice(0, 2).toUpperCase();
  // "JOINED MAR 2025" -- from the profile row's own created_at, not invented.
  const joinedLabel = profile?.created_at
    ? `${isRTL ? 'انضم' : 'Joined'} ${new Date(profile.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' })}`
    : '';
  // The stat cell wants a number, not the sentence the badge renders:
  // "Replies in about 10 min" -> "10 min". Blank when there is no real
  // history behind it, never a placeholder figure.
  const replyTimeValue = replyBadge ? replyBadge.replace(/^.*?about\s*/i, '') : null;

  /**
   * Listing rows (approved build 3d): thumbnail, title, real status line,
   * price on the right, hairline between rows. This was a two-column grid
   * of cards with a floating price pill and hovering action buttons.
   */
  const renderProductList = (products: Product[], emptyMsg: string) => {
    return products.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{emptyMsg}</Text>
        {activeTab === 'products' && (
          <TouchableOpacity style={styles.emptyAction} onPress={() => router.push('/(tabs)/sell' as any)}>
            <Text style={styles.emptyActionText}>{isRTL ? 'أضف أول إعلان ←' : 'List your first item →'}</Text>
          </TouchableOpacity>
        )}
      </View>
    ) : (
      <View>
        {products.map(product => {
          const isSold = product.status === 'sold';
          const isDraft = product.status === 'draft';
          return (
            <TouchableOpacity
              key={product.id}
              style={[styles.listingRow, isSold && styles.listingRowMuted]}
              onPress={() => router.push(`/products/${product.id}`)}
              onLongPress={activeTab === 'products' ? () => handleDeleteProduct(product.id) : undefined}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: product.images?.[0] || 'https://placehold.co/300x300/F1F5F9/64748B?text=Item' }}
                style={styles.listingThumb}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.listingTitle} numberOfLines={1}>{product.title}</Text>
                <View style={styles.listingMetaRow}>
                  <Text style={[styles.listingStatus, isSold && styles.listingStatusMuted, isDraft && styles.listingStatusDraft]}>
                    {isSold ? 'SOLD' : isDraft ? 'DRAFT' : 'LIVE'}
                  </Text>
                  {!isSold && !isDraft && (
                    <>
                      <Text style={styles.listingDot}>·</Text>
                      <Text style={styles.listingMeta}>
                        {isRTL ? `${product.view_count ?? 0} مشاهدة` : `${product.view_count ?? 0} views`}
                      </Text>
                    </>
                  )}
                </View>
              </View>
              <Text style={styles.listingPrice}>{Math.round(product.price).toLocaleString('en-EG')}</Text>
              {activeTab === 'products' && (
                <TouchableOpacity
                  onPress={e => { e.stopPropagation(); router.push(`/products/edit/${product.id}`); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.listingEdit}
                >
                  <Edit3 size={15} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  /**
   * Settings tab -- approved build 9a.
   *
   * Sections are mono kickers on the page, fields are underlines, and the
   * routes that used to hide behind decorated cards (wallet, payouts,
   * verification, notifications, legal) are now plain rows that state what
   * they hold. The design annotates each row with its path; those are notes
   * for me, not copy for the user, so they are wired as navigation rather
   * than printed on screen.
   */
  const settingsRow = (
    label: string,
    value: string,
    onPress: () => void,
    key: string,
  ) => (
    <TouchableOpacity key={key} style={styles.setRow} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.setRowLabel}>{label}</Text>
      <View style={styles.setRowRight}>
        <Text style={styles.setRowValue} numberOfLines={1}>{value}</Text>
        <ChevronRight size={16} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );

  const renderSettings = () => (
    <View>
      {/* ── Edit profile ── */}
      <Text style={styles.setKicker}>{isRTL ? 'تعديل الملف' : 'EDIT PROFILE'}</Text>

      <TouchableOpacity style={styles.setAvatarRow} onPress={handleAvatarUpload} activeOpacity={0.8}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.setAvatar} />
        ) : (
          <View style={[styles.setAvatar, styles.setAvatarFallback]}>
            <Text style={styles.setAvatarInitials}>{initials}</Text>
          </View>
        )}
        <Text style={styles.setAvatarHint}>{isRTL ? 'غيّر صورتك' : 'Change your photo'}</Text>
      </TouchableOpacity>

      <View style={styles.setField}>
        <Text style={styles.setFieldLabel}>{isRTL ? 'الاسم' : 'FULL NAME'}</Text>
        <TextInput
          style={[styles.setInput, !!editProfileData.full_name && styles.setInputFilled]}
          placeholder={isRTL ? 'اسمك' : 'Your full name'}
          placeholderTextColor="#94A3B8"
          value={editProfileData.full_name}
          onChangeText={text => setEditProfileData(d => ({ ...d, full_name: text }))}
          returnKeyType="next"
        />
      </View>

      <View style={styles.setField}>
        <Text style={styles.setFieldLabel}>{isRTL ? 'رقم الهاتف' : 'PHONE NUMBER'}</Text>
        <TextInput
          style={[styles.setInput, !!editProfileData.phone && styles.setInputFilled]}
          placeholder={isRTL ? 'رقم هاتفك' : 'Your phone number'}
          placeholderTextColor="#94A3B8"
          value={editProfileData.phone}
          onChangeText={text => setEditProfileData(d => ({ ...d, phone: text }))}
          keyboardType="phone-pad"
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity style={styles.setPrimaryBtn} onPress={handleSaveChanges} disabled={isLoading}>
        <Text style={styles.setPrimaryBtnText}>{isRTL ? 'حفظ التغييرات' : 'Save changes'}</Text>
      </TouchableOpacity>

      {/* ── Change password ── */}
      <Text style={[styles.setKicker, { marginTop: 30 }]}>{isRTL ? 'تغيير كلمة المرور' : 'CHANGE PASSWORD'}</Text>

      <View style={styles.setField}>
        <Text style={styles.setFieldLabel}>{isRTL ? 'كلمة مرور جديدة' : 'NEW PASSWORD'}</Text>
        <View style={styles.setPasswordRow}>
          <TextInput
            style={[styles.setInput, { flex: 1 }, !!passwordData.newPassword && styles.setInputFilled]}
            placeholder={isRTL ? 'كلمة مرور جديدة' : 'New password'}
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={passwordData.newPassword}
            onChangeText={text => setPasswordData(d => ({ ...d, newPassword: text }))}
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={10} style={styles.setEyeBtn}>
            <Eye size={18} color={showPassword ? '#0F172A' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.setField}>
        <Text style={styles.setFieldLabel}>{isRTL ? 'تأكيد كلمة المرور' : 'CONFIRM PASSWORD'}</Text>
        <TextInput
          style={[styles.setInput, !!passwordData.confirmPassword && styles.setInputFilled]}
          placeholder={isRTL ? 'أعد كتابة كلمة المرور' : 'Confirm new password'}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showPassword}
          value={passwordData.confirmPassword}
          onChangeText={text => setPasswordData(d => ({ ...d, confirmPassword: text }))}
        />
      </View>

      <TouchableOpacity style={styles.setGhostBtn} onPress={handleChangePassword}>
        <Text style={styles.setGhostBtnText}>{isRTL ? 'تحديث كلمة المرور' : 'Update password'}</Text>
      </TouchableOpacity>
      <Text style={styles.setNote}>
        {isRTL ? 'نسيتها؟ ' : 'Forgot it instead? '}
        <Text style={styles.setLink} onPress={() => router.push('/forgot-password' as any)}>
          {isRTL ? 'أعد التعيين بالبريد' : 'Reset by email'}
        </Text>
      </Text>

      {/* ── Language ── */}
      <Text style={[styles.setKicker, { marginTop: 30, marginBottom: 12 }]}>{isRTL ? 'اللغة' : 'LANGUAGE'}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langPill, language === 'en' && styles.langPillActive]}
          onPress={() => changeLanguage('en')}
        >
          <Text style={[styles.langLabel, language === 'en' && styles.langLabelActive]}>{t('language.english')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langPill, language === 'ar' && styles.langPillActive]}
          onPress={() => changeLanguage('ar')}
        >
          <Text style={[styles.langLabel, language === 'ar' && styles.langLabelActive]}>{t('language.arabic')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.setNote}>
        {isRTL ? 'التبديل إلى English يحوّل التطبيق إلى اتجاه LTR.' : 'Switching to العربية flips the whole app to RTL.'}
      </Text>

      {/* ── Selling ──
          Wallet, payouts and verification only exist with payments on
          (PLAN-CLASSIFIEDS-MODE.md); notifications always do. */}
      <Text style={[styles.setKicker, { marginTop: 30, marginBottom: 4 }]}>{isRTL ? 'البيع' : 'SELLING'}</Text>
      {PAYMENTS_ENABLED && settingsRow(
        isRTL ? 'توثيق البائع' : 'SELLER VERIFICATION',
        isVerifiedSeller ? (isRTL ? 'موثّق' : 'Verified') : (isRTL ? 'غير موثّق' : 'Not verified'),
        () => router.push('/seller-verification' as any),
        'verification',
      )}
      {PAYMENTS_ENABLED && settingsRow(
        isRTL ? 'المحفظة' : 'WALLET',
        `EGP ${Number(wallet?.available_balance ?? 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        () => router.push('/wallet' as any),
        'wallet',
      )}
      {PAYMENTS_ENABLED && settingsRow(
        isRTL ? 'بيانات التحويل' : 'PAYOUT DETAILS',
        isRTL ? 'غير محددة' : 'Not set',
        () => router.push('/payout-settings' as any),
        'payouts',
      )}
      {settingsRow(
        isRTL ? 'الإشعارات' : 'NOTIFICATIONS',
        isRTL ? 'مفعّلة' : 'On',
        () => router.push('/notifications' as any),
        'notifications',
      )}

      {/* ── Legal & safety ── */}
      <Text style={[styles.setKicker, { marginTop: 30, marginBottom: 4 }]}>{isRTL ? 'القانون والأمان' : 'LEGAL & SAFETY'}</Text>
      {settingsRow(
        isRTL ? 'نصائح الأمان' : 'SAFETY TIPS',
        isRTL ? 'البيع والشراء بأمان' : 'Buying & selling safely',
        () => router.push('/safety' as any),
        'safety',
      )}
      {settingsRow(
        isRTL ? 'سياسة الخصوصية' : 'PRIVACY POLICY',
        isRTL ? 'اقرأ' : 'Read',
        () => router.push('/privacy' as any),
        'privacy',
      )}
      {settingsRow(
        isRTL ? 'الشروط' : 'TERMS OF USE',
        isRTL ? 'اقرأ' : 'Read',
        () => router.push('/terms' as any),
        'terms',
      )}

      {/* ── Account ── */}
      <View style={styles.setAccountRow}>
        <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.setSignOut}>{isRTL ? 'تسجيل الخروج' : 'Sign out'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Text style={styles.setDelete}>{isRTL ? 'حذف الحساب' : 'Delete account'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 22 }} />
    </View>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 840, alignSelf: 'center' }}>

        {/* ════════ HEADER (approved build 3d) ════════
            A white page: avatar, name + verified shield, a mono line of
            real facts, and an Edit pill. This was a dark banner with the
            email and phone printed under a centred avatar. */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={handleAvatarUpload} style={styles.avatarWrap} activeOpacity={0.85}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarCamera}>
              <Camera size={12} color="white" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              {isVerifiedSeller && <ShieldCheck size={15} color="#059669" />}
            </View>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {[profile?.address, joinedLabel].filter(Boolean).join(' · ').toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity style={styles.editPill} onPress={() => setActiveTab('settings')} activeOpacity={0.8}>
            <Text style={styles.editPillText}>{isRTL ? 'تعديل' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* ════════ STATS ════════
            Three real numbers separated by hairlines. "Sold" only appears
            with payments on, because without orders it can only read zero. */}
        <View style={styles.stats}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{userProducts.length}</Text>
            <Text style={styles.statLabel}>{t('profile.statListings')}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBordered]}>
            <Text style={styles.statValue}>{replyTimeValue ?? '—'}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'وقت الرد' : 'REPLY TIME'}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBordered]}>
            <Text style={styles.statValue}>
              {userProducts.reduce((sum, p) => sum + (p.view_count ?? 0), 0)}
            </Text>
            <Text style={styles.statLabel}>{t('profile.statViews')}</Text>
          </View>
          {PAYMENTS_ENABLED && (
            <View style={[styles.statCell, styles.statCellBordered]}>
              <Text style={styles.statValue}>{soldCount}</Text>
              <Text style={styles.statLabel}>{t('profile.statSold')}</Text>
            </View>
          )}
        </View>

        {/* Wallet and verification tier live behind PAYMENTS_ENABLED; as
            hairline rows now rather than gradient cards. */}
        {PAYMENTS_ENABLED && (
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/wallet' as any)} activeOpacity={0.8}>
            <View style={styles.linkRowLeft}>
              <Wallet size={18} color="#0F172A" />
              <Text style={styles.linkRowText}>{isRTL ? 'المحفظة' : 'Wallet'}</Text>
            </View>
            <View style={styles.linkRowRight}>
              <Text style={styles.linkRowValue}>
                EGP {Number(wallet?.available_balance || 0).toLocaleString('en-EG')}
              </Text>
              <ChevronRight size={16} color="#CBD5E1" />
            </View>
          </TouchableOpacity>
        )}
        {PAYMENTS_ENABLED && (
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/seller-verification' as any)} activeOpacity={0.8}>
            <View style={styles.linkRowLeft}>
              <ShieldCheck size={18} color={isVerifiedSeller ? '#059669' : '#94A3B8'} />
              <Text style={styles.linkRowText}>
                {isVerifiedSeller
                  ? `${sellerTier.name}`
                  : (isRTL ? 'وثّق حسابك' : 'Verify your account')}
              </Text>
            </View>
            <ChevronRight size={16} color="#CBD5E1" />
          </TouchableOpacity>
        )}

        {/* ════════ TABS ════════
            Underlined text tabs, not icon pills. */}
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ════════ TAB CONTENT ════════ */}
        <View style={styles.tabContent}>
          {activeTab === 'products'  && renderProductList(userProducts,     "You haven't listed anything yet.")}
          {activeTab === 'wishlist'  && renderProductList(wishlistProducts,  "Your wishlist is empty.")}
          {activeTab === 'drafts'    && renderProductList(draftProducts,    "No drafts. Save a listing partway through and it lands here.")}
          {activeTab === 'settings'  && renderSettings()}
        </View>

        <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Settings tab (approved build 9a) ─────────────────────────────────
  setKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#64748B', marginTop: 20 },

  setAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  setAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9' },
  setAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  setAvatarInitials: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: '#0F172A' },
  setAvatarHint: { fontSize: 14, fontWeight: '700', color: '#2563EB' },

  setField: { marginTop: 16 },
  setFieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#64748B' },
  setInput: {
    fontSize: 16, fontWeight: '500', color: '#0F172A',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  setInputFilled: { fontWeight: '600', borderBottomWidth: 2, borderBottomColor: '#0F172A' },
  setPasswordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setEyeBtn: { paddingVertical: 11 },

  setPrimaryBtn: {
    height: 48, borderRadius: 999, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
  },
  setPrimaryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  setGhostBtn: {
    height: 48, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
  },
  setGhostBtnText: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  setNote: { fontSize: 12.5, color: '#64748B', fontWeight: '600', lineHeight: 18, marginTop: 10 },
  setLink: { color: '#2563EB', fontWeight: '700' },

  setRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  setRowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#64748B', flexShrink: 1 },
  setRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  setRowValue: { fontSize: 14.5, fontWeight: '700', color: '#0F172A', flexShrink: 1 },

  setAccountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, paddingBottom: 10 },
  setSignOut: { fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  setDelete: { fontSize: 14.5, fontWeight: '800', color: '#EF4444' },

  // ── Approved build (3d) ──────────────────────────────────────────────
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 4 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E2E8F0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: '#64748B' },
  avatarCamera: {
    position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.8, color: '#0F172A' },
  headerMeta: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#94A3B8', marginTop: 4 },
  editPill: {
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center',
  },
  editPillText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  stats: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 20,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  statCell: { flex: 1, paddingVertical: 14 },
  statCellBordered: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0', paddingLeft: 16 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.9, color: '#0F172A' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: '#94A3B8', marginTop: 2, textTransform: 'uppercase' },

  linkRow: {
    marginHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  linkRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkRowText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  linkRowValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  tabBar: { flexDirection: 'row', marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabBtn: { paddingVertical: 14, marginRight: 22, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#0F172A' },
  tabLabel: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  tabLabelActive: { color: '#0F172A', fontWeight: '800' },
  tabContent: { paddingHorizontal: 20, paddingTop: 4 },

  listingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  listingRowMuted: { opacity: 0.55 },
  listingThumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#E2E8F0' },
  listingTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A', lineHeight: 19 },
  listingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  listingStatus: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#059669' },
  listingStatusMuted: { color: '#94A3B8' },
  listingStatusDraft: { color: '#94A3B8' },
  listingDot: { color: '#CBD5E1' },
  listingMeta: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  listingPrice: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },
  listingEdit: { paddingLeft: 8 },

  emptyState: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  emptyAction: { paddingVertical: 8 },
  emptyActionText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },

  // ── Retained: settings panel, modals, loading ────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 15 },

  // Hero

  // Stat strip

  // Wallet Widget

  // Seller Tier Card

  // Tabs

  // Tab content

  // Listing grid (2-column)

  // Empty state

  // Chat

  // Settings cards

  // Avatar row in settings

  // Field / input

  // Save button

  // Language
  langRow: { flexDirection: 'row', gap: 12 },
  langPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  langPillActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  langLabel: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  langLabelActive: { color: '#6366F1' },

  // Sign out

  // Legal & Delete Account

});
