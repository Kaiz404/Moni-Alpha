import {
  capturePairingSchema,
  transactionAlertSchema,
  type CapturePairing,
  type CreateProposedTransaction,
  type TransactionAlert,
} from '@repo/types';

type AlertDelivery = Pick<
  CreateProposedTransaction,
  'sourceApp' | 'notificationTitle' | 'notificationBody' | 'notificationReceivedAt'
>;

/**
 * Which delivery of which alert this is. A redelivered notification repeats all four, because
 * `notificationReceivedAt` is Android's post time. Two real payments differ at least in that.
 */
export function alertKey(alert: AlertDelivery): string {
  return JSON.stringify([
    alert.sourceApp ?? '',
    alert.notificationTitle ?? '',
    alert.notificationBody ?? '',
    // Postgres hands the timestamp back in another format, so compare the instant.
    alert.notificationReceivedAt ? Date.parse(alert.notificationReceivedAt) : null,
  ]);
}

/** The alert a notification capture keeps on the ledger row it becomes, read before any edit. */
export function captureAlert(
  proposal: AlertDelivery &
    Pick<CreateProposedTransaction, 'sourceType' | 'amountMinor' | 'currency'>,
  captureId?: string,
): TransactionAlert | undefined {
  if (proposal.sourceType !== 'notification') return undefined;
  const parsed = transactionAlertSchema.safeParse({
    text: proposal.notificationBody?.trim().slice(0, 1000),
    amountMinor: proposal.amountMinor,
    currency: proposal.currency,
    key: alertKey(proposal),
    captureId,
  });
  return parsed.success ? parsed.data : undefined;
}

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
