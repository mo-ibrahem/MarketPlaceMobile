import { supabase } from './supabase';

/**
 * The curated product-model catalogue.
 *
 * A sealed iPhone 15 Pro Max in Blue Titanium looks the same in every
 * box, so a listing for one can show a catalogue photograph of the model
 * rather than making the seller photograph a box. A *used* one cannot:
 * its condition is the thing the buyer is judging, and the database
 * refuses that combination outright (products_photos_or_model_check).
 *
 * Every catalogue photo carries the credit its licence requires, and the
 * UI renders that credit wherever the photo appears.
 */
export interface ModelPhoto {
  url: string;
  credit: string;
  license: string;
  source_url: string | null;
  variant: string | null;
}

export interface ProductModel {
  id: string;
  name: string;
  brand: string;
  category: string;
  variants: string[];
}

export interface ModelWithPhotos extends ProductModel {
  photos: ModelPhoto[];
}

/** Type-ahead for the sell form's model picker. */
export async function searchModels(query: string, limit = 12): Promise<ProductModel[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('product_models')
    .select('id, name, brand, category, variants')
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    .limit(limit);
  if (error) { console.warn('[models] search failed', error); return []; }
  return (data ?? []) as ProductModel[];
}

/** Photos for one model, preferring the ones tagged with this variant. */
export async function getModelPhotos(modelId: string, variant?: string | null): Promise<ModelPhoto[]> {
  const { data, error } = await supabase
    .from('product_model_photos')
    .select('url, credit, license, source_url, variant')
    .eq('model_id', modelId)
    .order('position', { ascending: true });
  if (error || !data) return [];
  const photos = data as ModelPhoto[];
  const forVariant = variant ? photos.filter(p => p.variant === variant) : [];
  return forVariant.length ? forVariant : photos.filter(p => !p.variant);
}

/**
 * Photos to show for a listing, and whether they are the seller's own.
 * A listing's own photographs always win; the catalogue is the fallback
 * and is always labelled as such.
 */
export async function resolveListingPhotos(product: {
  images?: string[] | null;
  model_id?: string | null;
  variant?: string | null;
}): Promise<{ urls: string[]; fromCatalogue: boolean; credit: string | null }> {
  if (product.images?.length) {
    return { urls: product.images, fromCatalogue: false, credit: null };
  }
  if (!product.model_id) return { urls: [], fromCatalogue: false, credit: null };
  const photos = await getModelPhotos(product.model_id, product.variant);
  return {
    urls: photos.map(p => p.url),
    fromCatalogue: photos.length > 0,
    credit: photos[0]?.credit ?? null,
  };
}
