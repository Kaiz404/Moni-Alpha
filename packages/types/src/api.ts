import { z } from 'zod';

// Common API response types
export type ApiError = {
  error: string;
  details?: any;
};

export type ApiSuccess<T = any> = {
  success: true;
  data: T;
};

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export type ListResponse<T> = {
  data: T[];
  pagination: Pagination;
};

// Timestamp types
export type Timestamp = string; // ISO 8601 string
export type UnixTimestamp = number; // Unix timestamp in milliseconds
