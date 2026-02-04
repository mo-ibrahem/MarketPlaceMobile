import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router'; // 1. IMPORT useFocusEffect
import { Camera, Edit, Eye, Lock, LogOut, Save, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { getChatRooms, type ChatRoomInfo } from '../../src/services/lib/chatService';
import { productService, profileService, type Product, type UserProfile } from '../../src/services/lib/products';
import { auth, supabase } from '../../src/services/lib/supabase';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoomInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('products');
  
  const [editProfileData, setEditProfileData] = useState({
    full_name: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();
  }, []);

  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [profileData, products, wishlist, chats] = await Promise.all([
        profileService.getProfile(user.id),
        productService.getProductsBySeller(user.id),
        productService.getWishlist(),
        getChatRooms(),
      ]);
      
      setProfile(profileData);
      setUserProducts(products);
      setWishlistProducts(wishlist);
      setChatRooms(chats || []);
      
      setEditProfileData({
        full_name: profileData?.full_name || '',
        phone: profileData?.phone || '',
      });

    } catch (error) {
      console.error("Error loading user data:", error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load your profile data.',
        });    
    } finally {
          setIsLoading(false);
        }
      }, [user]);

  // 2. ADD THIS HOOK TO AUTOMATICALLY RELOAD DATA
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadUserData();
      }
    }, [user, loadUserData])
  );
  
  const handleAvatarUpload = async () => {
    const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
        Toast.show({
          type: 'info', // 'info' (blue) is a good choice for informational messages
          text1: 'Permission Required',
          text2: 'Please go to your phone settings to allow photo access.',
          visibilityTime: 6000 // Show it for a longer time (6 seconds) so the user can read it
        });      
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!pickerResult.canceled && user) {
      const image = pickerResult.assets[0];
      setIsLoading(true);
      try {
        const arraybuffer = await fetch(image.uri).then(res => res.arrayBuffer());
        const fileExt = image.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const path = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arraybuffer, { contentType: `image/${fileExt}` });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        
        await profileService.updateProfile(user.id, { avatar_url: publicUrl });
        await loadUserData();
        Toast.show({ type: 'success', text1: 'Success', text2: 'Avatar updated!' });
      } catch (error: any) {
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: error.message });
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
        phone: editProfileData.phone 
      });
      await loadUserData();
      Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated.' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update profile.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: "New passwords don't match." });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      Toast.show({ type: 'error', text1: 'Error', text2: "Password must be at least 6 characters long." });
      return;
    }
    setIsLoading(true);
    const { error } = await auth.supabase.auth.updateUser({ password: passwordData.newPassword });
    if (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Success', text2: 'Password updated successfully!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    }
    setIsLoading(false);
  };
  
  const handleSignOut = async () => {
    await auth.signOut();
    router.replace('/login');
  };
  
  const handleDeleteProduct = (productId: string) => {
    Alert.alert( "Delete Product", "Are you sure you want to delete this product?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
              await productService.deleteProduct(productId);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Product has been deleted.'
              });              loadUserData();
            } catch (error) { Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete product.'
              }); }
          },
        },
      ]
    );
  };

  if (authLoading || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  if (!user) { return null; }
  
  const renderProductList = (products: Product[], emptyMessage: string) => {
    if (products.length === 0) {
      return <Text style={styles.emptyText}>{emptyMessage}</Text>;
    }
    return products.map(product => (
      <TouchableOpacity 
        key={product.id} 
        style={styles.productCard} 
        onPress={() => router.push(`/products/${product.id}`)}
      >
        <Image source={{ uri: product.images?.[0] || 'https://placehold.co/400x300/E2E8F0/4A5568?text=Image' }} style={styles.productImage} />
        <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={1}>{product.title}</Text>
            <Text style={styles.productPrice}>${Number(product.price).toFixed(2)}</Text>
            <View style={styles.productActions}>
                <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); router.push(`/products/${product.id}`); }}><Eye size={16} color="#4B5563" /></TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); router.push(`/products/edit/${product.id}`); }}><Edit size={16} color="#4B5563" /></TouchableOpacity>
                {activeTab === 'products' && (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} style={styles.actionButton}><Trash2 size={16} color="#EF4444" /></TouchableOpacity>
                )}
            </View>
        </View>
      </TouchableOpacity>
    ));
  };

  const renderChatList = () => {
    if (chatRooms.length === 0) {
      return <Text style={styles.emptyText}>You have no active conversations.</Text>;
    }
    return chatRooms.map(chat => (
      <TouchableOpacity 
        key={chat.room_id} 
        style={styles.chatCard} 
        onPress={() => router.push(`/chat/${chat.room_id}`)}
      >
        <Image source={{ uri: chat.other_user_avatar_url || 'https://placehold.co/100x100/E2E8F0/4A5568?text=User' }} style={styles.chatAvatar} />
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{chat.other_user_name}</Text>
          <Text style={styles.chatPreview}>Tap to view conversation</Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const renderSettings = () => (
    <View style={styles.settingsContainer}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
        <Text style={styles.label}>Profile Picture</Text>
        <TouchableOpacity style={styles.avatarUploadButton} onPress={handleAvatarUpload}>
            <Camera size={18} color="#4B5563" />
            <Text style={styles.avatarUploadButtonText}>Change Avatar</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
            style={styles.input}
            placeholder="Your full name"
            value={editProfileData.full_name}
            onChangeText={(text) => setEditProfileData({...editProfileData, full_name: text})}
        />
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
            style={styles.input}
            placeholder="Your phone number"
            value={editProfileData.phone}
            onChangeText={(text) => setEditProfileData({...editProfileData, phone: text})}
            keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges} disabled={isLoading}><Save size={18} color="white" /><Text style={styles.saveButtonText}>Save Profile Changes</Text></TouchableOpacity>
        <View style={styles.separator} />
        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextInput style={styles.input} placeholder="New Password" secureTextEntry value={passwordData.newPassword} onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})} />
        <TextInput style={styles.input} placeholder="Confirm New Password" secureTextEntry value={passwordData.confirmPassword} onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})} />
        <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={isLoading}><Lock size={18} color="white" /><Text style={styles.saveButtonText}>Update Password</Text></TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView>
        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={{ uri: profile?.avatar_url || 'https://placehold.co/100x100/E2E8F0/4A5568?text=User' }} style={styles.avatar} />
            <View style={styles.headerText}>
                <Text style={styles.fullName}>{profile?.full_name || user.email?.split('@')[0]}</Text>
                <Text style={styles.email}>{user.email}</Text>
                {profile?.phone && <Text style={styles.phoneText}>{profile.phone}</Text>}
            </View>
            {/* 3. UPDATED: This button now switches to the Settings tab */}
            <TouchableOpacity onPress={() => setActiveTab('settings')} style={styles.editButtonContainer}>
              <Edit size={24} color="#4B5563" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}><Text style={styles.statNumber}>{userProducts.length}</Text><Text style={styles.statLabel}>Products</Text></View>
            <View style={styles.statBox}><Text style={styles.statNumber}>{wishlistProducts.length}</Text><Text style={styles.statLabel}>Wishlist</Text></View>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'products' && styles.activeTab]} onPress={() => setActiveTab('products')}><Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>My Products</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'wishlist' && styles.activeTab]} onPress={() => setActiveTab('wishlist')}><Text style={[styles.tabText, activeTab === 'wishlist' && styles.activeTabText]}>Wishlist</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'chats' && styles.activeTab]} onPress={() => setActiveTab('chats')}><Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>Chats</Text></TouchableOpacity>
          </View>

          {activeTab === 'products' && renderProductList(userProducts, "You haven't listed any products yet.")}
          {activeTab === 'wishlist' && renderProductList(wishlistProducts, "Your wishlist is empty.")}
          {activeTab === 'chats' && renderChatList()}
          {activeTab === 'settings' && renderSettings()}
          
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <LogOut color="white" size={18} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 4. REMOVE unused styles and make sure the rest are present
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
    container: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 10, color: '#4B5563' },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, position: 'relative' },
    avatar: { width: 80, height: 80, borderRadius: 40, marginRight: 16 },
    headerText: { flex: 1 },
    fullName: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    email: { fontSize: 16, color: '#6B7280' },
    phoneText: { fontSize: 16, color: '#4B5563', marginTop: 4 },
    editButtonContainer: { position: 'absolute', top: 0, right: 0, padding: 8 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24, backgroundColor: 'white', padding: 16, borderRadius: 12 },
    statBox: { alignItems: 'center' },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
    statLabel: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    tabContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4 },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },
    tabText: { fontSize: 14, fontWeight: '600', color: '#4B5563', textAlign: 'center' },
    activeTabText: { color: '#1F2937' },
    productCard: { backgroundColor: 'white', borderRadius: 12, flexDirection: 'row', marginBottom: 16, overflow: 'hidden' },
    productImage: { width: 100, height: 100 },
    productInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
    productTitle: { fontSize: 16, fontWeight: '600' },
    productPrice: { fontSize: 14, color: '#2563EB', fontWeight: 'bold' },
    productActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
    actionButton: { padding: 4 },
    emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 20, marginBottom: 20 },
    signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', padding: 16, borderRadius: 12, marginTop: 32 },
    signOutText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    chatCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
    chatAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    chatInfo: { flex: 1 },
    chatName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    chatPreview: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    settingsContainer: { backgroundColor: 'white', padding: 20, borderRadius: 12 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: { backgroundColor: '#F9FAFB', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16, marginBottom: 16 },
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A', padding: 16, borderRadius: 12, marginTop: 10 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    separator: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 24 },
    avatarUploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, marginBottom: 20 },
    avatarUploadButtonText: { fontSize: 16, color: '#4B5563', marginLeft: 8 },
});