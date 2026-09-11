import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bell,
  Camera,
  ChevronRight,
  Edit3,
  Eye,
  Globe,
  Heart,
  Lock,
  LogOut,
  MessageCircle,
  Package,
  Save,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  User,
  Wallet,
  ArrowUpRight,
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
import { getChatRooms, type ChatRoomInfo } from '../../src/services/lib/chatService';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEGP(price: number | string): string {
  const n = Math.round(Number(price));
  return `EGP ${n.toLocaleString('en-EG')}`;
}

function timeAgoShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'products', label: 'Listings', icon: Package  },
  { id: 'wishlist', label: 'Saved',    icon: Heart    },
  { id: 'chats',    label: 'Chats',    icon: MessageCircle },
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

  const [profile,          setProfile]          = useState<UserProfile | null>(null);
  const [userProducts,     setUserProducts]     = useState<Product[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [chatRooms,        setChatRooms]        = useState<ChatRoomInfo[]>([]);
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
      const [profileData, products, wishlist, chats, sold, userWallet, tier] = await Promise.all([
        profileService.getProfile(user.id),
        productService.getProductsBySeller(user.id),
        productService.getWishlist(),
        getChatRooms(),
        productService.getSoldCountBySeller(user.id),
        getUserWallet(user.id),
        getSellerTier(user.id),
      ]);
      setProfile(profileData);
      setUserProducts(products);
      setWishlistProducts(wishlist);
      setChatRooms(chats || []);
      setSoldCount(sold);
      setWallet(userWallet);
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
        const ext     = img.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const path    = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('avatars').upload(path, buf, { contentType: `image/${ext}` });
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
        await productService.deleteProduct(productId);
        Toast.show({ type: 'success', text1: 'Listing deleted.' });
        loadUserData();
      } catch {
        Toast.show({ type: 'error', text1: 'Failed to delete listing.' });
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
    const doDelete = async () => {
      try {
        if (user) {
          await supabase.from('profiles').delete().eq('id', user.id);
        }
        await auth.signOut();
        Toast.show({ type: 'success', text1: 'Account Deleted Successfully' });
        router.replace('/login');
      } catch (err: any) {
        if (Platform.OS === 'web') {
          window.alert(err?.message || 'Failed to delete account');
        } else {
          Alert.alert('Error', err?.message || 'Failed to delete account');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to permanently delete your EgyBay account? This action cannot be undone.')) {
        await doDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Account • حذف الحساب',
      'Are you sure you want to permanently delete your EgyBay account? This action cannot be undone and will erase all your listings and profile data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: doDelete,
        },
      ]
    );
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

  const renderProductList = (products: Product[], emptyMsg: string) => {
    return products.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{activeTab === 'wishlist' ? '❤️' : '📦'}</Text>
          <Text style={styles.emptyTitle}>{emptyMsg}</Text>
          {activeTab === 'products' && (
            <TouchableOpacity style={styles.emptyAction} onPress={() => router.push('/sell' as any)}>
              <Text style={styles.emptyActionText}>List your first item →</Text>
            </TouchableOpacity>
          )}
        </View>
    ) : (
      <View style={styles.listingGrid}>
        {products.map(product => (
          <TouchableOpacity
            key={product.id}
            style={styles.listingCard}
            onPress={() => router.push(`/products/${product.id}`)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: product.images?.[0] || 'https://placehold.co/300x300/F1F5F9/64748B?text=Item' }}
              style={styles.listingImg}
            />
            {/* EGP price pill */}
            <View style={styles.listingPricePill}>
              <Text style={styles.listingPriceText}>{formatEGP(product.price)}</Text>
            </View>
            {/* Actions (only on My Listings) */}
            {activeTab === 'products' && (
              <View style={styles.listingActions}>
                <TouchableOpacity
                  style={styles.listingActionBtn}
                  onPress={e => { e.stopPropagation(); router.push(`/products/edit/${product.id}`); }}
                  hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
                >
                  <Edit3 size={13} color="#6366F1" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listingActionBtn, styles.listingDeleteBtn]}
                  onPress={e => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                  hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
                >
                  <Trash2 size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.listingCardBody}>
              <Text style={styles.listingTitle} numberOfLines={1}>{product.title}</Text>
              <View style={[styles.conditionPill, product.condition === 'New' ? styles.conditionNew : styles.conditionUsed]}>
                <Text style={[styles.conditionText, product.condition === 'New' ? styles.conditionTextNew : styles.conditionTextUsed]}>
                  {product.condition}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderChatList = () => {
    if (chatRooms.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>{t('chat.noConversations')}</Text>
          <Text style={styles.emptySubtitle}>{t('chat.startConversation')}</Text>
        </View>
      );
    }
    return chatRooms.map(chat => (
      <TouchableOpacity
        key={chat.room_id}
        style={styles.chatCard}
        onPress={() => router.push(`/chat/${chat.room_id}`)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: chat.other_user_avatar_url || 'https://placehold.co/100x100/EEF2FF/6366F1?text=U' }}
          style={styles.chatAvatar}
        />
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{chat.other_user_name}</Text>
          {/* Conversations are scoped to a listing, so the inbox has to say
              which one -- otherwise two threads with the same seller are
              indistinguishable. Legacy rooms have no product and show none. */}
          {!!chat.product_title && (
            <Text style={styles.chatProduct} numberOfLines={1}>
              {chat.product_title}
            </Text>
          )}
          <Text style={styles.chatPreview} numberOfLines={1}>
            {chat.last_message ? chat.last_message : t('chat.startConversation')}
          </Text>
        </View>
        {chat.last_message_time ? (
          <Text style={styles.chatTime}>{timeAgoShort(chat.last_message_time)}</Text>
        ) : (
          <ChevronRight color="#CBD5E1" size={20} />
        )}
      </TouchableOpacity>
    ));
  };

  const renderSettings = () => (
    <View style={{ gap: 16 }}>
      {/* Profile section */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>👤  Edit Profile</Text>

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarRow} onPress={handleAvatarUpload} activeOpacity={0.8}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.settingsAvatar} />
          ) : (
            <View style={styles.settingsAvatarFallback}>
              <Text style={styles.settingsAvatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarRowText}>
            <Text style={styles.avatarRowLabel}>Profile Photo</Text>
            <Text style={styles.avatarRowSub}>Tap to change</Text>
          </View>
          <View style={styles.avatarCameraIcon}>
            <Camera size={16} color="#6366F1" />
          </View>
        </TouchableOpacity>

        <View style={styles.settingsDivider} />

        {/* Name */}
        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="Your full name"
          placeholderTextColor="#94A3B8"
          value={editProfileData.full_name}
          onChangeText={text => setEditProfileData(d => ({ ...d, full_name: text }))}
          returnKeyType="next"
        />

        {/* Phone */}
        <Text style={styles.fieldLabel}>Phone Number</Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="Your phone number"
          placeholderTextColor="#94A3B8"
          value={editProfileData.phone}
          onChangeText={text => setEditProfileData(d => ({ ...d, phone: text }))}
          keyboardType="phone-pad"
          returnKeyType="done"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges} disabled={isLoading}>
          <Save size={17} color="white" />
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      {/* Password section */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🔒  Change Password</Text>

        <Text style={styles.fieldLabel}>New Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.settingsInput, { flex: 1, marginBottom: 0 }]}
            placeholder="New password"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={passwordData.newPassword}
            onChangeText={text => setPasswordData(d => ({ ...d, newPassword: text }))}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Eye size={18} color={showPassword ? '#6366F1' : '#94A3B8'} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Confirm Password</Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="Confirm new password"
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showPassword}
          value={passwordData.confirmPassword}
          onChangeText={text => setPasswordData(d => ({ ...d, confirmPassword: text }))}
        />

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#4F46E5' }]} onPress={handleChangePassword}>
          <Lock size={17} color="white" />
          <Text style={styles.saveBtnText}>Update Password</Text>
        </TouchableOpacity>
      </View>

      {/* Language */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🌐  {t('language.title')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langPill, language === 'en' && styles.langPillActive]}
            onPress={() => changeLanguage('en')}
          >
            <Text style={styles.langEmoji}>🇬🇧</Text>
            <Text style={[styles.langLabel, language === 'en' && styles.langLabelActive]}>{t('language.english')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langPill, language === 'ar' && styles.langPillActive]}
            onPress={() => changeLanguage('ar')}
          >
            <Text style={styles.langEmoji}>🇸🇦</Text>
            <Text style={[styles.langLabel, language === 'ar' && styles.langLabelActive]}>{t('language.arabic')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legal & Compliance (Apple Mandated) */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>📜  Legal & Policies • الشروط والسياسات</Text>
        
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => router.push('/terms' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.legalText}>📄 Terms of Service • الشروط والأحكام</Text>
          <ChevronRight size={16} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.legalDivider} />

        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => router.push('/privacy' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.legalText}>🛡️ Privacy Policy • سياسة الخصوصية</Text>
          <ChevronRight size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Account Actions */}
      <View style={{ gap: 10 }}>
        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut color="#64748B" size={18} />
          <Text style={styles.signOutText}>Sign Out • تسجيل الخروج</Text>
        </TouchableOpacity>

        {/* Apple Required Account Deletion */}
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
        >
          <Trash2 color="#EF4444" size={18} />
          <Text style={styles.deleteAccountText}>Delete Account • حذف الحساب نهائياً</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 840, alignSelf: 'center' }}>

        {/* ════════ HERO BANNER ════════ */}
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroBanner, { paddingTop: insets.top + 20 }]}
        >
          {/* Avatar */}
          <TouchableOpacity onPress={handleAvatarUpload} style={styles.heroAvatarWrap} activeOpacity={0.85}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.heroAvatar} />
            ) : (
              <View style={styles.heroAvatarFallback}>
                <Text style={styles.heroAvatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.heroAvatarCamera}>
              <Camera size={14} color="white" />
            </View>
          </TouchableOpacity>

          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>
          {profile?.phone && <Text style={styles.heroPhone}>📞 {profile.phone}</Text>}
        </LinearGradient>

        {/* ════════ STAT STRIP ════════ */}
        <View style={styles.statStrip}>
          <StatCard
            value={userProducts.length}
            label={t('profile.statListings')}
            icon={<ShoppingBag color="#6366F1" size={20} />}
            bg="#EEF2FF"
            onPress={() => setActiveTab('products')}
          />
          <View style={styles.statDivider} />
          <StatCard
            value={soldCount}
            label={t('profile.statSold')}
            icon={<Package color="#10B981" size={20} />}
            bg="#D1FAE5"
            onPress={() => setActiveTab('products')}
          />
          <View style={styles.statDivider} />
          <StatCard
            value={wishlistProducts.length}
            label={t('profile.statSaved')}
            icon={<Heart color="#EC4899" size={20} />}
            bg="#FCE7F3"
            onPress={() => setActiveTab('wishlist')}
          />
          <View style={styles.statDivider} />
          <StatCard
            value={chatRooms.length}
            label={t('profile.statChats')}
            icon={<MessageCircle color="#0EA5E9" size={20} />}
            bg="#E0F2FE"
            onPress={() => setActiveTab('chats')}
          />
        </View>

        {/* ════════ MY WALLET & ESCROW BALANCE WIDGET ════════ */}
        <TouchableOpacity onPress={() => router.push('/wallet' as any)} activeOpacity={0.88} style={{ marginHorizontal: 20, marginTop: 14 }}>
          <LinearGradient
            colors={['#3665F3', '#5B3DDB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.walletWidgetCard}
          >
            <View style={styles.walletWidgetHeader}>
              <View style={styles.walletWidgetIconBox}>
                <Wallet color="#3665F3" size={18} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletWidgetTitle}>EgyBay Wallet & Escrow</Text>
                <Text style={styles.walletWidgetSub}>
                  Pending: <Text style={{ fontWeight: '800', color: '#FCD34D' }}>EGP {Number(wallet?.pending_balance || 0).toLocaleString()}</Text>
                </Text>
              </View>
              <View style={styles.walletWidgetRight}>
                <Text style={styles.walletWidgetAvailable}>EGP {Number(wallet?.available_balance || 0).toLocaleString()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={styles.walletWidgetCta}>Withdraw</Text>
                  <ArrowUpRight size={12} color="white" strokeWidth={3} />
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ════════ SELLER TRUST TIER CARD ════════
            Every field here used to be hardcoded: it told each user they were a
            "Tier 2: Verified Trader" with a "VERIFIED" badge and an "Egyptian
            National ID Verified" subtitle, no matter what the database said.
            This account, for one, is tier 1 with is_verified_seller = false and
            no verification request on file. It now reports the real tier and
            only claims verification when the profile actually carries it. */}
        <TouchableOpacity
          style={styles.sellerTierCard}
          onPress={() => router.push('/seller-verification' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.tierIconWrap}>
            <ShieldCheck color={isVerifiedSeller ? '#10B981' : '#94A3B8'} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.tierRow}>
              <Text style={styles.tierTitle}>
                Tier {sellerTier.tier}: {sellerTier.name}
              </Text>
              {isVerifiedSeller && (
                <View style={styles.tierBadge}>
                  <Text style={styles.tierBadgeText}>VERIFIED 🛡️</Text>
                </View>
              )}
            </View>
            <Text style={styles.tierSub}>
              {isVerifiedSeller
                ? 'Egyptian National ID Verified • 100% Escrow Protection'
                : `Not verified yet • Requires ${sellerTier.kycRequirement}`}
            </Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </TouchableOpacity>

        {/* ════════ TABS ════════ */}
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const Icon    = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Icon size={18} color={isActive ? '#6366F1' : '#94A3B8'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ════════ TAB CONTENT ════════ */}
        <View style={styles.tabContent}>
          {activeTab === 'products'  && renderProductList(userProducts,     "You haven't listed anything yet.")}
          {activeTab === 'wishlist'  && renderProductList(wishlistProducts,  "Your wishlist is empty.")}
          {activeTab === 'chats'     && renderChatList()}
          {activeTab === 'settings'  && renderSettings()}
        </View>

        <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  value, label, icon, bg, onPress,
}: {
  value: number; label: string; icon: React.ReactNode; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.statIconBg, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 15 },

  // Hero
  heroBanner: {
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroAvatarWrap: { position: 'relative', marginBottom: 14 },
  heroAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: 'white' },
  heroAvatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: 'white',
  },
  heroAvatarInitials: { fontSize: 34, fontWeight: '800', color: 'white' },
  heroAvatarCamera: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: '#3665F3', borderRadius: 14,
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  heroName:  { fontSize: 24, fontWeight: '900', color: 'white', marginBottom: 4, letterSpacing: -0.3 },
  heroEmail: { fontSize: 14, color: '#94A3B8', marginBottom: 4, fontWeight: '600' },
  heroPhone: { fontSize: 13, color: '#64748B', fontWeight: '600' },

  // Stat strip
  statStrip: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statCard: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBg: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  statDivider: { width: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },

  // Wallet Widget
  walletWidgetCard: {
    borderRadius: 24,
    padding: 18,
    shadowColor: '#3665F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  walletWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletWidgetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  walletWidgetTitle: { fontSize: 15, fontWeight: '800', color: 'white', marginBottom: 2 },
  walletWidgetSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  walletWidgetRight: { alignItems: 'flex-end' },
  walletWidgetAvailable: { fontSize: 16, fontWeight: '900', color: 'white', marginBottom: 4 },
  walletWidgetCta: { fontSize: 12, fontWeight: '800', color: 'white' },

  // Seller Tier Card
  sellerTierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tierIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tierTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  tierBadge: { backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tierBadgeText: { fontSize: 11, fontWeight: '900', color: 'white', letterSpacing: 0.5 },
  tierSub: { fontSize: 11, color: '#64748B', fontWeight: '500' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 4, borderRadius: 999 },
  tabBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  tabLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabLabelActive: { color: '#3665F3', fontWeight: '900' },

  // Tab content
  tabContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Listing grid (2-column)
  listingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  listingCard: {
    width: '47.5%',
    backgroundColor: 'white',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  listingImg: { width: '100%', aspectRatio: 1 },
  listingPricePill: {
    position: 'absolute',
    bottom: 56,
    left: 8,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  listingPriceText: { color: 'white', fontSize: 12, fontWeight: '800' },
  listingActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 6,
    flexDirection: 'column',
  },
  listingActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingDeleteBtn: { backgroundColor: '#FEF2F2' },
  listingCardBody: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listingTitle: { fontSize: 12, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 6 },
  conditionPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  conditionNew: { backgroundColor: '#D1FAE5' },
  conditionUsed: { backgroundColor: '#FEF3C7' },
  conditionText: { fontSize: 11, fontWeight: '800' },
  conditionTextNew: { color: '#065F46' },
  conditionTextUsed: { color: '#92400E' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  emptyAction: {
    marginTop: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyActionText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },

  // Chat
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  chatAvatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  chatInfo: { flex: 1 },
  chatProduct: { fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 },
  chatName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 3 },
  chatPreview: { fontSize: 13, color: '#94A3B8' },
  chatTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginLeft: 6 },

  // Settings cards
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  settingsCardTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  settingsDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },

  // Avatar row in settings
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },
  settingsAvatar: { width: 52, height: 52, borderRadius: 26 },
  settingsAvatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  settingsAvatarInitials: { fontSize: 18, fontWeight: '800', color: '#6366F1' },
  avatarRowText: { flex: 1 },
  avatarRowLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  avatarRowSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  avatarCameraIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },

  // Field / input
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 4 },
  settingsInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 14,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    width: 46, height: 46,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },

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
  langEmoji: { fontSize: 18 },
  langLabel: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  langLabelActive: { color: '#6366F1' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signOutText: { color: '#475569', fontSize: 14, fontWeight: '700' },

  // Legal & Delete Account
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  legalText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  legalDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },

  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  deleteAccountText: { color: '#EF4444', fontSize: 13, fontWeight: '800' },
});