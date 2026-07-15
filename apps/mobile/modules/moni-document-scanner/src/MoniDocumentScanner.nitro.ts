import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Controls the ML Kit scanner UI feature set (Android only).
 *
 * - 'full' → auto edge-detect + auto-capture + manual shutter + image filters
 * - 'base' → manual shutter only, no image filters
 * - 'base_with_filter' → manual shutter + image filters
 */
export type ScannerMode = 'full' | 'base' | 'base_with_filter';

export interface ScanOptions {
  /** Maximum pages per session. Default: 1 (receipt use case). */
  maxNumDocuments?: number;
  /** Show gallery import in ML Kit UI. Default: true. */
  galleryImportAllowed?: boolean;
  /** Scanner UI feature set. Default: 'full'. */
  scannerMode?: ScannerMode;
}

export interface ScannedPage {
  uri: string;
}

export interface ScanResult {
  pages: ScannedPage[];
}

export interface MoniDocumentScanner extends HybridObject<{
  android: 'kotlin';
}> {
  scanDocument(options: ScanOptions): Promise<ScanResult>;
}
