import { Image } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase/client';

/**
 * Longer edge cap for on-device VL / native vision — avoids OOM and timeouts on huge photos.
 * `ReceiptCamera` (components/receipt/receipt-camera.tsx) already crops + document-scan-filters
 * + resizes every camera/gallery image to this size before it ever reaches `saveImageLocally`,
 * so this resize is normally a no-op; it stays as a defensive fallback for any other caller.
 */
export const VISION_MAX_EDGE_PX = 1024;

/** Avoid spamming the console when the Supabase project has no `receipts` bucket yet. */
let receiptsBucketMissingLogged = false;

const RECEIPTS_DIR = new Directory(Paths.document, 'receipts');
const DEFAULT_EXT = 'jpg';
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

async function ensureReceiptsDir() {
  RECEIPTS_DIR.create({ idempotent: true, intermediates: true });
}

function getExtension(input: string): string {
  const cleanPath = input.split('?')[0] ?? '';
  const rawExt = cleanPath.split('.').pop()?.toLowerCase();
  if (!rawExt) return DEFAULT_EXT;
  return rawExt in EXT_TO_MIME ? rawExt : DEFAULT_EXT;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err ?? new Error('Image.getSize failed')),
    );
  });
}

/**
 * Downscale so the image fits inside VISION_MAX_EDGE_PX × VISION_MAX_EDGE_PX (aspect ratio kept).
 * Returns the original URI if already within bounds.
 */
export async function resizeImageToVisionMax(sourceUri: string): Promise<string> {
  try {
    const { width: w, height: h } = await getImageSize(sourceUri);
    if (w <= VISION_MAX_EDGE_PX && h <= VISION_MAX_EDGE_PX) {
      return sourceUri;
    }
    const actions =
      w >= h
        ? [{ resize: { width: VISION_MAX_EDGE_PX } }]
        : [{ resize: { height: VISION_MAX_EDGE_PX } }];

    const result = await manipulateAsync(sourceUri, actions, {
      compress: 0.88,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (e) {
    console.warn('[ReceiptImages] resizeImageToVisionMax failed, trying width-only fallback:', e);
    try {
      const result = await manipulateAsync(
        sourceUri,
        [{ resize: { width: VISION_MAX_EDGE_PX } }],
        { compress: 0.88, format: SaveFormat.JPEG },
      );
      return result.uri;
    } catch (e2) {
      console.warn('[ReceiptImages] resize fallback failed, using original:', e2);
      return sourceUri;
    }
  }
}

/**
 * Copy a picked/captured image into the app's persistent documents directory.
 * Images are downscaled to fit inside {@link VISION_MAX_EDGE_PX}² before save so the LLM and uploads
 * never see extreme resolutions.
 */
export async function saveImageLocally(sourceUri: string): Promise<string> {
  await ensureReceiptsDir();
  const processedUri = await resizeImageToVisionMax(sourceUri);
  const wasResized = processedUri !== sourceUri;
  const ext = wasResized ? 'jpg' : getExtension(sourceUri);
  const filename = `${randomUUID()}.${ext}`;
  const sourceFile = new File(processedUri);
  const destinationFile = new File(RECEIPTS_DIR, filename);
  sourceFile.copy(destinationFile);
  return destinationFile.uri;
}

/**
 * Upload a local receipt image to Supabase Storage.
 * Bucket: `receipts`, path: `{userId}/{proposalId}.jpg`
 * Returns the public/signed URL on success, or null on failure.
 */
export async function uploadReceiptImage(
  localUri: string,
  userId: string,
  proposalId: string,
): Promise<string | null> {
  try {
    const localFile = new File(localUri);
    if (!localFile.exists) {
      console.warn('[ReceiptImages] local file does not exist:', localUri);
      return null;
    }

    const ext = getExtension(localFile.name || localUri);
    const storagePath = `${userId}/${proposalId}.${ext}`;
    const bytes = await localFile.bytes();

    const { error } = await supabase.storage
      .from('receipts')
      .upload(storagePath, bytes, {
        contentType: EXT_TO_MIME[ext] ?? 'image/jpeg',
        upsert: true,
      });

    if (error) {
      const msg = error.message ?? String(error);
      const bucketMissing = /bucket not found/i.test(msg);

      if (bucketMissing) {
        if (!receiptsBucketMissingLogged) {
          receiptsBucketMissingLogged = true;
          console.warn(
            '[ReceiptImages] Supabase Storage bucket `receipts` is missing. Run migration',
            '`supabase/migrations/20260323000000_storage_receipts_bucket.sql` (or create the bucket',
            'in Dashboard → Storage). Receipt uploads are skipped until then.',
          );
        }
        return null;
      }

      console.warn('[ReceiptImages] upload error:', msg);
      return null;
    }

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(storagePath);

    return data.publicUrl;
  } catch (e) {
    console.warn('[ReceiptImages] upload exception:', e);
    return null;
  }
}
