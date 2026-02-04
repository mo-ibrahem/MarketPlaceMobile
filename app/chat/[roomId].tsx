import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { getMessages, sendMessage } from '../../src/services/lib/chatService';
import { supabase } from '../../src/services/lib/supabase';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      if (!roomId) return;
      setLoading(true);
      const data = await getMessages(roomId);
      setMessages(data || []);
      setLoading(false);
    };

    fetchMessages();

    // Set up Realtime subscription
    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prevMessages) => [...prevMessages, payload.new]);
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);
  
  const handleSend = async () => {
    if (newMessage.trim() === '' || !roomId) return;
    const content = newMessage.trim();
    setNewMessage('');
    await sendMessage(roomId, content);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.sender_id === user?.id ? styles.myMessage : styles.theirMessage
          ]}>
            <Text style={item.sender_id === user?.id ? styles.myMessageText : styles.theirMessageText}>
              {item.content}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Send color="white" size={20} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'white' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 10 },
    messageBubble: {
        padding: 12,
        borderRadius: 18,
        maxWidth: '75%',
        marginBottom: 10,
    },
    myMessage: {
        backgroundColor: '#2563EB',
        alignSelf: 'flex-end',
    },
    theirMessage: {
        backgroundColor: '#E5E7EB',
        alignSelf: 'flex-start',
    },
    myMessageText: { color: 'white' },
    theirMessageText: { color: '#1F2937' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#E5E7EB',
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
});