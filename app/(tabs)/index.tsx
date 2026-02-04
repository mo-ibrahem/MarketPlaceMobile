import { LinearGradient } from 'expo-linear-gradient';
import { Link, useFocusEffect, useRouter } from 'expo-router'; // 1. Import useFocusEffect
import { Baby, Home, LayoutGrid, Search, Shirt, Smartphone } from 'lucide-react-native';
import React, { useCallback, useState } from 'react'; // 2. Import useCallback
import {
  ActivityIndicator,
  FlatList, // 3. Import ActivityIndicator for loading
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EgbayLogo from '../../assets/images/egbay.svg';
import { useAuth } from '../../hooks/useAuth';
// 5. Import your product service and types
import { productService, type Product } from '../../src/services/lib/products';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  // --- NEW: State for your products ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 5, name: "All Categories", icon: LayoutGrid, description: "Browse all our products" },
    { id: 1, name: "Electronics", icon: Smartphone, description: "Latest gadgets and tech" },
    { id: 2, name: "Fashion", icon: Shirt, description: "Clothing and accessories" },
    { id: 3, name: "Home", icon: Home, description: "Home and garden essentials" },
    { id: 4, name: "Toys", icon: Baby, description: "Fun for all ages" },
  ];

  // --- NEW: Function to load products ---
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      setProducts(data || []);
    } catch (error) {
      console.error("Failed to load products on home screen:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- NEW: This hook automatically re-runs when the screen is focused ---
  useFocusEffect(
    useCallback(() => {
      // This will now reload the product list every time you come back to the home screen
      loadProducts();
    }, [loadProducts])
  );

  const handleSearch = () => {
    if (searchQuery.trim() === '') return;
    // @ts-ignore
    router.push({ pathname: '/products', params: { search: searchQuery } });
  };

const renderCategory = ({ item }: { item: typeof categories[0] }) => {
    const IconComponent = item.icon;
    
    const href = item.name === "All Categories" 
      ? '/products' 
      : `/products?category=${item.name}`;

    return (
      // The 'as any' here tells the editor to ignore the "fake" error.
      <Link href={href as any} asChild>
        <TouchableOpacity style={styles.categoryCard}>
          <View style={styles.categoryIconContainer}>
            <IconComponent color="#2563EB" size={28} />
          </View>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryDescription}>{item.description}</Text>
        </TouchableOpacity>
      </Link>
    );
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView>
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.heroContainer}
        >
          <View style={styles.logoContainer}>
            <EgbayLogo width={220} height={80} />
          </View>
          <Text style={styles.heroSubtitle}>
            Discover amazing deals on thousands of items
          </Text>
          <View style={styles.searchContainer}>
            <Search style={styles.searchIcon} color="#6B7280" size={20} />
            <TextInput
              placeholder="What are you looking for?"
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            scrollEnabled={false}
          />
        </View>

        {/* --- NEW: Section for Recently Added Products --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Added</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" />
          ) : (
            <FlatList
              data={products.slice(0, 4)} // Show only the first 4 products
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productCard} onPress={() => router.push(`/products/${item.id}`)}>
                  <Image source={{ uri: item.images?.[0] || 'https://placehold.co/400x300/E2E8F0/4A5568?text=Image' }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.productPrice}>${Number(item.price).toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  heroContainer: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#E0E7FF',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#1F2937',
  },
  section: {
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  categoryCard: {
    flex: 1,
    margin: 8,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // NEW STYLES for the "Recently Added" section
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
    overflow: 'hidden'
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
  },
  productInfo: {
    padding: 10,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
    marginTop: 4,
  },
});