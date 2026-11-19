import {
  autocompleteResultSchema,
  detailsResultSchema,
  type AutocompleteRequest,
  type AutocompleteResult,
  type DetailsRequest,
  type DetailsResult,
} from '@repo/types';
import type { ZodType } from 'zod';

import { postJson, type AiBackend } from './post';

/** Never throws: every failure is `{ status: 'unavailable' }`. */
export type PlacesClient = {
  autocomplete(req: AutocompleteRequest, signal?: AbortSignal): Promise<AutocompleteResult>;
  details(req: DetailsRequest): Promise<DetailsResult>;
};

const REQUEST_TIMEOUT_MS = 8_000;
const UNAVAILABLE = { status: 'unavailable' } as const;

async function call<T>(
  backend: AiBackend,
  path: string,
  body: unknown,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T | typeof UNAVAILABLE> {
  const reply = await postJson(backend, path, body, REQUEST_TIMEOUT_MS, signal);
  if (!reply.ok) return UNAVAILABLE;
  const parsed = schema.safeParse(reply.body);
  return parsed.success ? parsed.data : UNAVAILABLE;
}

/** The gateway's Google Places proxy (`/v1/places/*`), which keeps the Places key on the server. */
export function createPlacesClient(backend: AiBackend): PlacesClient {
  return {
    autocomplete: (req, signal) =>
      call(backend, '/v1/places/autocomplete', req, autocompleteResultSchema, signal),
    details: (req) => call(backend, '/v1/places/details', req, detailsResultSchema),
  };
}
