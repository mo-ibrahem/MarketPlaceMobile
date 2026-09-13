// In supabase/functions/delete-product-images/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ProductRecord {
  images: string[];
  seller_id: string;
}

const BUCKET_NAME = 'product-images';

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  // A user JWT alone cannot authorize service-role deletion. Only the trusted
  // database webhook may invoke this endpoint with its dedicated secret.
  const webhookSecret = Deno.env.get('PRODUCT_IMAGES_WEBHOOK_SECRET');
  if (!webhookSecret) return new Response('Webhook not configured', { status: 503 });
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const event = await req.json();
    if (event.type !== 'DELETE' || event.schema !== 'public' || event.table !== 'products') {
      return new Response('Invalid deletion event', { status: 400 });
    }
    const deletedProduct = event.old_record;
    if (!deletedProduct || !Array.isArray(deletedProduct.images) || typeof deletedProduct.seller_id !== 'string') {
      return new Response('Invalid product record', { status: 400 });
    }
    const product = deletedProduct as ProductRecord;

    if (!product.images || product.images.length === 0) {
      return new Response(JSON.stringify({ message: 'No images to delete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filePaths = product.images.map(url => {
      const parsed = new URL(url);
      if (parsed.origin !== new URL(Deno.env.get('SUPABASE_URL')!).origin) return null;
      const prefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
      if (!parsed.pathname.startsWith(prefix)) return null;
      const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
      if (!path || path.split('/').some(part => part === '..' || part === '.')) return null;
      return path;
    }).filter((path): path is string => !!path);

    if (filePaths.length === 0) {
      console.warn("Could not parse any file paths from the image URLs:", product.images);
      return new Response(JSON.stringify({ message: 'Could not parse file paths.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // A seller can attach another seller's public URL to their listing.
    // Authenticate the actual storage owner before performing admin deletion.
    const { data: ownedPaths, error: ownershipError } = await supabaseAdmin.rpc('product_image_cleanup_paths', {
      p_seller_id: product.seller_id, p_paths: filePaths,
    });
    if (ownershipError) throw ownershipError;
    if (!Array.isArray(ownedPaths) || ownedPaths.length === 0) {
      return new Response(JSON.stringify({ message: 'No owned images to delete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove(ownedPaths);

    if (error) {
      throw error;
    }

    console.log("Successfully deleted images:", filePaths);
    return new Response(JSON.stringify({ message: 'Images deleted successfully.', deletedFiles: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) { // 'error' is of type 'unknown'
    // --- THIS IS THE CORRECTED CATCH BLOCK ---
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error in delete-product-images function:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});