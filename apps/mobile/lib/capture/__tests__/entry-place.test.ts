import {
  applyPlacePick,
  locationFieldState,
  phoneMayLocate,
  savedLocation,
  suggestionSpot,
  type EntryPlace,
  type EntryPlaceInput,
} from '@/lib/capture/entry-place';
import type { EntryLocation } from '@/lib/transactions/prefetch-location';

const PHONE = {
  latitude: 3.13,
  longitude: 101.671,
  name: 'Jalan Telawi 3, Kuala Lumpur, Wilayah Persekutuan',
};
const SHOP = { latitude: 3.1301, longitude: 101.6712, name: 'Mamak Ali' };
const FOUND: EntryLocation = { status: 'found', location: PHONE };

const input = (
  place: EntryPlace,
  over: Partial<EntryPlaceInput> = {},
): EntryPlaceInput => ({ place, here: FOUND, phoneAllowed: true, ...over });

describe('the entry place', () => {
  it('follows the phone where the wallet allows it', () => {
    expect(savedLocation(input({ kind: 'auto' }))).toEqual(PHONE);
    expect(locationFieldState(input({ kind: 'auto' }))).toEqual({
      kind: 'place',
      name: 'Jalan Telawi 3',
    });
  });

  it('saves no phone position for a wallet whose app has location off', () => {
    const off = input({ kind: 'auto' }, { phoneAllowed: false });
    expect(savedLocation(off)).toBeNull();
    expect(locationFieldState(off)).toEqual({ kind: 'empty' });
  });

  it('reads Finding while the phone looks, and empty without permission', () => {
    expect(
      locationFieldState(input({ kind: 'auto' }, { here: { status: 'finding' } })),
    ).toEqual({ kind: 'finding' });
    expect(
      locationFieldState(input({ kind: 'auto' }, { here: { status: 'none' } })),
    ).toEqual({ kind: 'empty' });
  });

  it('saves a picked place even without permission or with the wallet off', () => {
    const picked = input(
      { kind: 'chosen', place: SHOP },
      { here: { status: 'none' }, phoneAllowed: false },
    );
    expect(savedLocation(picked)).toEqual(SHOP);
    expect(locationFieldState(picked)).toEqual({ kind: 'place', name: 'Mamak Ali' });
  });

  it('names an unnamed picked spot a pinned place', () => {
    expect(
      locationFieldState(
        input({ kind: 'chosen', place: { ...SHOP, name: null } }),
      ),
    ).toEqual({ kind: 'place', name: 'Pinned place' });
  });

  it('saves nothing once turned off, even with the phone found', () => {
    expect(savedLocation(input({ kind: 'off' }))).toBeNull();
    expect(locationFieldState(input({ kind: 'off' }))).toEqual({ kind: 'off' });
  });

  it('suggests only from the phone, never over a picked place', () => {
    expect(suggestionSpot(input({ kind: 'auto' }))).toEqual(PHONE);
    expect(suggestionSpot(input({ kind: 'chosen', place: SHOP }))).toBeNull();
    expect(suggestionSpot(input({ kind: 'auto' }, { phoneAllowed: false }))).toBeNull();
  });
});

describe('a pick from the place sheet', () => {
  it('fills an empty Shop or note with the shop', () => {
    expect(
      applyPlacePick({ kind: 'chosen', place: SHOP, shop: 'Mamak Ali' }, ' '),
    ).toEqual({ place: { kind: 'chosen', place: SHOP }, note: 'Mamak Ali' });
  });

  it('keeps a note the user typed', () => {
    expect(
      applyPlacePick({ kind: 'chosen', place: SHOP, shop: 'Mamak Ali' }, 'Teh tarik'),
    ).toEqual({ place: { kind: 'chosen', place: SHOP }, note: 'Teh tarik' });
  });

  it('leaves the note alone for a spot with no shop', () => {
    const street = { ...SHOP, name: 'Jalan Telawi 3' };
    expect(applyPlacePick({ kind: 'chosen', place: street, shop: null }, '')).toEqual({
      place: { kind: 'chosen', place: street },
      note: '',
    });
  });

  it('turns the place off', () => {
    expect(applyPlacePick({ kind: 'off' }, 'Teh tarik')).toEqual({
      place: { kind: 'off' },
      note: 'Teh tarik',
    });
  });
});

describe('phoneMayLocate', () => {
  it('lets the phone stand for an entry dated today', () => {
    expect(phoneMayLocate({ recordLocation: true }, '2026-11-12', '2026-11-12')).toBe(true);
  });

  it('keeps the phone out of an entry dated another day', () => {
    expect(phoneMayLocate({ recordLocation: true }, '2026-11-05', '2026-11-12')).toBe(false);
  });

  it('keeps the phone out when the wallet app has location off', () => {
    expect(phoneMayLocate({ recordLocation: false }, '2026-11-12', '2026-11-12')).toBe(false);
  });
});
