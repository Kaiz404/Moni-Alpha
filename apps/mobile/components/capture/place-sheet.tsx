import { useValue } from '@legendapp/state/react';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  View,
  type TextInput,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useUniwind } from 'uniwind';

import { FieldBubble } from '@/components/capture/field-bubble';
import { FALLBACK_REGION, shopMapStyles } from '@/components/map/map-style';
import { mapsAvailable } from '@/components/map/maps-available';
import { Button } from '@/components/ui/button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { SearchField } from '@/components/ui/search-field';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { PlacePick } from '@/lib/capture/entry-place';
import {
  distanceWords,
  nearPlaces,
  searchPastPlaces,
  searchRows,
  type PlaceOption,
  type PlaceRow,
} from '@/lib/capture/place-search';
import { placeLabel, type LatLng } from '@/lib/finance/places';
import { financeProjection$ } from '@/lib/finance/projection';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { getPlacesClient } from '@/lib/places/client';
import { OWN_COORDS, type SavedPlace } from '@/lib/places/coords';
import { createGoogleSearch, GOOGLE_MIN_CHARS, type GoogleSearch } from '@/lib/places/place-search';
import type { PlacePrediction } from '@/lib/places/types';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { placeName } from '@/lib/transactions/prefetch-location';

/** Street level: a few shopfronts either side of the pin. */
const STREET_DELTA = 0.004;
const GEOCODE_AFTER_MS = 600;
const GEOCODE_RESULTS = 3;
const PIN = 40;
const MAP_H = 220;
const PLACE_ROW_H = 60;
const GAP = 12;
/** The map and the place row under it, which give way to the list while the user types. */
const MAP_BLOCK_H = MAP_H + GAP + PLACE_ROW_H + GAP;

/** What the pin marks. `shop` is a shop the user picked by name; the pin alone names a street. */
type Spot = SavedPlace & { shop: string | null; naming: boolean };

function regionAt(at: LatLng): Region {
  return { ...at, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA };
}

/** The device geocoder's matches for an address; Moni's fallback when Google has nothing. */
function useGeocoded(query: string): PlaceOption[] {
  const [found, setFound] = useState<{ query: string; options: PlaceOption[] }>({
    query: '',
    options: [],
  });
  const q = query.trim();
  useEffect(() => {
    if (q.length < GOOGLE_MIN_CHARS) return;
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
              categoryId: null,
              coords: OWN_COORDS,
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

/** Google's predictions for the query, one billing session per opening of the sheet. */
function useGoogleSearch(
  query: string,
  bias: LatLng | null,
): { google: GoogleSearch; sessionToken: string } {
  const [search, setSearch] = useState<GoogleSearch>({ status: 'idle' });
  const biasRef = useRef(bias);
  biasRef.current = bias;
  const [sessionToken] = useState(randomUUID);
  const [engine] = useState(() =>
    createGoogleSearch({ client: getPlacesClient(), sessionToken, onChange: setSearch }),
  );
  useEffect(() => {
    const at = biasRef.current;
    engine.search(query, at && { latitude: at.latitude, longitude: at.longitude });
  }, [engine, query]);
  useEffect(() => engine.dispose, [engine]);
  return { google: search, sessionToken };
}

/** Whether the search field is in use. Back hides the keyboard but leaves the field focused, so a hidden keyboard ends it too. */
function useSearchFocus(input: RefObject<TextInput | null>) {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const hide = Keyboard.addListener('keyboardDidHide', () => input.current?.blur());
    return () => hide.remove();
  }, [input]);
  const leave = () => {
    input.current?.blur();
    Keyboard.dismiss();
  };
  return { focused, setFocused, leave };
}

const ROW_IN = FadeIn.duration(180);
const ROW_OUT = FadeOut.duration(120);
const ROW_MOVE = LinearTransition.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping);

/** One fixed-height row of the list: a bubble, the place, and its meta or what went wrong. */
function ListRow({
  id,
  leading,
  title,
  meta,
  busy = false,
  error = null,
  onPress,
}: {
  id: string;
  leading: React.ReactNode;
  title: string;
  meta: string | null;
  busy?: boolean;
  error?: string | null;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const line = error ?? meta;
  return (
    <Animated.View
      entering={ROW_IN}
      exiting={ROW_OUT}
      layout={ROW_MOVE}
    >
      <Press
        testID={tid('sheet', 'place', 'result', id)}
        accessibilityLabel={line ? `${title}, ${line}` : title}
        accessibilityState={{ busy }}
        disabled={busy}
        pressedClassName="bg-sand"
        className="h-14 flex-row items-center gap-3 rounded-tile px-2"
        onPress={onPress}
      >
        {leading}
        <View className="min-w-0 flex-1">
          <Text
            variant="rowTitle"
            className="text-foreground"
            numberOfLines={1}
          >
            {title}
          </Text>
          {line ? (
            <Text
              variant="meta"
              className={error ? 'text-danger' : 'text-muted'}
              numberOfLines={1}
            >
              {line}
            </Text>
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator
            size={18}
            color={tokens.muted}
          />
        ) : null}
      </Press>
    </Animated.View>
  );
}

function GlyphBubble({ name }: { name: IconSymbolName }) {
  const tokens = useThemeTokens();
  return (
    <FieldBubble color={tokens.sand}>
      <IconSymbol
        name={name}
        size={17}
        color={tokens.foreground}
      />
    </FieldBubble>
  );
}

function CategoryBubble({ categoryId }: { categoryId: string | null }) {
  const category = useValue(() =>
    categoryId ? financeProjection$.categoriesById[categoryId].get() : undefined,
  );
  if (!category) return <GlyphBubble name="map-marker-outline" />;
  return (
    <TintBubble
      size={32}
      icon={resolveTransactionIcon(category.icon, 'expense')}
      color={category.color}
    />
  );
}

type PlaceSheetProps = SheetFrameProps & {
  request: SheetRequestOf<'place'>;
  onPick: (pick: PlacePick) => void;
};

/**
 * The Location field's sheet: a map under a fixed centre pin, the picked place, search, then a
 * list. With no query the list is "Near you", the user's own places around the map's centre.
 * Typing lists the user's places, then Google's; the map folds away while search is in use. A
 * row, a shop tapped on the map, or a panned pin selects that place and moves the map to it;
 * only Confirm saves it.
 * Only the header drags the sheet, so the map keeps every gesture.
 */
export function PlaceSheet({ request, onPick, ...frame }: PlaceSheetProps) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [hasMap] = useState(mapsAvailable);
  const mapRef = useRef<MapView>(null);
  const naming = useRef(0);
  const [query, setQuery] = useState('');
  const searchInput = useRef<TextInput>(null);
  const search = useSearchFocus(searchInput);
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [spot, setSpot] = useState<Spot | null>(() =>
    request.start ? { ...request.start, shop: null, naming: false } : null,
  );
  const initialRegion = useMemo(
    () => (request.start ? regionAt(request.start) : FALLBACK_REGION),
    [request.start],
  );

  const centre: LatLng | null = spot ?? request.start;
  const searching = query.trim().length > 0;
  const own = useMemo(() => searchPastPlaces(query, request.past), [query, request.past]);
  const near = useMemo(
    () => (searching ? [] : nearPlaces(centre, request.past)),
    [searching, centre, request.past],
  );
  const { google, sessionToken } = useGoogleSearch(query, centre);
  const addresses = useGeocoded(query);
  const rows: PlaceRow[] = searching
    ? searchRows({ own, google, addresses })
    : near.map((option) => ({ kind: 'own', option }));
  const folded = hasMap ? search.focused : false;
  const showsGoogle = rows.some((row) => row.kind === 'google');

  const mapHeight = useSharedValue(MAP_BLOCK_H);
  useEffect(() => {
    mapHeight.set(withSpring(folded ? 0 : MAP_BLOCK_H, springs.sheet));
  }, [folded, mapHeight]);
  const mapBlockStyle = useAnimatedStyle(() => ({
    height: mapHeight.get(),
    opacity: mapHeight.get() / MAP_BLOCK_H,
  }));

  const moveTo = (at: LatLng) => mapRef.current?.animateToRegion(regionAt(at), 300);

  /** A list row or a map shop: it becomes the selected place, and the map shows it. */
  const select = (next: Spot) => {
    scrubStep();
    naming.current += 1;
    search.leave();
    setSpot(next);
    moveTo(next);
  };

  const pickOption = (option: PlaceOption) =>
    select({
      latitude: option.latitude,
      longitude: option.longitude,
      name: option.shop ?? option.title,
      shop: option.shop,
      naming: false,
      coords: option.coords,
    });

  const pickPrediction = async (prediction: PlacePrediction) => {
    setOpening(prediction.placeId);
    setFailed(null);
    const result = await getPlacesClient().details({
      placeId: prediction.placeId,
      sessionToken,
    });
    setOpening(null);
    if (result.status !== 'ok') {
      setFailed(prediction.placeId);
      return;
    }
    select({
      latitude: result.place.latitude,
      longitude: result.place.longitude,
      name: prediction.primaryText,
      shop: prediction.primaryText,
      naming: false,
      coords: {
        source: 'google',
        placeId: result.place.placeId,
        fetchedAt: new Date().toISOString(),
      },
    });
  };

  /** The pin landed somewhere new: name the street it is on. */
  const pinMoved = (at: LatLng) => {
    const ask = ++naming.current;
    setSpot({ ...at, name: null, coords: OWN_COORDS, shop: null, naming: true });
    void placeName(at).then((name) => {
      if (ask !== naming.current) return;
      setSpot((current) => current && { ...current, name, naming: false });
    });
  };

  const locatable =
    hasMap && !(permission && !permission.granted && !permission.canAskAgain);
  const [locating, setLocating] = useState(false);
  const goToPhone = async () => {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) return;
    setLocating(true);
    try {
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const at = { latitude: coords.latitude, longitude: coords.longitude };
      scrubStep();
      moveTo(at);
      pinMoved(at);
    } catch {
      // Location services off: the map stays where it is.
    } finally {
      setLocating(false);
    }
  };

  const spotName = spot
    ? (spot.shop ??
      placeLabel(spot.name)?.name ??
      (spot.naming ? 'Finding the street' : 'Pinned place'))
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
            testID={tid('sheet', 'place', 'confirm')}
            className="flex-[3]"
            pinned
            icon="check"
            label="Confirm"
            disabled={!spot}
            onPress={() =>
              spot &&
              onPick({
                kind: 'chosen',
                place: {
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                  name: spot.shop ?? spot.name,
                  coords: spot.coords,
                },
                shop: spot.shop,
              })
            }
          />
        </>
      }
    >
      <View className="flex-1">
        <Animated.View
          style={[{ overflow: 'hidden' }, mapBlockStyle]}
          pointerEvents={folded ? 'none' : 'auto'}
        >
          <View
            className="overflow-hidden rounded-card bg-sand"
            style={{ height: MAP_H }}
          >
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
                  const { name, coordinate, placeId } = event.nativeEvent;
                  const shop = name.replace(/\s*\n\s*/g, ' ').trim() || null;
                  select({
                    ...coordinate,
                    name: shop,
                    shop,
                    naming: false,
                    coords: { source: 'google', placeId, fetchedAt: new Date().toISOString() },
                  });
                }}
                onRegionChangeComplete={(region, details) => {
                  if (details?.isGesture)
                    pinMoved({ latitude: region.latitude, longitude: region.longitude });
                }}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-6">
                <Text
                  variant="meta"
                  className="text-center text-muted"
                >
                  Map unavailable. Search still finds places.
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
            {locatable ? (
              <Press
                testID={tid('sheet', 'place', 'my-location')}
                accessibilityLabel="Go to where you are"
                accessibilityState={{ busy: locating }}
                disabled={locating}
                hitSlop={6}
                className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-card"
                pressedClassName="bg-hairline"
                onPress={() => void goToPhone()}
              >
                {locating ? (
                  <ActivityIndicator
                    size={18}
                    color={tokens.foreground}
                  />
                ) : (
                  <IconSymbol
                    name="crosshairs-gps"
                    size={20}
                    color={tokens.foreground}
                  />
                )}
              </Press>
            ) : null}
          </View>
          <View
            className="flex-row items-center gap-2.5 rounded-tile bg-sand px-2.5"
            style={{ height: PLACE_ROW_H, marginTop: GAP }}
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
                entering={ROW_IN}
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
        </Animated.View>
        <SearchField
          testID={tid('sheet', 'place', 'search')}
          accessibilityLabel="Search places"
          placeholder="Search a shop or address"
          inputRef={searchInput}
          onFocus={() => search.setFocused(true)}
          onBlur={() => search.setFocused(false)}
          value={query}
          onChangeText={(text) => {
            setFailed(null);
            setQuery(text);
          }}
        />
        <ScrollView
          className="mt-3 flex-1"
          keyboardShouldPersistTaps="handled"
        >
          {!searching && rows.length ? (
            <Text
              variant="meta"
              className="px-2 pb-1 text-muted"
            >
              Near you
            </Text>
          ) : null}
          {rows.map((row) =>
            row.kind === 'google' ? (
              <ListRow
                key={`google:${row.prediction.placeId}`}
                id={row.prediction.placeId}
                leading={<GlyphBubble name="map-marker-outline" />}
                title={row.prediction.primaryText}
                meta={
                  [distanceWords(row.prediction.distanceMeters), row.prediction.secondaryText]
                    .filter(Boolean)
                    .join(' · ') || null
                }
                busy={opening === row.prediction.placeId}
                error={failed === row.prediction.placeId ? "Couldn't open this place. Try again." : null}
                onPress={() => void pickPrediction(row.prediction)}
              />
            ) : (
              <ListRow
                key={`${row.kind}:${row.option.id}`}
                id={row.option.id}
                leading={
                  row.kind === 'own' ? (
                    <CategoryBubble categoryId={row.option.categoryId} />
                  ) : (
                    <GlyphBubble name="map-marker-outline" />
                  )
                }
                title={row.option.title}
                meta={row.option.meta}
                onPress={() => pickOption(row.option)}
              />
            ),
          )}
          {showsGoogle && folded ? (
            <Text
              variant="meta"
              className="px-2 pt-1 text-muted"
            >
              Google Maps
            </Text>
          ) : null}
          {!rows.length ? (
            <Animated.View
              key={searching ? 'searching' : 'near'}
              entering={ROW_IN}
            >
              <Text
                variant="meta"
                className="px-2 py-3 text-muted"
              >
                {searching
                  ? google.status === 'loading'
                    ? 'Searching'
                    : `Nothing found for “${query.trim()}” yet.`
                  : hasMap
                    ? 'Tap a shop on the map, or search.'
                    : 'Search a shop or address.'}
              </Text>
            </Animated.View>
          ) : null}
        </ScrollView>
      </View>
    </Sheet>
  );
}
