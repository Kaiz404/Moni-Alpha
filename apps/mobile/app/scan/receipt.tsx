import { useEffect } from 'react';
import { router } from 'expo-router';

import { runFabReceiptScan } from '@/lib/receipts/scan-receipt';

/**
 * Deep-link/fallback entry to the same explicit receipt-review flow used by
 * the capture launcher. The scanner itself remains Android-native; unsupported
 * platforms receive the existing clear availability message.
 */
export default function ScanReceiptScreen() {
  useEffect(() => {
    void runFabReceiptScan().finally(() => router.back());
  }, []);

  return null;
}
