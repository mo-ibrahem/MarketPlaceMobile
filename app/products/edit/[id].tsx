import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save, Upload, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import { productService, type Product } from '../../../src/services/lib/products';
import { supabase } from '../../../src/services/lib/supabase';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 40; // The width of each slide (screen width minus container padding)

export default function EditProductScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [product, setProduct] = useState<Partial<Product> | null>(null);
    const [editableImages, setEditableImages] = useState<(string | ImagePicker.ImagePickerAsset)[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (id) {
            loadProduct();
        }
    }, [id]);

    const loadProduct = async () => {
        try {
            setLoading(true);
            const productData = await productService.getProductById(id!);
            setProduct(productData);
            setEditableImages(productData?.images || []);
        } catch (error) {
            Alert.alert("Error", "Failed to load product details.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (field: keyof Product, value: string | number) => {
        if (product) {
            setProduct({ ...product, [field]: value });
        }
    };

    const handlePickImage = async () => {
        const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: true,
            quality: 0.6,
        });
        if (!pickerResult.canceled) {
            setEditableImages(prev => [...prev, ...pickerResult.assets]);
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setEditableImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const uploadImage = async (imageAsset: ImagePicker.ImagePickerAsset) => {
        if (!imageAsset.uri) throw new Error("No image URI");
        const arraybuffer = await fetch(imageAsset.uri).then(res => res.arrayBuffer());
        const fileExt = imageAsset.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const path = `${user!.id}/${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('product-images').upload(path, arraybuffer, { contentType: `image/${fileExt}` });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
        return publicUrl;
    };

    const handleSaveChanges = async () => {
    if (!product || !id || !user) return;
    setSaving(true);
    try {
      // 1. FIGURE OUT WHAT CHANGED
      const originalUrls = product.images || [];
      const keptUrls = editableImages.filter(img => typeof img === 'string') as string[];
      const newImageAssets = editableImages.filter(img => typeof img !== 'string') as ImagePicker.ImagePickerAsset[];
      
      // Find which of the original URLs are no longer in the new list
      const urlsToDelete = originalUrls.filter(url => !keptUrls.includes(url));

      // 2. CALL THE DISPOSAL CREW: Delete any images that were removed
      if (urlsToDelete.length > 0) {
        await productService.deleteProductImages(urlsToDelete);
      }
      
      // 3. UPLOAD ANY NEW IMAGES
      const newImageUrls = await Promise.all(newImageAssets.map(asset => uploadImage(asset)));
      
      // 4. COMBINE AND SAVE THE FINAL LIST to the database
      const finalImageUrls = [...keptUrls, ...newImageUrls];

      await productService.updateProduct(id, {
        title: product.title,
        description: product.description,
        price: Number(product.price),
        images: finalImageUrls,
      });

      Alert.alert("Success", "Product updated successfully!");
      router.back();
    } catch (error) {
      console.error("Update failed:", error);
      Alert.alert("Error", "Failed to update product.");
    } finally {
      setSaving(false);
    }
  };
    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / SLIDE_WIDTH);
        setActiveIndex(index);
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }

    if (!product) {
        return <View style={styles.center}><Text>Product not found.</Text></View>;
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.label}>Product Images</Text>
                <View style={styles.sliderContainer}>
                    <FlatList
                        data={editableImages}
                        horizontal
                        pagingEnabled={false}
                        decelerationRate="fast"
                        snapToInterval={SLIDE_WIDTH}
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, index) => index.toString()}
                        onMomentumScrollEnd={handleScroll}
                        renderItem={({ item, index }) => (
                            <View style={styles.slide}>
                                <Image 
                                    source={{ uri: typeof item === 'string' ? item : item.uri }} 
                                    style={styles.mainImage} 
                                />
                                <TouchableOpacity style={styles.deleteIcon} onPress={() => handleRemoveImage(index)}>
                                    <X size={18} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                        style={styles.slider}
                        ListEmptyComponent={<View style={styles.emptySlide}><Text>No images yet</Text></View>}
                    />
                    {editableImages.length > 1 && (
                        <View style={styles.slideCounter}>
                            <Text style={styles.slideCounterText}>{activeIndex + 1} / {editableImages.length}</Text>
                        </View>
                    )}
                    {editableImages.length > 1 && (
                        <View style={styles.pagination}>
                            {editableImages.map((_, index) => (
                                <View
                                    key={index}
                                    style={[styles.dot, activeIndex === index ? styles.activeDot : {}]}
                                />
                            ))}
                        </View>
                    )}
                </View>
                <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
                    <Upload color="#4B5563" size={20} />
                    <Text style={styles.imagePickerText}>Add More Images</Text>
                </TouchableOpacity>
                
                <Text style={styles.label}>Title</Text>
                <TextInput
                    style={styles.input}
                    value={product.title}
                    onChangeText={(text) => handleUpdate('title', text)}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={product.description}
                    onChangeText={(text) => handleUpdate('description', text)}
                    multiline
                />

                <Text style={styles.label}>Price ($)</Text>
                <TextInput
                    style={styles.input}
                    value={String(product.price)}
                    onChangeText={(text) => handleUpdate('price', text)}
                    keyboardType="numeric"
                />

                <TouchableOpacity 
                    style={styles.saveButton} 
                    onPress={handleSaveChanges} 
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Save color="white" size={18} />
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
    container: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'white',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 16,
        marginBottom: 20,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16A34A',
        padding: 16,
        borderRadius: 12,
        marginTop: 20,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    sliderContainer: {
        height: SLIDE_WIDTH,
        marginBottom: 10,
    },
    slider: {
        height: SLIDE_WIDTH,
    },
    slide: {
        width: SLIDE_WIDTH,
        height: SLIDE_WIDTH,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
    },
    emptySlide: {
        width: SLIDE_WIDTH,
        height: SLIDE_WIDTH,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    deleteIcon: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 15,
        padding: 4,
    },
    imagePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
    },
    imagePickerText: {
        fontSize: 16,
        color: '#4B5563',
        marginLeft: 8,
    },
    pagination: {
        position: 'absolute',
        bottom: 10,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: 'white',
    },
    slideCounter: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    slideCounterText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
});