/** A public URL the phone stored for an upload before the bucket went private (#72). */
const PUBLIC_URL = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/receipts\/(.+)$/;
const DEVICE_FILE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Where a stored receipt photo sits in the `receipts` bucket, from a capture's `source_image_uri` or a
 * transaction's `receipt_image_url`: a path as stored, or the path inside a public URL stored before
 * the bucket went private. Null when nothing is uploaded yet: no photo, or a file still on the phone.
 */
export function receiptPath(stored: string | null | undefined): string | null {
  const value = stored?.trim();
  if (!value) return null;
  const legacy = PUBLIC_URL.exec(value);
  if (legacy) return legacy[1]!;
  return DEVICE_FILE.test(value) ? null : value;
}
