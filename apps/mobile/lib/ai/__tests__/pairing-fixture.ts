import type { Observable } from '@legendapp/state';
import { getAiClient } from '@/lib/ai/client';
import type { ExtractNotificationRequest, ExtractResult } from '@/lib/ai/client/types';
import type { NotificationQueueItem } from '@/lib/ai/processing-queue';
import { runExtraction } from '@/lib/ai/run-extraction';

type Rows = Observable<Record<string, Record<string, unknown>>>;

export const store = jest.requireMock('@/lib/store') as Record<
  'wallets$' | 'transactions$' | 'proposedTransactions$' | 'categories$' | 'autoAddRules$',
  Rows
>;

export const MAYBANK = '00000000-0000-4000-8000-00000000000a';
export const TNG = '00000000-0000-4000-8000-00000000000b';
export const GRABPAY = '00000000-0000-4000-8000-00000000000c';
export const VISA = '00000000-0000-4000-8000-00000000000d';
export const CIMB = '00000000-0000-4000-8000-00000000000e';
export const SHOPPING = '00000000-0000-4000-8000-0000000000f1';

export const MAYBANK_APP = 'com.maybank2u.life';
export const CIMB_APP = 'com.cimb.cimbocto';
export const TNG_APP = 'my.com.tngdigital.ewallet';
export const GRAB_APP = 'com.grabtaxi.passenger';

export const T0 = Date.parse('2026-10-14T04:41:00.000Z');
export const MINUTE = 60_000;

export type Read = { amount: number; type: 'income' | 'expense'; merchant: string | null };

export function wallet(
  id: string,
  name: string,
  type: string,
  pkg: string | null,
  hint: string | null = null,
) {
  return {
    id,
    user_id: 'user-1',
    name,
    type,
    currency: 'MYR',
    notification_package: pkg,
    notification_account_hint: hint,
    is_active: true,
    deleted: false,
    display_order: 0,
  };
}

export function resetStore(wallets: ReturnType<typeof wallet>[]) {
  store.transactions$.set({});
  store.proposedTransactions$.set({});
  store.autoAddRules$.set({});
  store.wallets$.set(Object.fromEntries(wallets.map((w) => [w.id, w])));
  store.categories$.set({
    [SHOPPING]: {
      id: SHOPPING,
      user_id: null,
      name: 'Shopping',
      type: 'expense',
      icon: 'shopping',
      color: '#E8C8A9',
      is_active: true,
      display_order: 5,
      deleted: false,
    },
  });
}

const reads = new Map<string, Read>();
let nextCapture = 0;

/** A notification as the listener delivers it, and how the model reads it. */
export function delivered(
  pkg: string,
  text: string,
  read: Read,
  minutes = 0,
): NotificationQueueItem {
  const at = T0 + minutes * MINUTE;
  const id = `00000000-0000-4000-9000-${String(++nextCapture).padStart(12, '0')}`;
  reads.set(text, read);
  return {
    id,
    type: 'notification',
    status: 'pending',
    createdAt: new Date(at).toISOString(),
    locationSnapshot: null,
    notification: {
      id,
      app: pkg,
      packageName: pkg,
      title: 'Alert',
      text,
      time: String(at),
      receivedAt: new Date(at).toISOString(),
    },
  };
}

export function mockModel() {
  (getAiClient as jest.Mock).mockReturnValue({
    extractFromNotification: async (request: ExtractNotificationRequest): Promise<ExtractResult> => {
      const read = reads.get(request.notification.text);
      if (!read) throw new Error(`No read for ${request.notification.text}`);
      return {
        status: 'ok',
        extraction: {
          amount: read.amount,
          type: read.type,
          currency: 'MYR',
          merchant: read.merchant,
          description: null,
          walletHint: null,
          categoryHint: null,
          walletId: request.lockedWalletId ?? null,
          transferToWalletHint: null,
          transferToWalletId: null,
          confidence: 0.9,
          reasoning: 'From the alert.',
          occurredAt: null,
        },
      };
    },
  });
}

export const run = (item: NotificationQueueItem) => runExtraction(item);

export const ledgerRows = () =>
  Object.values(store.transactions$.peek()).filter((row) => row.deleted === false);

export const openProposals = () =>
  Object.values(store.proposedTransactions$.peek()).filter(
    (row) => row.deleted === false && row.status === 'pending',
  );

/** Three approved rows at RM20 over the previous days, so the next alert from this merchant is routine. */
export function seedRoutine(walletId: string, merchant: string) {
  for (let i = 0; i < 3; i += 1) {
    const id = `00000000-0000-4000-8000-1000000000${i}0`;
    store.transactions$[id].set({
      id,
      user_id: 'user-1',
      wallet_id: walletId,
      amount: '20.00',
      currency: 'MYR',
      type: 'expense',
      category_id: SHOPPING,
      merchant,
      analysis_excluded: false,
      transaction_date: new Date(T0 - (i + 1) * 86_400_000).toISOString(),
      created_at: new Date(T0 - (i + 1) * 86_400_000).toISOString(),
      metadata: { source: 'notification' },
      deleted: false,
    });
  }
}
