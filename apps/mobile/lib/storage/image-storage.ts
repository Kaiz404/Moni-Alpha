import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase/client';

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

/**
 * Copy a picked/captured image into the app's persistent documents directory.
 * Returns the new local file:// URI that survives cache clears.
 */
export async function saveImageLocally(sourceUri: string): Promise<string> {
  await ensureReceiptsDir();
  const ext = getExtension(sourceUri);
  const filename = `${randomUUID()}.${ext}`;
  const sourceFile = new File(sourceUri);
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
      console.warn('[ImageStorage] local file does not exist:', localUri);
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
            '[ImageStorage] Supabase Storage bucket `receipts` is missing. Run migration',
            '`supabase/migrations/20260323000000_storage_receipts_bucket.sql` (or create the bucket',
            'in Dashboard → Storage). Receipt uploads are skipped until then.',
          );
        }
        return null;
      }

      console.warn('[ImageStorage] upload error:', msg);
      return null;
    }

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(storagePath);

    return data.publicUrl;
  } catch (e) {
    console.warn('[ImageStorage] upload exception:', e);
    return null;
  }
}
