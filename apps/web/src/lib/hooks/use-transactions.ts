import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  TransactionListResponse,
  TransactionListParams,
  CreateTransaction,
  UpdateTransaction,
} from '@repo/types';
import { queryKeys } from './query-keys';

export function useTransactions(params?: Partial<TransactionListParams>) {
  const searchParams = new URLSearchParams();
  if (params?.walletId) searchParams.set('walletId', params.walletId);
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();

  return useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => api.get<TransactionListResponse>(`/api/transactions${query ? `?${query}` : ''}`),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransaction) => api.post('/api/transactions', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTransaction }) =>
      api.put(`/api/transactions/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
    },
  });
}
