import { z } from 'zod';

/**
 * Wire contract with the backend's Places proxy (`/v1/places/*`). Responses are parsed here,
 * so a malformed body reads as `unavailable` and nothing past this file re-checks the shape.
 */
export type AutocompleteRequest = {
  input: string;
  /** One per opening of the place sheet; Google bills the searches and the pick as one session. */
  sessionToken: string;
  bias: { latitude: number; longitude: number } | null;
};

export type DetailsRequest = { placeId: string; sessionToken: string | null };

const predictionSchema = z.object({
  placeId: z.string().min(1),
  primaryText: z.string(),
  secondaryText: z.string().nullable(),
  distanceMeters: z.number().nullable(),
});

export const autocompleteResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), predictions: z.array(predictionSchema) }),
  z.object({ status: z.literal('unavailable') }),
]);

export const detailsResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    place: z.object({
      placeId: z.string().min(1),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      address: z.string().nullable(),
    }),
  }),
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('unavailable') }),
]);

export type PlacePrediction = z.infer<typeof predictionSchema>;
export type AutocompleteResult = z.infer<typeof autocompleteResultSchema>;
export type DetailsResult = z.infer<typeof detailsResultSchema>;

/** Never throws: every failure is `{ status: 'unavailable' }`. */
export type PlacesClient = {
  autocomplete(req: AutocompleteRequest, signal?: AbortSignal): Promise<AutocompleteResult>;
  details(req: DetailsRequest): Promise<DetailsResult>;
};
