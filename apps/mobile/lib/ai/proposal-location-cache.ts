import { createMMKV } from 'react-native-mmkv';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';

const storage = createMMKV({ id: 'moni-proposal-location' });
const KEY = 'proposal_location_snapshot_map';

function readMap(): Record<string, LocationSnapshot> {
  try {
    const raw = storage.getString(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, LocationSnapshot>) {
  storage.set(KEY, JSON.stringify(map));
}

export function saveProposalLocationSnapshot(proposalId: string, snapshot: LocationSnapshot) {
  const map = readMap();
  map[proposalId] = snapshot;
  writeMap(map);
}

export function getProposalLocationSnapshot(proposalId: string): LocationSnapshot | null {
  const map = readMap();
  return map[proposalId] ?? null;
}

export function clearProposalLocationSnapshot(proposalId: string) {
  const map = readMap();
  if (!(proposalId in map)) return;
  delete map[proposalId];
  writeMap(map);
}
