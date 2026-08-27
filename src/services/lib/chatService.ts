import { supabase } from './supabase';

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatRoomInfo {
  room_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar_url: string;
  last_message?: string;
  last_message_time?: string;
}

export type ChatRoomDetails = ChatRoomInfo;

export const subscribeToMessages = (roomId: string, onNewMessage: (msg: ChatMessage) => void) => {
  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new as ChatMessage);
        }
      }
    )
    .subscribe();
};

export const getChatRooms = async (): Promise<ChatRoomInfo[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('id, participant_ids')
    .contains('participant_ids', [user.id]);

  if (roomsError) {
    console.error("Error fetching chat rooms:", roomsError);
    throw roomsError;
  }
  if (!rooms || rooms.length === 0) {
    return [];
  }

  const otherUserIds = rooms.map(room => {
    return room.participant_ids.find((p_id: string) => p_id !== user.id);
  }).filter(id => id);

  if (otherUserIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url')
    .in('id', otherUserIds);

  if (profilesError) {
    console.error("Error fetching participant profiles:", profilesError);
    throw profilesError;
  }

  // Fetch last message for each room
  const lastMessageMap: Record<string, { content: string; created_at: string }> = {};
  await Promise.all(
    rooms.map(async (room) => {
      try {
        const { data: msgs } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (msgs && msgs.length > 0) {
          lastMessageMap[room.id] = msgs[0];
        }
      } catch {
        // silently ignore
      }
    })
  );

  const chatRoomInfo = rooms.map(room => {
    const otherUserId = room.participant_ids.find((p_id: string) => p_id !== user.id);
    const otherUserProfile = profiles?.find(p => p.id === otherUserId);
    const lastMsg = lastMessageMap[room.id];
    
    return {
      room_id: room.id,
      other_user_id: otherUserId || '',
      other_user_name: otherUserProfile?.full_name || 'Unknown User',
      other_user_avatar_url: otherUserProfile?.avatar_url || '',
      last_message: lastMsg?.content,
      last_message_time: lastMsg?.created_at,
    };
  });

  return chatRoomInfo;
};

export const getOrCreateChatRoom = async (otherUserId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");
  const participants = [user.id, otherUserId].sort();
  const { data: existingRoom } = await supabase.from('chat_rooms').select('id').contains('participant_ids', participants).single();
  if (existingRoom) return existingRoom.id;
  const { data: newRoom } = await supabase.from('chat_rooms').insert({ participant_ids: participants }).select('id').single();
  if (!newRoom) throw new Error("Could not create chat room");
  return newRoom.id;
};

export const getChatRoomDetails = async (roomId: string): Promise<ChatRoomInfo | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .select('id, participant_ids')
    .eq('id', roomId)
    .single();

  if (error || !room) return null;

  const otherUserId = room.participant_ids.find((p_id: string) => p_id !== user.id) || '';
  if (!otherUserId) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url')
    .eq('id', otherUserId)
    .single();

  return {
    room_id: room.id,
    other_user_id: otherUserId,
    other_user_name: profile?.full_name || 'Egyptian Trader',
    other_user_avatar_url: profile?.avatar_url || '',
  };
};

// --- Message functions ---

// Function to send a new message
export const sendMessage = async (roomId: string, content: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
        .from('messages')
        .insert({ room_id: roomId, sender_id: user.id, content });

    if (error) throw error;
    return data;
};

// Function to fetch all messages for a room
export const getMessages = async (roomId: string) => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
        
    if (error) throw error;
    return data;
}