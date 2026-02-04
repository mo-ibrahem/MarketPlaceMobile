// In supabase/functions/delete-product-images/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ProductRecord {
  images: string[];
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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record: deletedProduct } = await req.json();
    const product = deletedProduct as ProductRecord;

    if (!product.images || product.images.length === 0) {
      return new Response(JSON.stringify({ message: 'No images to delete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filePaths = product.images.map(url => {
      const { pathname } = new URL(url);
      const path = pathname.split(`/${BUCKET_NAME}/`)[1];
      return path;
    }).filter(path => path);

    if (filePaths.length === 0) {
      console.warn("Could not parse any file paths from the image URLs:", product.images);
      return new Response(JSON.stringify({ message: 'Could not parse file paths.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

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