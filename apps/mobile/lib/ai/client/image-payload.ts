/**
 * Prepares receipt images for the AI backend: remote URLs pass through,
 * local files are downscaled + compressed to keep the request small.
 */
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.7;

export type ImagePayload =
  | { imageUrl: string }
  | { imageBase64: string }
  | null;

export async function buildImagePayload(imageUri: string): Promise<ImagePayload> {
  const uri = imageUri.trim();
  if (!uri) return null;

  // Already uploaded to Supabase Storage — let the backend fetch it.
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return { imageUrl: uri };
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_WIDTH } }],
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    if (result.base64) {
      return { imageBase64: result.base64 };
    }
    return null;
  } catch {
    return null;
  }
}
