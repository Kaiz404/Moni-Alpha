import type { ScanOptions, ScanResult, ScannedPage, ScannerMode } from './MoniDocumentScanner.nitro';

export type { ScanOptions, ScanResult, ScannedPage, ScannerMode };

/** iOS/web stub — Android-only module. */
export function scanDocument(_options: ScanOptions = {}): Promise<ScanResult> {
  return Promise.reject(new Error('moni-document-scanner is only available on Android'));
}
