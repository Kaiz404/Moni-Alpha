import { addMinor, type MinorAmount } from '@repo/types';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';

import { MapEmpty, MapEmptyNote, type EmptyReason } from '@/components/map/map-empty';
import { MapHeader } from '@/components/map/map-header';
import { MapSheet } from '@/components/map/map-sheet';
import { FALLBACK_REGION, mapStyles } from '@/components/map/map-style';
import { PlaceCard } from '@/components/map/place-card';
import { PlacePins, usePinClusters } from '@/components/map/place-pins';
import { TopPlaces } from '@/components/map/top-places';
import { usePlaceSources } from '@/components/map/use-places';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  groupPlaces,
  placeRanges,
  placesTotal,
  regionFor,
  sharePercent,
  type Place,
  type PlaceRangeKey,
  type Region,
} from '@/lib/finance/places';
import { tid } from '@/lib/test-ids';

type MapState =
  | { kind: 'loading' }
  | { kind: 'empty'; reason: EmptyReason }
  | { kind: 'places'; locationOff: boolean };

/** XM-Places draws the sheet's top edge at y 448 on an 844 phone. */
const SHEET_TOP_SHARE = 448 / 844;
/** The map runs under the sheet's rounded top. */
const SHEET_OVERLAP = 32;
/** The floating header row under the status bar. */
const HEADER_HEIGHT = 44;

function categoryChips(places: Place[]) {
  const totals = new Map<string, MinorAmount>();
  for (const place of places)
    for (const { categoryId, totalMinor } of place.categories)
      if (categoryId) totals.set(categoryId, addMinor(totals.get(categoryId) ?? 0, totalMinor));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export default function MapScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dark = useUniwind().theme === 'dark';
  const { currency, transactions, loaded, categoryLook } = usePlaceSources();
  const [permission, requestPermission, getPermission] = Location.useForegroundPermissions();
  const mapRef = useRef<MapView>(null);

  const ranges = useMemo(() => placeRanges(new Date()), []);
  const [rangeKey, setRangeKey] = useState<PlaceRangeKey>('month');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const range = ranges.find((option) => option.key === rangeKey) ?? ranges[1];

  const everywhere = useMemo(() => groupPlaces(transactions, { currency }), [transactions, currency]);
  const inRange = useMemo(() => groupPlaces(transactions, { currency, range }), [transactions, currency, range]);
  const places = useMemo(
    () => (categoryId ? groupPlaces(transactions, { currency, range, categoryId }) : inRange),
    [transactions, currency, range, categoryId, inRange],
  );
  const chips = useMemo(() => categoryChips(inRange), [inRange]);
  const selected = places.find((place) => place.id === selectedId) ?? places[0] ?? null;
  const clusters = usePinClusters(places, region, size, currency);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);

  const locationOff = permission?.status === Location.PermissionStatus.DENIED;
  const state: MapState = !loaded
    ? { kind: 'loading' }
    : everywhere.length === 0
      ? { kind: 'empty', reason: locationOff ? 'location-off' : 'no-places' }
      : { kind: 'places', locationOff };

  const frame = (points: readonly Place[], minDelta?: number) => {
    const next = regionFor(points, minDelta);
    if (next) mapRef.current?.animateToRegion(next, 350);
  };
  const framed = places.length > 0;
  useEffect(() => {
    if (framed) frame(places);
    // Reframe when the filter changes or the first places arrive, not on every recount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, categoryId, framed]);

  const turnOnLocation = async () => {
    const next = permission?.canAskAgain === false ? null : await requestPermission();
    if (!next?.granted) await Linking.openSettings();
  };

  const open = (place: Place) =>
    router.push({ pathname: '/place/[id]', params: { id: place.id, range: rangeKey } });

  const collapsedTop = Math.round(windowHeight * SHEET_TOP_SHARE);
  const categoryWords = categoryId ? ` on ${categoryLook(categoryId).name}` : '';
  const total = placesTotal(places);

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ height: collapsedTop + SHEET_OVERLAP }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          customMapStyle={dark ? mapStyles.dark : mapStyles.light}
          initialRegion={regionFor(everywhere) ?? FALLBACK_REGION}
          showsUserLocation={permission?.granted === true}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          onLayout={(event) => setSize(event.nativeEvent.layout)}
          onRegionChangeComplete={setRegion}
        >
          {state.kind === 'places' ? (
            <PlacePins
              clusters={clusters}
              selectedId={selected?.id ?? null}
              currency={currency}
              look={categoryLook}
              onPick={(cluster) => {
                setSelectedId(cluster.lead.id);
                if (cluster.members.length > 1) frame(cluster.members, 0.004);
              }}
            />
          ) : null}
        </MapView>
        {state.kind === 'empty' ? (
          <MapEmptyNote
            reason={state.reason}
            band={{ top: insets.top + HEADER_HEIGHT, height: collapsedTop - insets.top - HEADER_HEIGHT }}
          />
        ) : null}
      </View>
      <MapHeader
        scope="places"
        title="Where you spend"
        action={{
          name: 'fit',
          icon: 'crosshairs-gps',
          label: 'Fit all places',
          onPress: () => frame(places.length ? places : everywhere),
        }}
      />
      <MapSheet
        collapsedTop={collapsedTop}
        expandedTop={insets.top + 56}
        windowHeight={windowHeight}
      >
        {state.kind === 'loading' ? <Skeleton rows={4} /> : null}
        {state.kind === 'empty' ? (
          <MapEmpty
            reason={state.reason}
            currency={currency}
            onTurnOnLocation={() => void turnOnLocation()}
            onAddExpense={() => router.push('/transaction/new')}
            onPastExpense={() => router.dismissTo('/activity')}
          />
        ) : null}
        {state.kind === 'places' ? (
          <>
            {state.locationOff ? (
              <View className="flex-row items-center gap-2 rounded-full bg-sand py-1 pl-4 pr-1">
                <Text
                  className="min-w-0 flex-1 text-[14px] leading-[19px] text-foreground"
                  numberOfLines={2}
                >
                  Location is off, so new expenses get no place.
                </Text>
                <Button
                  testID={tid('map', 'location-off', 'turn-on')}
                  label="Turn on"
                  variant="tertiary"
                  onPress={() => void turnOnLocation()}
                />
              </View>
            ) : null}
            <Segmented
              screen="map"
              name="range"
              options={ranges.map((option) => ({ value: option.key, label: option.label }))}
              value={rangeKey}
              onChange={setRangeKey}
              accessibilityLabel="Time range"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-5 flex-grow-0"
              contentContainerClassName="gap-2 px-5"
              accessibilityLabel="Category"
            >
              <Chip
                testID={tid('map', 'category', 'all')}
                label="All"
                selected={categoryId === null}
                onPress={() => setCategoryId(null)}
              />
              {chips.map((id) => (
                <Chip
                  key={id}
                  testID={tid('map', 'category', id)}
                  label={categoryLook(id).name}
                  selected={categoryId === id}
                  onPress={() => setCategoryId(id)}
                />
              ))}
            </ScrollView>
            {selected ? (
              <View className="mt-1">
                <PlaceCard
                  place={selected}
                  look={categoryLook(selected.categories[0]?.categoryId ?? null)}
                  currency={currency}
                  sentence={`${sharePercent(selected.totalMinor, total)}% of what you spent${categoryWords} at a place ${range.words}.`}
                  onOpen={() => open(selected)}
                />
              </View>
            ) : null}
            <TopPlaces
              places={places}
              currency={currency}
              look={categoryLook}
              onOpen={open}
              emptyLine={`Nothing${categoryWords} with a place ${range.words}.`}
            />
          </>
        ) : null}
      </MapSheet>
    </View>
  );
}
