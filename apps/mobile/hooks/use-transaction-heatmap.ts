import { useMemo } from 'react';
import { useSelector } from '@legendapp/state/react';

import { transactions$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import {
  buildMapRegion,
  buildPinPoints,
  type TransactionPinPoint,
} from '@/lib/summary/aggregates';

export type { TransactionPinPoint };

export function useTransactionPinmap() {
  const transactionRows = useSelector(() =>
    getRecordValues<{
      wallet_id?: string | null;
      transfer_to_wallet_id?: string | null;
      amount?: string | number | null;
      type?: string | null;
      category_id?: string | null;
      transaction_date?: string | null;
      created_at?: string | null;
      location_latitude?: string | number | null;
      location_longitude?: string | number | null;
      location_name?: string | null;
      description?: string | null;
    }>(transactions$),
  );

  const pinPoints = useMemo(() => buildPinPoints(transactionRows), [transactionRows]);
  const mapRegion = useMemo(() => buildMapRegion(pinPoints), [pinPoints]);

  return {
    pinPoints,
    mapRegion,
    isLoading: false,
    error: null as string | null,
    refresh: () => {},
  };
}

export const useTransactionHeatmap = useTransactionPinmap;
