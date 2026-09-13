import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { ChatList, useChatRooms } from '../../src/components/ChatList';

/**
 * Chat as a top-level tab. In classifieds mode (PAYMENTS_ENABLED = false,
 * see PLAN-CLASSIFIEDS-MODE.md) this IS the core flow -- buyers and sellers
 * find each other in listings, then talk here -- so it gets its own tab
 * instead of living inside Profile's "Chats" sub-tab. That sub-tab is left
 * in place for when payments come back and this tab is hidden again
 * ((tabs)/_layout.tsx gates both on the same flag).
 */
export default function ChatsTabScreen() {
  const { isRTL } = useLanguage();
  const { chatRooms, loading, reload } = useChatRooms();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{isRTL ? 'الدردشات' : 'Chats'}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
      >
        <ChatList chatRooms={chatRooms} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A', letterSpacing: -0.8 },
  content: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
});
