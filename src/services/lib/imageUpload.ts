import type { ImagePickerAsset } from 'expo-image-picker';

/**
 * The storage buckets only accept image/jpeg, png, webp, gif, heic and heif
 * (allowed_mime_types on product-images, avatars, kyc-documents). Every
 * upload used to send `image/${extension}`, and an iPhone photo has the
 * extension "jpg" -- so it went up as "image/jpg", which the bucket rejects
 * with a bare 400 "bad request". Listing a product with a photo failed for
 * everyone in Expo Go and would have in the store build too.
 *
 * Prefer the picker's own mimeType; fall back to the extension with the
 * jpg -> jpeg / tif -> tiff aliases resolved; and never send a type the
 * bucket does not accept -- jpeg is the safe default since the picker
 * re-encodes with `quality` anyway.
 */
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
};

export function imageUploadType(asset: Pick<ImagePickerAsset, 'uri' | 'mimeType'>): { contentType: string; extension: string } {
  const fromPicker = asset.mimeType?.toLowerCase();
  const ext = asset.uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  const contentType = (fromPicker && ACCEPTED.has(fromPicker) ? fromPicker : BY_EXTENSION[ext]) ?? 'image/jpeg';
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length);
  return { contentType, extension };
}
