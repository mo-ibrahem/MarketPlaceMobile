import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productService, type Product } from '../src/services/lib/products';

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  
  // FIX #1: Read BOTH category and search from the URL parameters
  const { category, search } = useLocalSearchParams<{ category?: string, search?: string }>();

   const fetchProducts = useCallback(async () => {
    try {
      const filters = { category, search };
      const data = await productService.getProducts(filters);
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  }, [category, search]);

  // This useEffect now just handles the initial screen load.
  useEffect(() => {
    setLoading(true);
    fetchProducts().finally(() => setLoading(false));
  }, [fetchProducts]);

  // This is the new function that will be called when the user pulls down.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading Products...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {/* FIX #4: Display a dynamic title for search results or categories */}
      <Text style={styles.headerTitle}>{search ? `Results for "${search}"` : (category || 'All Products')}</Text>
      
      <FlatList
       refreshControl={
      <RefreshControl 
        refreshing={refreshing} 
        onRefresh={onRefresh} 
        tintColor="#2563EB" // This sets the color of the spinner
      />
    }
        data={products}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={() => (
          !loading && <Text style={styles.emptyText}>No products found.</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.productCard} 
            onPress={() => router.push(`/products/${item.id}`)}
          >
            <Image 
              source={{ uri: item.images?.[0] || 'https://placehold.co/400x300/E2E8F0/4A5568?text=Image' }} 
              style={styles.productImage} 
            />
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.sellerName}>
                Sold by {item.seller?.full_name || 'Unknown Seller'}
              </Text>
              <Text style={styles.productPrice}>${Number(item.price).toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#4B5563',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 16,
    color: '#1F2937',
  },
  listContainer: {
    paddingHorizontal: 8,
  },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    minHeight: 38, // Ensures consistent card height even with one-line titles
  },
  sellerName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#6B7280',
  },
});