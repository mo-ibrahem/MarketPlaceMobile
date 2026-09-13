import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getChatRooms, type ChatRoomInfo } from '../services/lib/chatService';

/**
 * The chat inbox, extracted from app/(tabs)/explore.tsx so it can be shown
 * both as its own tab (classifieds mode, where chat is the core flow -- see
 * PLAN-CLASSIFIEDS-MODE.md) and as Profile's "Chats" sub-tab (payments mode).
 * Same data, same rows, same navigation target; only where it's mounted differs.
 */

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

export function useChatRooms() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setChatRooms([]); setLoading(false); return; }
    try {
      const chats = await getChatRooms();
      setChatRooms(chats || []);
    } catch (e) {
      console.error('ChatList: load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { chatRooms, loading, reload };
}

export function ChatList({ chatRooms, loading }: { chatRooms: ChatRoomInfo[]; loading?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color="#6366F1" />
      </View>
    );
  }

  if (chatRooms.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyTitle}>{t('chat.noConversations')}</Text>
        <Text style={styles.emptySubtitle}>{t('chat.startConversation')}</Text>
      </View>
    );
  }

  return (
    <View>
      {chatRooms.map(chat => (
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
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
});
