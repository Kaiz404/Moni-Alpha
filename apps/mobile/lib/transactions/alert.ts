import {
  transactionAlertSchema,
  type CreateProposedTransaction,
  type TransactionAlert,
} from '@repo/types';

/** The alert a notification capture keeps on the ledger row it becomes, read before any edit. */
export function captureAlert(
  proposal: Pick<
    CreateProposedTransaction,
    'sourceType' | 'notificationBody' | 'amountMinor' | 'currency'
  >,
): TransactionAlert | undefined {
  if (proposal.sourceType !== 'notification') return undefined;
  const parsed = transactionAlertSchema.safeParse({
    text: proposal.notificationBody?.trim().slice(0, 1000),
    amountMinor: proposal.amountMinor,
    currency: proposal.currency,
  });
  return parsed.success ? parsed.data : undefined;
}

/** `metadata.alert` of a synced row, or null for rows that kept none. */
export function transactionAlert(metadata: unknown): TransactionAlert | null {
  let value = metadata;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const alert =
    value && typeof value === 'object' ? (value as { alert?: unknown }).alert : undefined;
  return transactionAlertSchema.safeParse(alert).data ?? null;
}
