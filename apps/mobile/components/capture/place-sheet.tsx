import { useValue } from '@legendapp/state/react';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';

import { FieldBubble } from '@/components/capture/field-bubble';
import { FALLBACK_REGION, shopMapStyles } from '@/components/map/map-style';
import { mapsAvailable } from '@/components/map/maps-available';
import { usePlaceSources } from '@/components/map/use-places';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { SearchField } from '@/components/ui/search-field';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { PlacePick } from '@/lib/capture/entry-place';
import { searchPastPlaces, type PlaceOption } from '@/lib/capture/place-search';
import { placeLabel, type LatLng } from '@/lib/finance/places';
import { scrubStep } from '@/lib/haptics';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { tid } from '@/lib/test-ids';
import { placeName } from '@/lib/transactions/prefetch-location';

/** Street level: a few shopfronts either side of the pin. */
const STREET_DELTA = 0.004;
const GEOCODE_AFTER_MS = 600;
const GEOCODE_MIN_CHARS = 3;
const GEOCODE_RESULTS = 3;
const PIN = 40;

/** What the pin marks. `shop` is a shop the user picked by name; the pin alone names a street. */
type Spot = LatLng & { name: string | null; shop: string | null; naming: boolean };

function regionAt(at: LatLng): Region {
  return { ...at, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA };
}

/** The device geocoder's matches for an address or a well-known place; no key, no Places API. */
function useGeocoded(query: string): PlaceOption[] {
  const [found, setFound] = useState<{ query: string; options: PlaceOption[] }>({
    query: '',
    options: [],
  });
  const q = query.trim();
  useEffect(() => {
    if (q.length < GEOCODE_MIN_CHARS) return;
    let live = true;
    const timer = setTimeout(() => {
      Location.geocodeAsync(q)
        .then((matches) => {
          if (!live) return;
          setFound({
            query: q,
            options: matches.slice(0, GEOCODE_RESULTS).map((match, index) => ({
              id: `geocode-${index}`,
              latitude: match.latitude,
              longitude: match.longitude,
              title: q,
              meta: 'Address search',
              shop: null,
            })),
          });
        })
        .catch(() => {
          if (live) setFound({ query: q, options: [] });
        });
    }, GEOCODE_AFTER_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);
  return found.query === q ? found.options : [];
}

type PlaceSheetProps = SheetFrameProps & {
  request: SheetRequestOf<'place'>;
  onPick: (pick: PlacePick) => void;
};

/**
 * The Location field's sheet: a map under a fixed centre pin. Tapping a shop Google draws picks
 * it, panning moves the pin, and search finds the user's own places first, then an address.
 * Only the header drags the sheet, so the map keeps every gesture.
 */
export function PlaceSheet({ request, onPick, ...frame }: PlaceSheetProps) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const { userId, currency, transactions } = usePlaceSources();
  const aliases = useValue(() => (userId ? listMerchantAliases(userId) : []));
  const [permission] = Location.useForegroundPermissions();
  const [hasMap] = useState(mapsAvailable);
  const mapRef = useRef<MapView>(null);
  const naming = useRef(0);
  const [query, setQuery] = useState('');
  const [spot, setSpot] = useState<Spot | null>(() =>
    request.start
      ? {
          latitude: request.start.latitude,
          longitude: request.start.longitude,
          name: request.start.name,
          shop: null,
          naming: false,
        }
      : null,
  );
  const initialRegion = useMemo(
    () => (request.start ? regionAt(request.start) : FALLBACK_REGION),
    [request.start],
  );

  const past = useMemo(
    () => searchPastPlaces(query, { transactions, currency, aliases }),
    [aliases, currency, query, transactions],
  );
  const geocoded = useGeocoded(query);
  const options = [...past, ...geocoded];
  const searching = query.trim().length > 0;

  const moveTo = (at: LatLng) =>
    mapRef.current?.animateToRegion(regionAt(at), 300);

  const choose = (option: PlaceOption) => {
    scrubStep();
    naming.current += 1;
    Keyboard.dismiss();
    setQuery('');
    setSpot({
      latitude: option.latitude,
      longitude: option.longitude,
      name: option.shop ?? option.title,
      shop: option.shop,
      naming: false,
    });
    moveTo(option);
  };

  /** The pin landed somewhere new under the user's finger: name the street it is on. */
  const pinMoved = (region: Region) => {
    const at = { latitude: region.latitude, longitude: region.longitude };
    const ask = ++naming.current;
    setSpot({ ...at, name: null, shop: null, naming: true });
    void placeName(at).then((name) => {
      if (ask !== naming.current) return;
      setSpot((current) => current && { ...current, name, naming: false });
    });
  };

  const spotName = spot
    ? spot.shop ?? placeLabel(spot.name)?.name ?? (spot.naming ? 'Finding the street' : 'Pinned place')
    : 'Move the map or search';

  return (
    <Sheet
      {...frame}
      size="large"
      title="Choose a place"
      closeLabel="Close"
      bodyDrags={false}
      actions={
        <>
          <Button
            testID={tid('sheet', 'place', 'off')}
            className="flex-[2]"
            pinned
            variant="secondary"
            icon="map-marker-off-outline"
            label="No place"
            onPress={() => onPick({ kind: 'off' })}
          />
          <Button
            testID={tid('sheet', 'place', 'use')}
            className="flex-[3]"
            pinned
            icon="check"
            label="Use this place"
            disabled={!spot}
            onPress={() =>
              spot &&
              onPick({
                kind: 'chosen',
                place: {
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                  name: spot.shop ?? spot.name,
                },
                shop: spot.shop,
              })
            }
          />
        </>
      }
    >
      <View className="flex-1 gap-3">
        <SearchField
          testID={tid('sheet', 'place', 'search')}
          accessibilityLabel="Search places"
          placeholder="Search a shop or address"
          value={query}
          onChangeText={setQuery}
        />
        <View className="flex-1 overflow-hidden rounded-card bg-sand">
          {hasMap ? (
            <MapView
              ref={mapRef}
              testID={tid('sheet', 'place', 'map')}
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              customMapStyle={dark ? shopMapStyles.dark : shopMapStyles.light}
              initialRegion={initialRegion}
              showsUserLocation={permission?.granted === true}
              showsMyLocationButton={false}
              toolbarEnabled={false}
              onPoiClick={(event) => {
                const { name, coordinate } = event.nativeEvent;
                const shop = name.replace(/\s*\n\s*/g, ' ').trim();
                choose({
                  ...coordinate,
                  id: event.nativeEvent.placeId,
                  title: shop,
                  meta: null,
                  shop: shop || null,
                });
              }}
              onRegionChangeComplete={(region, details) => {
                if (details?.isGesture) pinMoved(region);
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text
                variant="meta"
                className="text-center text-muted"
              >
                Map unavailable. Search still finds your places.
              </Text>
            </View>
          )}
          {hasMap ? (
            <View
              pointerEvents="none"
              className="absolute left-1/2 top-1/2"
              style={{ marginLeft: -PIN / 2, marginTop: -PIN }}
            >
              <IconSymbol
                name="map-marker"
                size={PIN}
                color={tokens.foreground}
              />
            </View>
          ) : null}
          {searching ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              className="absolute inset-x-2 top-2 max-h-[85%] overflow-hidden rounded-tile bg-card"
            >
              <ScrollView keyboardShouldPersistTaps="handled">
                {options.map((option) => (
                  <Press
                    key={option.id}
                    testID={tid('sheet', 'place', 'result', option.id)}
                    accessibilityLabel={
                      option.meta ? `${option.title}, ${option.meta}` : option.title
                    }
                    className="min-h-14 justify-center px-4 py-2"
                    onPress={() => choose(option)}
                  >
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {option.title}
                    </Text>
                    {option.meta ? (
                      <Text
                        variant="meta"
                        className="text-muted"
                        numberOfLines={1}
                      >
                        {option.meta}
                      </Text>
                    ) : null}
                  </Press>
                ))}
                {options.length === 0 ? (
                  <Text
                    variant="meta"
                    className="px-4 py-4 text-muted"
                  >
                    {`Nothing found for “${query.trim()}” yet.`}
                  </Text>
                ) : null}
              </ScrollView>
            </Animated.View>
          ) : null}
        </View>
        <View
          className="h-[60px] flex-row items-center gap-2.5 rounded-tile bg-sand px-2.5"
          accessibilityLiveRegion="polite"
        >
          <FieldBubble color={tokens.card}>
            <IconSymbol
              name={spot?.shop ? 'storefront-outline' : 'map-marker-outline'}
              size={17}
              color={tokens.foreground}
            />
          </FieldBubble>
          <View className="min-w-0 flex-1 gap-px">
            <Text
              className="text-[12px] leading-[16px] text-ink-2"
              numberOfLines={1}
            >
              Place
            </Text>
            <Animated.View
              key={spotName}
              entering={FadeIn.duration(180)}
            >
              <Text
                testID={tid('sheet', 'place', 'name')}
                className={`text-[15px] leading-[20px] font-display-semibold ${spot ? 'text-foreground' : 'text-muted'}`}
                numberOfLines={1}
              >
                {spotName}
              </Text>
            </Animated.View>
          </View>
        </View>
      </View>
    </Sheet>
  );
}
