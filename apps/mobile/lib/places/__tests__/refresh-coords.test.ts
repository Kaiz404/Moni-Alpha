import { dueForRefresh, refreshedCoords } from '@/lib/places/refresh-coords';

jest.mock('@/lib/store', () => ({ isMigrated: () => true, transactions$: {} }));
jest.mock('@/lib/supabase/transactions', () => ({ setPlaceCoords: jest.fn() }));

const NOW = new Date('2026-11-12T03:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const row = (id: string, days: number) => ({
  id,
  placeId: `place-${id}`,
  placeCoordsAt: daysAgo(days),
});

describe('which Google coordinates a run refreshes', () => {
  it('takes rows 25 days old or more, oldest first, at most the limit', () => {
    const rows = [row('fresh', 24.9), row('a', 25), row('b', 31), row('c', 27)];
    expect(dueForRefresh(rows, NOW).map((due) => due.id)).toEqual(['b', 'c', 'a']);
    expect(dueForRefresh(rows, NOW, 2).map((due) => due.id)).toEqual(['b', 'c']);
  });
});

describe('what a refresh writes', () => {
  const fresh = {
    status: 'ok',
    place: { placeId: 'place-a', latitude: 3.12, longitude: 101.68, address: null },
  } as const;

  it("saves Google's fresh coordinates, stamped now", () => {
    expect(refreshedCoords(row('a', 26), fresh, NOW)).toEqual({
      latitude: 3.12,
      longitude: 101.68,
      placeCoordsAt: '2026-11-12T03:00:00.000Z',
    });
  });

  it('keeps the row for tomorrow while it is under 30 days old', () => {
    expect(refreshedCoords(row('a', 29), { status: 'unavailable' }, NOW)).toBeNull();
    expect(refreshedCoords(row('a', 29), { status: 'not_found' }, NOW)).toBeNull();
  });

  it('drops the coordinates once they pass 30 days and Google still cannot answer', () => {
    const dropped = { latitude: null, longitude: null, placeCoordsAt: null };
    expect(refreshedCoords(row('a', 30), { status: 'unavailable' }, NOW)).toEqual(dropped);
    expect(refreshedCoords(row('a', 45), { status: 'not_found' }, NOW)).toEqual(dropped);
  });
});
