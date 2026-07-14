import { LinearGradient } from 'expo-linear-gradient';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Baby, Home, LayoutGrid, Search, Shirt, Smartphone } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import EgbayLogo from '../../assets/images/egbay.svg';
import { useAuth } from '../../hooks/useAuth';
import { productService, type Product } from '../../src/services/lib/products';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    {
      id: 5,
      nameKey: 'home.categories.allCategories',
      icon: LayoutGrid,
      descKey: 'home.categoryDescriptions.allCategories',
    },
    {
      id: 1,
      nameKey: 'home.categories.electronics',
      icon: Smartphone,
      descKey: 'home.categoryDescriptions.electronics',
    },
    {
      id: 2,
      nameKey: 'home.categories.fashion',
      icon: Shirt,
      descKey: 'home.categoryDescriptions.fashion',
    },
    {
      id: 3,
      nameKey: 'home.categories.home',
      icon: Home,
      descKey: 'home.categoryDescriptions.home',
    },
    {
      id: 4,
      nameKey: 'home.categories.toys',
      icon: Baby,
      descKey: 'home.categoryDescriptions.toys',
    },
  ];

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load products on home screen:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const handleSearch = () => {
    if (searchQuery.trim() === '') return;
    // @ts-ignore
    router.push({ pathname: '/products', params: { search: searchQuery } });
  };

  const renderCategory = ({ item }: { item: (typeof categories)[0] }) => {
    const IconComponent = item.icon;
    const name = t(item.nameKey);

    const href =
      name === t('home.categories.allCategories')
        ? '/products'
        : `/products?category=${encodeURIComponent(name)}`;

    return (
      <Link href={href as any} asChild>
        <TouchableOpacity style={styles.categoryCard}>
          <View style={styles.categoryIconContainer}>
            <IconComponent color="#2563EB" size={28} />
          </View>
          <Text style={styles.categoryName}>{name}</Text>
          <Text style={styles.categoryDescription}>{t(item.descKey)}</Text>
        </TouchableOpacity>
      </Link>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView>
        <LinearGradient colors={['#3B82F6', '#8B5CF6']} style={styles.heroContainer}>
          <View style={styles.logoContainer}>
            <EgbayLogo width={220} height={80} />
          </View>
          <Text style={styles.heroSubtitle}>{t('home.heroSubtitle')}</Text>
          <View style={styles.searchContainer}>
            <Search style={styles.searchIcon} color="#6B7280" size={20} />
            <TextInput
              placeholder={t('home.searchPlaceholder')}
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
          <Text style={styles.sectionTitle}>{t('home.shopByCategory')}</Text>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.recentlyAdded')}</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" />
          ) : (
            <FlatList
              data={products.slice(0, 4)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productCard}
                  onPress={() => router.push(`/products/${item.id}`)}
                >
                  <Image
                    source={{
                      uri:
                        item.images?.[0] ||
                        'https://placehold.co/400x300/E2E8F0/4A5568?text=Image',
                    }}
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.productPrice}>
                      ${Number(item.price).toFixed(2)}
                    </Text>
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
    shadowColor: '#000',
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
    textAlign: 'center',
  },
  categoryDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
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