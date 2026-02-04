import { supabase } from './supabase';

export interface ChatRoomInfo {
  room_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar_url: string;
}

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

  const chatRoomInfo = rooms.map(room => {
    const otherUserId = room.participant_ids.find((p_id: string) => p_id !== user.id);
    const otherUserProfile = profiles?.find(p => p.id === otherUserId);
    
    return {
      room_id: room.id,
      other_user_id: otherUserId || '',
      other_user_name: otherUserProfile?.full_name || 'Unknown User',
      other_user_avatar_url: otherUserProfile?.avatar_url || '',
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

// --- ADDED BACK: Your essential message functions ---

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