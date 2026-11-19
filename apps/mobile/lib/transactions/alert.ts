import {
  capturePairingSchema,
  transactionAlertSchema,
  type CapturePairing,
  type TransactionAlert,
} from '@repo/types';

export function parseMetadata(metadata: unknown): Record<string, unknown> {
  let value = metadata;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** `metadata.alert` of a synced row, or null for rows that kept none. */
export function transactionAlert(metadata: unknown): TransactionAlert | null {
  return transactionAlertSchema.safeParse(parseMetadata(metadata).alert).data ?? null;
}

/** `metadata.pairing` of a synced row: the capture counted once with it, or null. */
export function transactionPairing(metadata: unknown): CapturePairing | null {
  return capturePairingSchema.safeParse(parseMetadata(metadata).pairing).data ?? null;
}
