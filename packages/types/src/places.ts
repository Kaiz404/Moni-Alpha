import { z } from 'zod';

/**
 * Wire contract with the backend's Places proxy (`/v1/places/*`, `apps/backend/internal/places`).
 * The client parses every response, so a malformed body reads as `unavailable`.
 */

const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const autocompleteRequestSchema = z.object({
  input: z.string().min(1),
  /** One per opening of the place sheet; Google bills the searches and the pick as one session. */
  sessionToken: z.string().max(64),
  bias: latLngSchema.nullable(),
});

export const detailsRequestSchema = z.object({
  placeId: z.string().min(1).max(300),
  sessionToken: z.string().max(64).nullable(),
});

export const placePredictionSchema = z.object({
  placeId: z.string().min(1),
  primaryText: z.string(),
  secondaryText: z.string().nullable(),
  distanceMeters: z.number().int().nullable(),
});

export const autocompleteResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), predictions: z.array(placePredictionSchema) }),
  z.object({ status: z.literal('unavailable') }),
]);

export const detailsResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    place: latLngSchema.extend({
      placeId: z.string().min(1),
      address: z.string().nullable(),
    }),
  }),
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('unavailable') }),
]);

export type AutocompleteRequest = z.infer<typeof autocompleteRequestSchema>;
export type DetailsRequest = z.infer<typeof detailsRequestSchema>;
export type PlacePrediction = z.infer<typeof placePredictionSchema>;
export type AutocompleteResult = z.infer<typeof autocompleteResultSchema>;
export type DetailsResult = z.infer<typeof detailsResultSchema>;
