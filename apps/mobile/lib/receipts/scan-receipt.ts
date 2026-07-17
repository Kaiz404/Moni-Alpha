import { Alert, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { scanDocument } from 'moni-document-scanner';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { enqueue, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';
import { getUserId } from '@/lib/supabase/client';

import {
  startFabReceiptProcessing,
  stopFabReceiptProcessing,
  waitForReceiptProposal,
} from './fab-receipt-processing';
import { saveImageLocally } from './images';
import { normalizeScanUri } from './normalize-scan';
import { enqueueImageUpload } from './upload-queue';

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

/** Queues a processed receipt image through the AI extraction pipeline. Returns the proposal id. */
export async function queueReceiptImage(uri: string): Promise<string> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const [locationSnapshot, localUri] = await Promise.all([
    captureLocationSnapshot(),
    saveImageLocally(uri),
  ]);

  const queueItem: ProcessingQueueItem = {
    id,
    type: 'image',
    imageUri: localUri,
    createdAt,
    status: 'pending',
    locationSnapshot,
  };
  enqueue(queueItem);

  try {
    const userId = await getUserId();
    if (userId) enqueueImageUpload({ proposalId: id, localUri, userId });
  } catch {
    // non-critical — upload queue will retry on its own
  }

  startBackgroundProcessor().catch((e) =>
    console.warn(TAG, 'Background processor start failed:', e),
  );
  return id;
}

/** FAB-only flow: scan → queue → show processing overlay until the proposal sheet appears. */
export async function runFabReceiptScan(): Promise<void> {
  const uri = await scanAndNormalizeReceipt();
  if (!uri) return;

  let proposalId: string | null = null;
  try {
    proposalId = await queueReceiptImage(uri);
    startFabReceiptProcessing(proposalId);

    const result = await waitForReceiptProposal(proposalId);
    if (result === 'error' || result === 'timeout') {
      stopFabReceiptProcessing();
      Alert.alert("Couldn't read receipt", 'Please try again.');
    }
  } catch (e) {
    console.warn(TAG, 'Failed to queue receipt:', e);
    stopFabReceiptProcessing();
    Alert.alert("Couldn't read receipt", 'Please try again.');
  }
}
