import { useFocusEffect, useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { ProductCard } from '../../src/components/ProductCard';
import { color, font, space, weight } from '../../src/design/tokens';
import { productService, type Product } from '../../src/services/lib/products';

/**
 * The approved build's "Saved" tab. Wishlisting already existed (the heart
 * toggle on every card, productService.getWishlist) but had nowhere of its
 * own to be reviewed -- this is that page, not a new feature.
 */
export default function SavedScreen() {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await productService.getWishlist();
      setItems(data);
    } catch (e) {
      console.error('[Saved] load failed', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      load().finally(() => { if (mounted) setLoading(false); });
      return () => { mounted = false; };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleWishlist = async (product: Product) => {
    setItems(prev => prev.filter(p => p.id !== product.id));
    try {
      await productService.removeFromWishlist(product.id);
    } catch {
      // Put it back -- the removal did not actually happen.
      load();
    }
  };

  const T = isRTL
    ? { title: 'المحفوظات', empty: 'لا شيء محفوظ بعد', emptySub: 'اضغط القلب على أي إعلان لحفظه هنا.' }
    : { title: 'Saved', empty: 'Nothing saved yet', emptySub: 'Tap the heart on any listing to keep it here.' };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{T.title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={color.action} /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Heart color={color.textFaint} size={28} /></View>
          <Text style={s.emptyTitle}>{T.empty}</Text>
          <Text style={s.emptySub}>{T.emptySub}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.md, paddingHorizontal: space.lg }}
          contentContainerStyle={{ gap: space.md, paddingTop: space.md, paddingBottom: space.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.action} />}
          renderItem={({ item }) => (
            <ProductCard
              item={item}
              isWishlisted
              onPress={() => router.push(`/products/${item.id}`)}
              onToggleWishlist={() => toggleWishlist(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.surface },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  title: { fontSize: font.title1, fontWeight: weight.heavy as any, letterSpacing: -1.2, color: color.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxxl, gap: space.xs },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: color.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.md,
  },
  emptyTitle: { fontSize: font.subhead, fontWeight: weight.bold as any, color: color.text },
  emptySub: { fontSize: font.footnote, color: color.textFaint, textAlign: 'center', marginTop: space.xs, lineHeight: 18 },
});
