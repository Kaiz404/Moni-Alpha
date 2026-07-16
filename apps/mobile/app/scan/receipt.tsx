import { useEffect } from 'react';
import { router } from 'expo-router';

import { queueReceiptImage, scanAndNormalizeReceipt } from '@/lib/receipts/scan-receipt';

const TAG = '[Moni/Scan]';

/** iOS fallback route and deep-link entry — launches ML Kit without an intermediate screen. */
export default function ScanReceiptScreen() {
  useEffect(() => {
    void (async () => {
      const uri = await scanAndNormalizeReceipt();
      router.back();
      if (!uri) return;
      try {
        await queueReceiptImage(uri);
      } catch (e) {
        console.warn(TAG, 'Failed to queue receipt:', e);
      }
    })();
  }, []);

  return null;
}
