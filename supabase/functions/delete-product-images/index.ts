import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
 status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
Deno.serve(async (req: Request) => {
 if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
 const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if (!url || !key) return reply(503, { error: 'Cleanup unavailable' });
 const admin = createClient(url, key);
 const workerSecret = req.headers.get('x-cleanup-secret');
 if (workerSecret) {
   const { data, error } = await admin.rpc('authorize_cleanup_worker', { p_secret: workerSecret });
   if (error) return reply(503, { error: 'Cleanup unavailable' });
   if (data !== true) return reply(401, { error: 'Unauthorized' });
 } else {
   const secret = Deno.env.get('PRODUCT_IMAGES_WEBHOOK_SECRET');
   if (!secret) return reply(503, { error: 'Webhook not configured' });
   if (req.headers.get('x-webhook-secret') !== secret) return reply(401, { error: 'Unauthorized' });
 }
 async function clean(record: { seller_id: string; images: string[] }) {
   const paths: string[] = [];
   for (const value of record.images) {
     try {
       const image = new URL(value), prefix = '/storage/v1/object/public/product-images/';
       if (image.origin !== new URL(url!).origin || !image.pathname.startsWith(prefix)) continue;
       const path = decodeURIComponent(image.pathname.slice(prefix.length));
       if (path && !path.split('/').some(part => part === '.' || part === '..')) paths.push(path);
     } catch { /* Malformed URLs never select storage objects. */ }
   }
   if (!paths.length) return;
   const { data: owned, error } = await admin.rpc('product_image_cleanup_paths', { p_seller_id: record.seller_id, p_paths: paths });
   if (error) throw error;
   if (!Array.isArray(owned)) throw new Error('Invalid ownership response');
   if (!owned.length) return;
   const { error: removalError } = await admin.storage.from('product-images').remove(owned);
   if (removalError) throw removalError;
 }
 if (workerSecret) {
   const { data: jobs, error } = await admin.rpc('claim_product_image_cleanups');
   if (error) return reply(503, { error: 'Cleanup unavailable' });
   let failed = false;
   for (const job of jobs ?? []) {
     try {
       await clean(job.old_record);
       const { error: ackError } = await admin.from('product_image_cleanup_jobs').delete().eq('id', job.id);
       if (ackError) throw ackError;
     } catch {
       failed = true;
       await admin.from('product_image_cleanup_jobs').update({ lease_until: null }).eq('id', job.id);
     }
   }
   return reply(failed ? 503 : 200, { status: failed ? 'retry_required' : 'processed' });
 }
 let event;
 try { event = await req.json(); } catch { return reply(400, { error: 'Invalid JSON' }); }
 if (event.type !== 'DELETE' || event.schema !== 'public' || event.table !== 'products' ||
 !Array.isArray(event.old_record?.images) || typeof event.old_record?.seller_id !== 'string') return reply(400, { error: 'Invalid deletion event' });
 try {
   await clean(event.old_record);
   return reply(200, { status: 'processed' });
 } catch { return reply(503, { error: 'Cleanup temporarily unavailable; retry required' }); }
});
