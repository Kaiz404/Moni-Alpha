import { Alert, Platform } from 'react-native';
import { scanDocument } from 'moni-document-scanner';

import { normalizeScanUri } from './normalize-scan';

const TAG = '[ScanReceipt]';

/**
 * Opens Google ML Kit's native document scanner and returns a normalized cache URI.
 * Returns null when the user cancels or scanning is unavailable.
 */
export async function scanAndNormalizeReceipt(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    Alert.alert('Not available', 'Receipt scanning is only available on Android.');
    return null;
  }

  try {
    const result = await scanDocument({
      maxNumDocuments: 1,
      scannerMode: 'full',
      galleryImportAllowed: true,
    });

    const pageUri = result.pages[0]?.uri;
    if (!pageUri) {
      Alert.alert("Couldn't scan receipt", 'No image was returned. Please try again.');
      return null;
    }

    return await normalizeScanUri(pageUri);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes('cancel')) {
      return null;
    }
    console.warn(TAG, 'scan failed:', e);
    Alert.alert("Couldn't scan receipt", 'Please try again.');
    return null;
  }
}
