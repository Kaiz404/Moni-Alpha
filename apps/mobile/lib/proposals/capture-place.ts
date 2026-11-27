import type { ProposedTransaction } from '@repo/types';
import { placeLabel } from '@repo/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { placeName } from '@/lib/transactions/prefetch-location';

/** The device geocoder's answer for a capture saved with coordinates only: a name, or none found. */
type Named = Record<string, string | null>;

/**
 * Where a capture happened, as the Review card says it: "Jaya Grocer, Petaling Jaya". A spot saved
 * without a name reads "Finding the street" while the geocoder looks, then its name or "Pinned place".
 * Null when the capture has no place.
 */
export function capturePlaceLine(
  snapshot: Pick<LocationSnapshot, 'name'> | null,
  geocoded: string | null | undefined,
): string | null {
  if (!snapshot) return null;
  const label = placeLabel(snapshot.name ?? geocoded ?? null);
  if (label) return label.area ? `${label.name}, ${label.area}` : label.name;
  return geocoded === undefined && !snapshot.name ? 'Finding the street' : 'Pinned place';
}

/** The place line for each card the deck shows, naming a spot saved with coordinates only. */
export function useCapturePlaces(shown: readonly (ProposedTransaction | undefined)[]) {
  const [named, setNamed] = useState<Named>({});
  const asked = useRef(new Set<string>());
  const ids = shown.map((proposal) => proposal?.id ?? '').join(' ');

  useEffect(() => {
    for (const id of ids.split(' ').filter(Boolean)) {
      const snapshot = getProposalLocationSnapshot(id);
      if (!snapshot || snapshot.name || asked.current.has(id)) continue;
      asked.current.add(id);
      void placeName(snapshot).then((name) => setNamed((all) => ({ ...all, [id]: name })));
    }
  }, [ids]);

  return useCallback(
    (proposal: ProposedTransaction) =>
      capturePlaceLine(getProposalLocationSnapshot(proposal.id), named[proposal.id]),
    [named],
  );
}
