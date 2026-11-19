import { createPlacesClient, type PlacesClient } from '@repo/ai';
import { distanceM } from '@repo/core';

import { AI_BACKEND_CONFIGURED, aiBackend } from '@/lib/ai/client/config';

const UNAVAILABLE = { status: 'unavailable' } as const;

/** A few real Kuala Lumpur places, so search works with no backend (dev, e2e). */
export const MOCK_PLACES = [
  {
    placeId: 'mock-village-park',
    primaryText: 'Village Park Restaurant',
    secondaryText: 'Jalan SS 21/37, Damansara Utama, Petaling Jaya',
    latitude: 3.1356,
    longitude: 101.6237,
  },
  {
    placeId: 'mock-lai-foong',
    primaryText: 'Kedai Kopi Lai Foong',
    secondaryText: 'Jalan Tun H S Lee, City Centre, Kuala Lumpur',
    latitude: 3.1457,
    longitude: 101.6975,
  },
  {
    placeId: 'mock-pavilion',
    primaryText: 'Pavilion Kuala Lumpur',
    secondaryText: 'Jalan Bukit Bintang, Bukit Bintang, Kuala Lumpur',
    latitude: 3.149,
    longitude: 101.7135,
  },
  {
    placeId: 'mock-nasi-kandar-pelita',
    primaryText: 'Nasi Kandar Pelita',
    secondaryText: 'Jalan Ampang, Kuala Lumpur',
    latitude: 3.1585,
    longitude: 101.7175,
  },
  {
    placeId: 'mock-jaya-grocer',
    primaryText: 'Jaya Grocer',
    secondaryText: 'Bangsar Village, Jalan Telawi 1, Bangsar, Kuala Lumpur',
    latitude: 3.1306,
    longitude: 101.6705,
  },
] as const;

const MOCK_DELAY_MS = 120;

function later(signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), MOCK_DELAY_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export const mockPlacesClient: PlacesClient = {
  async autocomplete({ input, bias }, signal) {
    if (!(await later(signal))) return UNAVAILABLE;
    const q = input.trim().toLowerCase();
    return {
      status: 'ok',
      predictions: MOCK_PLACES.filter((place) =>
        `${place.primaryText} ${place.secondaryText}`.toLowerCase().includes(q),
      ).map((place) => ({
        placeId: place.placeId,
        primaryText: place.primaryText,
        secondaryText: place.secondaryText,
        distanceMeters: bias ? Math.round(distanceM(bias, place)) : null,
      })),
    };
  },
  async details({ placeId }) {
    await later();
    const place = MOCK_PLACES.find((item) => item.placeId === placeId);
    return place
      ? {
          status: 'ok',
          place: {
            placeId,
            latitude: place.latitude,
            longitude: place.longitude,
            address: place.secondaryText,
          },
        }
      : { status: 'not_found' };
  },
};

/** The backend proxy when `EXPO_PUBLIC_AI_API_URL` is set, the mock otherwise (as `getAiClient`). */
export function getPlacesClient(): PlacesClient {
  return AI_BACKEND_CONFIGURED ? createPlacesClient(aiBackend) : mockPlacesClient;
}
