import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { OverviewStatsResponse } from '@repo/types';
import { queryKeys } from './query-keys';

export function useOverviewStats() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: () => api.get<OverviewStatsResponse>('/api/analytics/overview'),
  });
}
