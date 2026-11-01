import 'react-native-gesture-handler/jestSetup';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import MapScreen from '@/app/map';
import PlaceScreen from '@/app/place/[id]';

const mockNative: { hasGoogleMapsKey?: () => boolean } = {};

jest.mock('@/modules/moni-android-apps', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));
jest.mock('react-native-maps', () => {
  const { Text } = jest.requireActual('react-native');
  function MockMapView({ children }: { children?: ReactNode }) {
    return (
      <>
        <Text>Google map</Text>
        {children}
      </>
    );
  }
  return { __esModule: true, PROVIDER_GOOGLE: 'google', default: MockMapView, Marker: () => null };
});
jest.mock('expo-location', () => ({
  useForegroundPermissions: () => [{ status: 'granted', granted: true }, jest.fn(), jest.fn()],
  PermissionStatus: { DENIED: 'denied' },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({ id: mockPlaceId() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'kai' } }) }));
jest.mock('@/lib/supabase/merchant-aliases', () => ({ listMerchantAliases: () => [] }));
jest.mock('@/components/map/use-places', () => ({
  ...jest.requireActual('@/components/map/use-places'),
  usePlaceSources: () => ({
    userId: 'kai',
    currency: 'MYR',
    loaded: true,
    transactions: [mockTransaction],
    lookups: { categoriesById: {}, walletNames: { maybank: 'Maybank' } },
    categoryLook: () => ({ name: 'Food & Dining', icon: 'food', color: null }),
  }),
}));

const mockTransaction = {
  id: 'lunch',
  userId: 'kai',
  walletId: 'maybank',
  amountMinor: 1820,
  currency: 'MYR',
  type: 'expense',
  analysisExcluded: false,
  debtActivityId: null,
  categoryId: null,
  transferToWalletId: null,
  linkedTransactionId: null,
  description: null,
  merchant: 'Mamak Ali',
  notes: null,
  transactionDate: new Date().toISOString(),
  locationLatitude: 3.13,
  locationLongitude: 101.67,
  locationName: 'Bangsar',
  autoAdded: false,
  balanceCorrection: false,
  createdAt: new Date().toISOString(),
};

function mockPlaceId(): string {
  const { groupPlaces } = jest.requireActual('@/lib/finance/places');
  return groupPlaces([mockTransaction], { currency: 'MYR' })[0].id;
}

describe('the map when the installed build has no Google Maps key', () => {
  it('shows Map unavailable and still lists the places, with no map to crash and no Fit button', () => {
    mockNative.hasGoogleMapsKey = () => false;
    render(<MapScreen />);

    expect(screen.getByText('Map unavailable')).toBeTruthy();
    expect(screen.queryByText('Google map')).toBeNull();
    expect(screen.queryByTestId('map.places.fit')).toBeNull();
    expect(screen.getAllByText('Bangsar').length).toBeGreaterThan(0);
  });

  it('draws the map and the Fit button when the build has a key', () => {
    mockNative.hasGoogleMapsKey = () => true;
    render(<MapScreen />);

    expect(screen.getByText('Google map')).toBeTruthy();
    expect(screen.getByTestId('map.places.fit')).toBeTruthy();
    expect(screen.queryByText('Map unavailable')).toBeNull();
  });

  it('keeps the map on a build older than the check, which cannot answer', () => {
    delete mockNative.hasGoogleMapsKey;
    render(<MapScreen />);

    expect(screen.getByText('Google map')).toBeTruthy();
    expect(screen.queryByText('Map unavailable')).toBeNull();
  });

  it('opens a place with its spending and no map', () => {
    mockNative.hasGoogleMapsKey = () => false;
    render(<PlaceScreen />);

    expect(screen.queryByText('Google map')).toBeNull();
    expect(screen.getByText('Bangsar')).toBeTruthy();
    expect(screen.getByText('Payments')).toBeTruthy();
  });

  it('opens a place on its map when the build has a key', () => {
    mockNative.hasGoogleMapsKey = () => true;
    render(<PlaceScreen />);

    expect(screen.getByText('Google map')).toBeTruthy();
  });
});
