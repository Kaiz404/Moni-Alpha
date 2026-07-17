import { useValue } from '@legendapp/state/react';
import { useAuth } from '@/lib/auth/auth-context';
import { pinmap$, type FinancePinPoint } from '@/lib/finance/selectors';

export type TransactionPinPoint = FinancePinPoint;

export function useTransactionPinmap() {
  const { user } = useAuth();
  const { pinPoints, mapRegion } = useValue(pinmap$(user?.id ?? null));

  return {
    pinPoints,
    mapRegion,
    isLoading: false,
    error: null as string | null,
    refresh: () => {},
  };
}

export const useTransactionHeatmap = useTransactionPinmap;
