import { supabase } from './supabase';
import { getBlockedUserIds } from './moderationService';
import { displayName } from './displayName';

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
  /** The listing this conversation is about. Null on legacy rooms opened
   *  before conversations were scoped to items. */
  product_id?: string | null;
  product_title?: string;
  product_image?: string;
  product_price?: number;
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

  let { data: rooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('id, participant_ids, product_id')
    // delete-for-me: rooms this user hid stay out of their inbox without
    // touching the other side's view or the message history.
    .not('deleted_for', 'cs', `{${user.id}}`)
    .contains('participant_ids', [user.id]);

  if (roomsError) {
    console.error('Error fetching chat rooms:', roomsError);
    throw roomsError;
  }
  if (!rooms || rooms.length === 0) return [];

  // Guideline 1.2: conversations with people this user blocked stay out of
  // the inbox. The rows remain, so unblocking brings them back.
  const blocked = await getBlockedUserIds().catch(() => new Set<string>());
  rooms = rooms.filter(r => !r.participant_ids.some((p: string) => p !== user.id && blocked.has(p)));
  if (rooms.length === 0) return [];

  const otherUserIds = rooms
    .map(room => room.participant_ids.find((p_id: string) => p_id !== user.id))
    .filter(Boolean) as string[];
  const productIds = rooms.map(r => r.product_id).filter(Boolean) as string[];

  const [{ data: profiles }, { data: products }] = await Promise.all([
    // public_profiles, not user_profiles: the latter's only SELECT policy is
    // auth.uid() = id, so reading it returns nothing for the person you are
    // talking to -- every conversation showed as "Unknown User".
    otherUserIds.length
      ? supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', otherUserIds)
      : Promise.resolve({ data: [] as any[] }),
    productIds.length
      ? supabase.from('products').select('id, title, images').in('id', productIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

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
        if (msgs && msgs.length > 0) lastMessageMap[room.id] = msgs[0];
      } catch {
        // A missing preview must not drop the conversation from the inbox.
      }
    })
  );

  return rooms.map(room => {
    const otherUserId = room.participant_ids.find((p_id: string) => p_id !== user.id);
    const profile = (profiles as any[])?.find(p => p.id === otherUserId);
    const product = (products as any[])?.find(p => p.id === room.product_id);
    const lastMsg = lastMessageMap[room.id];

    return {
      room_id: room.id,
      other_user_id: otherUserId || '',
      other_user_name: displayName(profile?.full_name),
      other_user_avatar_url: profile?.avatar_url || '',
      product_id: room.product_id,
      product_title: product?.title,
      product_image: product?.images?.[0],
      last_message: lastMsg?.content,
      last_message_time: lastMsg?.created_at,
    };
  });
};

/**
 * One conversation per (buyer, seller, listing) -- not one per seller.
 *
 * Messaging a seller about a specific item opens a thread for that item, the
 * way the web app does it. Previously this matched on participants alone, so
 * every item a buyer asked about collapsed into a single thread with no way to
 * tell which listing a question referred to.
 *
 * `maybeSingle` matters: once a buyer has more than one room with the same
 * seller, the old `.single()` would throw on the multiple rows it found.
 */
export const getOrCreateChatRoom = async (otherUserId: string, productId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!productId) throw new Error('A product is required to start a conversation');

  const participants = [user.id, otherUserId].sort();

  const { data: existingRoom } = await supabase
    .from('chat_rooms')
    .select('id')
    .contains('participant_ids', participants)
    .eq('product_id', productId)
    .maybeSingle();

  if (existingRoom) return existingRoom.id;

  const { data: newRoom, error } = await supabase
    .from('chat_rooms')
    .insert({ participant_ids: participants, product_id: productId })
    .select('id')
    .single();

  if (error || !newRoom) throw error || new Error('Could not create chat room');
  return newRoom.id;
};

/**
 * Removes a room from the caller's own inbox only -- delete-for-me, not
 * delete-for-both. Chat history can matter to an escrow dispute, so nothing
 * here destroys data; the room resurfaces server-side if either side sends a
 * new message.
 */
export const hideChatRoomForUser = async (roomId: string): Promise<void> => {
  const { error } = await supabase.rpc('hide_chat_room_for_user', { p_room_id: roomId });
  if (error) throw error;
};

export const getChatRoomDetails = async (roomId: string): Promise<ChatRoomInfo | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .select('id, participant_ids, product_id')
    .eq('id', roomId)
    .maybeSingle();

  if (error || !room) return null;

  const otherUserId = room.participant_ids.find((p_id: string) => p_id !== user.id) || '';
  if (!otherUserId) return null;

  const [{ data: profile }, { data: product }] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, avatar_url').eq('id', otherUserId).maybeSingle(),
    room.product_id
      ? supabase.from('products').select('id, title, price, images').eq('id', room.product_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  return {
    room_id: room.id,
    other_user_id: otherUserId,
    other_user_name: displayName((profile as any)?.full_name),
    other_user_avatar_url: (profile as any)?.avatar_url || '',
    product_id: room.product_id,
    product_title: (product as any)?.title,
    product_image: (product as any)?.images?.[0],
    product_price: (product as any)?.price != null ? Number((product as any).price) : undefined,
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