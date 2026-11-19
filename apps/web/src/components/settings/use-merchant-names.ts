'use client';

import { useMemo } from 'react';
import { useLedger } from '@/lib/ledger/use-ledger';
import { merchantTable } from '@/lib/merchant-names-view';

/** Codes to name and names given, live from the store, as the phone's Merchant names lists them. */
export function useMerchantNames() {
  const ledger = useLedger();
  const table = useMemo(
    () => merchantTable(ledger.transactions, ledger.aliases, ledger.walletNames),
    [ledger.transactions, ledger.aliases, ledger.walletNames],
  );
  return { ...table, ledger };
}
