import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CategoryListResponse } from '@repo/types';
import { queryKeys } from './query-keys';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<CategoryListResponse>('/api/categories'),
  });
}
