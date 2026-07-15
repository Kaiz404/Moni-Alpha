import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import { resizeImageToVisionMax } from './images';

/**
 * Copies an ML Kit scan result (often `content://`) into app cache and caps resolution
 * for the AI pipeline. ML Kit already perspective-corrects and filters the image.
 */
export async function normalizeScanUri(sourceUri: string): Promise<string> {
  const destination = new File(Paths.cache, `${randomUUID()}.jpg`);
  const source = new File(sourceUri);
  source.copy(destination);
  return resizeImageToVisionMax(destination.uri);
}
