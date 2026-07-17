/**
 * AI backend configuration.
 * Set EXPO_PUBLIC_AI_API_URL when the Go service is deployed.
 */
export const AI_API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AI_API_URL?.trim()) || '';

export const AI_BACKEND_CONFIGURED = AI_API_BASE_URL.length > 0;

export const AI_UNAVAILABLE_REASON =
  'AI backend is not available yet. Inference will run on a dedicated Go service.';
