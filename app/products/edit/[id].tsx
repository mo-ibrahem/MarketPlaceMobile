import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Check, MapPin, Save, Trash2, Upload, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { useAuth } from '../../../hooks/useAuth';
import { productService, type Product } from '../../../src/services/lib/products';
import { supabase } from '../../../src/services/lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_W - 40;

const CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home',
  'Toys',
  'Sports',
  'Books',
  'Beauty',
  'Automotive',
];

const EGYPTIAN_GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Luxor', 'Aswan', 'Asyut',
  'Beheira', 'Beni Suef', 'Dakahlia', 'Damietta', 'Fayoum',
  'Gharbia', 'Ismailia', 'Kafr El Sheikh', 'Matruh', 'Minya',
  'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia',
  'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
];

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [price,       setPrice]       = useState('');
  const [category,    setCategory]    = useState('Electronics');
  const [condition,   setCondition]   = useState('New');
  const [location,    setLocation]    = useState('');
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [editableImages, setEditableImages] = useState<(string | ImagePicker.ImagePickerAsset)[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const p = await productService.getProductById(id!);
      if (p) {
        setTitle(p.title || '');
        setDescription(p.description || '');
        setPrice(String(p.price || ''));
        setCategory(p.category || 'Electronics');
        setCondition(p.condition || 'New');
        setLocation(p.location || '');
        setOriginalImages(p.images || []);
        setEditableImages(p.images || []);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load product details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading state belongs to the request for the selected product.
    if (id) loadProduct();
  }, [id]);

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!res.canceled) {
      setEditableImages(prev => [...prev, ...res.assets]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setEditableImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const uploadImage = async (imageAsset: ImagePicker.ImagePickerAsset) => {
    if (!imageAsset.uri) throw new Error("No image URI");
    const arraybuffer = await fetch(imageAsset.uri).then(res => res.arrayBuffer());
    const fileExt = imageAsset.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
    const path = `${user!.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('product-images').upload(path, arraybuffer, { contentType: `image/${fileExt}` });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    return publicUrl;
  };

  const handleSaveChanges = async () => {
    if (!id || !user) return;
    if (!title.trim() || !price.trim()) {
      Toast.show({ type: 'error', text1: 'Please fill in title and price.' });
      return;
    }

    setSaving(true);
    try {
      const keptUrls = editableImages.filter(img => typeof img === 'string') as string[];
      const newAssets = editableImages.filter(img => typeof img !== 'string') as ImagePicker.ImagePickerAsset[];
      
      const urlsToDelete = originalImages.filter(url => !keptUrls.includes(url));
      if (urlsToDelete.length > 0) {
        await productService.deleteProductImages(urlsToDelete);
      }

      const newUrls = await Promise.all(newAssets.map(asset => uploadImage(asset)));
      const finalImageUrls = [...keptUrls, ...newUrls];

      await productService.updateProduct(id, {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        condition,
        location: location || undefined,
        images: finalImageUrls,
      });

      Toast.show({ type: 'success', text1: 'Listing updated successfully!' });
      router.back();
    } catch (e: any) {
      console.error('Update error:', e);
      Toast.show({ type: 'error', text1: 'Failed to update product', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: '#94A3B8' }}>Loading Listing…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          <View style={[styles.container, { width: '100%', maxWidth: 680, alignSelf: 'center' }]}>
          {/* Images Section */}
          <Text style={styles.sectionLabel}>Product Photos</Text>
          <View style={styles.sliderContainer}>
            <FlatList
              data={editableImages}
              horizontal
              pagingEnabled={false}
              decelerationRate="fast"
              snapToInterval={SLIDE_WIDTH}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onMomentumScrollEnd={e => {
                setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH));
              }}
              renderItem={({ item, index }) => (
                <View style={styles.slide}>
                  <Image
                    source={{ uri: typeof item === 'string' ? item : item.uri }}
                    style={styles.mainImage}
                  />
                  <TouchableOpacity style={styles.deleteIcon} onPress={() => handleRemoveImage(index)}>
                    <X size={16} color="white" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptySlide}>
                  <Camera size={32} color="#94A3B8" />
                  <Text style={{ color: '#94A3B8', marginTop: 8 }}>No photos added</Text>
                </View>
              }
            />
            {editableImages.length > 1 && (
              <View style={styles.slideCounter}>
                <Text style={styles.slideCounterText}>{activeIndex + 1} / {editableImages.length}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage} activeOpacity={0.8}>
            <Upload color="#6366F1" size={18} />
            <Text style={styles.imagePickerText}>Add / Upload More Photos</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.sectionLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Product title"
            placeholderTextColor="#94A3B8"
          />

          {/* Price (EGP) */}
          <Text style={styles.sectionLabel}>Price (EGP)</Text>
          <View style={styles.priceWrap}>
            <View style={styles.pricePrefix}>
              <Text style={styles.pricePrefixText}>EGP</Text>
            </View>
            <TextInput
              style={styles.priceInput}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Condition */}
          <Text style={styles.sectionLabel}>Condition</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {['New', 'Used'].map(cond => (
              <TouchableOpacity
                key={cond}
                style={[styles.condChip, condition === cond && styles.condChipActive]}
                onPress={() => setCondition(cond)}
              >
                <Text style={[styles.condChipText, condition === cond && styles.condChipTextActive]}>{cond}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location / Governorate */}
          <Text style={styles.sectionLabel}>Location in Egypt</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EGYPTIAN_GOVERNORATES.map(gov => (
              <TouchableOpacity
                key={gov}
                style={[styles.chip, location === gov && styles.chipActive]}
                onPress={() => setLocation(prev => prev === gov ? '' : gov)}
              >
                <Text style={[styles.chipText, location === gov && styles.chipTextActive]}>
                  {location === gov ? `📍 ${gov}` : gov}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the product details..."
            placeholderTextColor="#94A3B8"
            multiline
          />

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveChanges}
            disabled={saving}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#1D4ED8', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Save color="white" size={18} />
                  <Text style={styles.saveBtnText}>Save & Update Listing</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },

  container: { padding: 20 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
    marginTop: 10,
  },

  sliderContainer: {
    height: SLIDE_WIDTH * 0.7,
    marginBottom: 12,
    position: 'relative',
  },
  slide: {
    width: SLIDE_WIDTH,
    height: SLIDE_WIDTH * 0.7,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  emptySlide: {
    width: SLIDE_WIDTH,
    height: SLIDE_WIDTH * 0.7,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  mainImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  deleteIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideCounter: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  slideCounterText: { color: 'white', fontSize: 11, fontWeight: '700' },

  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  imagePickerText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },

  input: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 14,
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },

  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    overflow: 'hidden',
    marginBottom: 14,
  },
  pricePrefix: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
  },
  pricePrefixText: { fontSize: 15, fontWeight: '900', color: '#2563EB' },
  priceInput: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0F172A', paddingHorizontal: 14 },

  chipRow: { gap: 8, paddingBottom: 6, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#6366F1', fontWeight: '800' },

  condChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  condChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  condChipText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  condChipTextActive: { color: '#2563EB', fontWeight: '800' },

  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
