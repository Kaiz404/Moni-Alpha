import { NitroModules } from 'react-native-nitro-modules';

import type {
  MoniDocumentScanner,
  ScanOptions,
  ScanResult,
  ScannedPage,
  ScannerMode,
} from './MoniDocumentScanner.nitro';

export type { ScanOptions, ScanResult, ScannedPage, ScannerMode };

let scanner: MoniDocumentScanner | undefined;

function getScanner(): MoniDocumentScanner {
  if (scanner == null) {
    scanner = NitroModules.createHybridObject<MoniDocumentScanner>('MoniDocumentScanner');
  }
  return scanner;
}

export function scanDocument(options: ScanOptions = {}): Promise<ScanResult> {
  return getScanner().scanDocument({
    maxNumDocuments: options.maxNumDocuments ?? 1,
    galleryImportAllowed: options.galleryImportAllowed ?? true,
    scannerMode: options.scannerMode ?? 'full',
  });
}
