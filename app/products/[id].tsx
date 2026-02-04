import { useLocalSearchParams, useRouter } from 'expo-router';
import { Edit, Heart, MessageCircle, Share2 } from 'lucide-react-native'; // 1. IMPORT the Edit icon
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { getOrCreateChatRoom } from '../../src/services/lib/chatService';
import { productService, type Product } from '../../src/services/lib/products';
import { supabase } from '../../src/services/lib/supabase';
const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const router = useRouter();
    
    const [isBuying, setIsBuying] = useState(false); // Add this state to show a loader
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (id) {
            loadProduct();
        }
    }, [id, user]); // Reload if the user logs in/out, which affects wishlist status

    const loadProduct = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const productData = await productService.getProductById(id);
            setProduct(productData);
            setIsWishlisted(productData?.isWishlisted || false);
        } catch (error) {
            console.error("Error loading product:", error);
            Alert.alert("Error", "Failed to load product details.");
        } finally {
            setLoading(false);
        }
    };
    const handleBuyNow = async () => {
    if (!user || !product) {
        Alert.alert("Error", "Please make sure you are logged in.");
        return;
    };

    setIsBuying(true);
    try {
        const { data, error } = await supabase.functions.invoke('create-payment-key', {
            body: { 
                product: { 
                    id: product.id, 
                    title: product.title, 
                    description: product.description, 
                    price: product.price 
                },
                userProfile: { 
                    id: user.id, 
                    email: user.email, 
                    full_name: user.user_metadata?.full_name || 'N/A', 
                    phone: user.phone || '0123456789'
                }
            },
        });

        if (error) throw error;

        // This 'as any' tells the editor to ignore the "fake" error.
        router.push(`/payment?paymentToken=${data.paymentToken}` as any);

    } catch (error: any) {
        Alert.alert("Payment Error", "Could not initiate payment. " + error.message);
    } finally {
        setIsBuying(false);
    }
  };

    const handleAddToWishlist = async () => {
        if (!user) {
          router.push('/login');
          return;
        }
        if (!product) return;
        try {
          if (isWishlisted) {
            await productService.removeFromWishlist(product.id);
            setIsWishlisted(false);
            Alert.alert("Success", "Removed from wishlist.");
          } else {
            await productService.addToWishlist(product.id);
            setIsWishlisted(true);
            Alert.alert("Success", "Added to wishlist!");
          }
        } catch (error) {
          console.error("Wishlist error:", error);
          Alert.alert("Error", "Could not update wishlist.");
        }
    };
    
    const handleContactSeller = async () => {
        if (!user) {
            router.push('/login');
            return;
        }
        if (!product || !product.seller_id) {
            Alert.alert("Error", "Seller information is not available.");
            return;
        }
        if (user.id === product.seller_id) {
            Alert.alert("Info", "This is your own product listing.");
            return;
        }
        try {
            const roomId = await getOrCreateChatRoom(product.seller_id);
            router.push(`/chat/${roomId}`);
        } catch (error) {
            Alert.alert("Error", "Could not start chat.");
        }
    };

    const handleShare = async () => {
        if (!product) return;
        try {
            await Share.share({
                message: `Check out this product on Egbay: ${product.title}`,
            });
        } catch (error) {
            Alert.alert("Error", "Could not share product.");
        }
    };
    
    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / width);
        setActiveIndex(index);
    };

    if (loading || !product) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    // --- 2. NEW: Check if the current user is the owner of the product ---
    const isOwner = user?.id === product.seller_id;

    const images = product.images && product.images.length > 0 ? product.images : ['https://placehold.co/400x400/E2E8F0/4A5568?text=Image'];

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <ScrollView>
                <View style={styles.sliderContainer}>
                    <FlatList
                        ref={flatListRef}
                        data={images}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, index) => index.toString()}
                        onMomentumScrollEnd={handleScroll}
                        renderItem={({ item }) => (
                            <View style={styles.slide}>
                                <Image source={{ uri: item }} style={styles.mainImage} />
                            </View>
                        )}
                    />
                    {images.length > 1 && (
                        <View style={styles.pagination}>
                            {images.map((_, index) => (
                                <View
                                    key={index}
                                    style={[styles.dot, activeIndex === index ? styles.activeDot : {}]}
                                />
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{product.title}</Text>
                        <View style={styles.actionsContainer}>
                            {/* Don't show wishlist button for your own product */}
                            {!isOwner && (
                                <TouchableOpacity style={styles.actionButton} onPress={handleAddToWishlist}>
                                    <Heart size={24} color={isWishlisted ? '#EF4444' : '#6B7280'} fill={isWishlisted ? '#EF4444' : 'none'} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                                <Share2 size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.price}>${Number(product.price).toFixed(2)}</Text>
                    
                    <View style={styles.separator} />

                    <View style={styles.sellerContainer}>
                        <Image source={{ uri: product.seller?.avatar_url || 'https://placehold.co/100x100/E2E8F0/4A5568?text=User' }} style={styles.sellerAvatar} />
                        <View>
                            <Text style={styles.sellerName}>{product.seller?.full_name || 'Unknown Seller'}</Text>
                            <Text style={styles.sellerLocation}>Ships from Egypt</Text>
                        </View>
                    </View>
                    
                    <View style={styles.separator} />

                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{product.description}</Text>

                    {/* --- 3. NEW: Conditional rendering for action buttons --- */}
                    {isOwner ? (
                        // If you are the owner, show the "Edit Product" button
                        <TouchableOpacity 
                            style={styles.editButton} 
                            onPress={() => router.push(`/products/edit/${product.id}`)}
                        >
                            <Edit size={20} color="white" />
                            <Text style={styles.editButtonText}>Edit Your Listing</Text>
                        </TouchableOpacity>
                    ) : (
                        // Otherwise, show the "Buy" and "Contact" buttons
                        <>
                            <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow} disabled={isBuying}>
                                {isBuying ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.buyButtonText}>Buy Now</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contactButton} onPress={handleContactSeller}>
                                <MessageCircle size={20} color="#2563EB" />
                                <Text style={styles.contactButtonText}>Contact Seller</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'white' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sliderContainer: { width: width, height: width },
    slide: { width: width, height: width },
    mainImage: { width: '100%', height: '100%' },
    pagination: { position: 'absolute', bottom: 15, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.5)', marginHorizontal: 4 },
    activeDot: { backgroundColor: 'white' },
    contentContainer: { padding: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', flex: 1, marginRight: 16 },
    price: { fontSize: 28, fontWeight: 'bold', color: '#2563EB', marginBottom: 16 },
    actionsContainer: { flexDirection: 'row', gap: 16 },
    actionButton: { padding: 8 },
    separator: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
    sellerContainer: { flexDirection: 'row', alignItems: 'center' },
    sellerAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    sellerName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    sellerLocation: { fontSize: 14, color: '#6B7280' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1F2937' },
    description: { fontSize: 16, color: '#4B5563', lineHeight: 24 },
    buyButton: { backgroundColor: '#16A34A', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
    buyButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    contactButton: { flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderWidth: 1, borderColor: '#2563EB' },
    contactButtonText: { color: '#2563EB', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
    // --- 4. NEW STYLES for the Edit button ---
    editButton: {
        flexDirection: 'row',
        backgroundColor: '#4B5563', // A neutral gray
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
    },
    editButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
});