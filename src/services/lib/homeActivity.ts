import { supabase } from './supabase';
import { displayName } from './displayName';

/**
 * The home screen's "while you were away" header -- real recent replies,
 * not staged copy. A room counts as an unanswered reply when the newest
 * message in it is from the other person and landed in the last 24 hours;
 * there is no read-receipt column to know precisely "since you last
 * opened the app", so this is the honest proxy: recent, and not yet
 * something you sent yourself.
 */
export interface RecentReply {
  room_id: string;
  other_user_name: string;
  other_user_avatar_url: string;
  message: string;
  created_at: string;
  product_id: string | null;
  product_title?: string;
  is_offer: boolean;
  offer_amount_egp?: number | null;
}

const AWAY_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function getRecentReplies(limit = 2): Promise<RecentReply[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('id, participant_ids, product_id')
    .not('deleted_for', 'cs', `{${user.id}}`)
    .contains('participant_ids', [user.id])
    .limit(40);
  if (roomsError || !rooms?.length) return [];

  const since = new Date(Date.now() - AWAY_WINDOW_MS).toISOString();
  const results = await Promise.all(
    rooms.map(async (room) => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('sender_id, content, created_at, msg_type, offer_amount_egp')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const last = msgs?.[0];
      if (!last || last.sender_id === user.id || last.created_at < since) return null;
      const otherId = room.participant_ids.find((p: string) => p !== user.id);
      if (!otherId) return null;
      return { room, last, otherId };
    })
  );

  const hits = results.filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at))
    .slice(0, limit);
  if (hits.length === 0) return [];

  const otherIds = [...new Set(hits.map(h => h.otherId))];
  const productIds = [...new Set(hits.map(h => h.room.product_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', otherIds),
    productIds.length
      ? supabase.from('products').select('id, title').in('id', productIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return hits.map(({ room, last, otherId }) => {
    const profile = (profiles as any[])?.find(p => p.id === otherId);
    const product = (products as any[])?.find(p => p.id === room.product_id);
    return {
      room_id: room.id,
      other_user_name: displayName(profile?.full_name),
      other_user_avatar_url: profile?.avatar_url || '',
      message: last.content,
      created_at: last.created_at,
      product_id: room.product_id,
      product_title: product?.title,
      is_offer: last.msg_type === 'offer',
      offer_amount_egp: last.offer_amount_egp,
    };
  });
}
