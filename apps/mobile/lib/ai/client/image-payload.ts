/**
 * Prepares receipt images for the AI backend: remote URLs pass through,
 * local files are compressed (and, defensively, downscaled) to keep the request small.
 */
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * ML Kit scans are normalized to ~1024px max edge in `normalize-scan.ts` before they reach
 * this payload builder — this cap only kicks in as a defensive fallback.
 */
const MAX_EDGE_FALLBACK_PX = 1024;
const JPEG_QUALITY = 0.7;

export type ImagePayload = { imageUrl: string } | { imageBase64: string } | null;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err ?? new Error('Image.getSize failed')),
    );
  });
}

export async function buildImagePayload(imageUri: string): Promise<ImagePayload> {
  const uri = imageUri.trim();
  if (!uri) return null;

  // Already uploaded to Supabase Storage — let the backend fetch it.
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return { imageUrl: uri };
  }

  try {
    const { width, height } = await getImageSize(uri);
    const actions =
      Math.max(width, height) > MAX_EDGE_FALLBACK_PX
        ? [
            {
              resize:
                width >= height
                  ? { width: MAX_EDGE_FALLBACK_PX }
                  : { height: MAX_EDGE_FALLBACK_PX },
            },
          ]
        : [];

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64) {
      return { imageBase64: result.base64 };
    }
    return null;
  } catch {
    return null;
  }
}
