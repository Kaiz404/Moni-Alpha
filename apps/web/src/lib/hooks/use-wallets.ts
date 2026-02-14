import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { WalletListResponse, CreateWallet } from '@repo/types';
import { queryKeys } from './query-keys';

export function useWallets() {
  return useQuery({
    queryKey: queryKeys.wallets,
    queryFn: () => api.get<WalletListResponse>('/api/wallets'),
  });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWallet) =>
      api.post('/api/wallets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    },
  });
}

export function useUpdateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<CreateWallet>;
    }) => api.put(`/api/wallets/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    },
  });
}

export function useDeleteWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/wallets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    },
  });
}
