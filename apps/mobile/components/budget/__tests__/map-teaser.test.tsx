import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MapTeaser } from '@/components/budget/map-teaser';
import type { Place } from '@/lib/finance/places';

const mockNative: { hasGoogleMapsKey?: () => boolean } = {};
const mockMapProps = jest.fn();

jest.mock('@/modules/moni-android-apps', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));
jest.mock('react-native-maps', () => {
  const { Text } = jest.requireActual('react-native');
  function MockMapView({ children, ...props }: { children?: ReactNode }) {
    mockMapProps(props);
    return (
      <>
        <Text>Google map</Text>
        {children}
      </>
    );
  }
  function MockMarker({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }
  return { __esModule: true, PROVIDER_GOOGLE: 'google', default: MockMapView, Marker: MockMarker };
});
jest.mock('@/components/map/use-places', () => ({
  usePlaceSources: () => ({
    categoryLook: () => ({ name: 'Food', icon: 'food', color: null }),
  }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const bangsar = {
  id: 'bangsar',
  name: 'Bangsar',
  latitude: 3.13,
  longitude: 101.67,
  totalMinor: 29380,
  categories: [{ categoryId: 'food' }],
} as unknown as Place;

const card = (places: Place[]) => (
  <MapTeaser
    places={places}
    expenses={30}
    withPlace={25}
    monthName="October"
    currency="MYR"
    onOpen={jest.fn()}
  />
);

describe('MapTeaser', () => {
  beforeEach(() => {
    mockMapProps.mockClear();
    delete mockNative.hasGoogleMapsKey;
  });

  it('draws a still map with the map page pin for each place', () => {
    render(card([bangsar]));
    expect(screen.getByText('Google map', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('RM293', { includeHiddenElements: true })).toBeTruthy();
    expect(mockMapProps.mock.calls[0][0].liteMode).toBe(true);
    expect(screen.getByText('1 place · 25 of 30 expenses had a place')).toBeTruthy();
  });

  it('leaves the map out of a build with no Maps key, and keeps the card', () => {
    mockNative.hasGoogleMapsKey = () => false;
    render(card([bangsar]));
    expect(screen.queryByText('Google map', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Where you spend')).toBeTruthy();
  });
});
