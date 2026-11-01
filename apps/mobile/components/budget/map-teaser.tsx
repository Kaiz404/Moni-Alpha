import type { CurrencyCode } from '@repo/types';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useUniwind } from 'uniwind';

import { mapsAvailable } from '@/components/map/maps-available';
import { FALLBACK_REGION, miniMapStyles } from '@/components/map/map-style';
import { PlacePins, usePinClusters } from '@/components/map/place-pins';
import { usePlaceSources } from '@/components/map/use-places';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { monthSpend } from '@/lib/finance/budget-month';
import { groupPlaces, regionFor, type Place } from '@/lib/finance/places';
import { tid } from '@/lib/test-ids';

const HEIGHT = 132;
const LABELS = 3;
/** Only the biggest places: at this size more pins overlap and clip at the edge. */
const PINS = 3;
/** Room around the outermost pins, which are wider than the point they sit on. */
const ZOOM_OUT = 2;

/** The month's places and how many of its expenses had one. Budget and Home share this. */
export function useMonthPlaces(
  transactions: Parameters<typeof monthSpend>[0],
  month: string,
  daysInMonth: number,
  currency: CurrencyCode,
) {
  return useMemo(() => {
    const spend = monthSpend(transactions, month, currency);
    return {
      places: groupPlaces(transactions, {
        currency,
        range: { from: `${month}-01`, to: `${month}-${daysInMonth}` },
      }),
      expenses: spend.length,
      withPlace: spend.filter(
        (row) => row.locationLatitude !== null && row.locationLongitude !== null,
      ).length,
    };
  }, [transactions, month, daysInMonth, currency]);
}

type MapTeaserProps = {
  /** Where the card is, for its testID. */
  screen: 'home' | 'budget';
  places: readonly Place[];
  expenses: number;
  withPlace: number;
  monthName: string;
  currency: CurrencyCode;
  onOpen: () => void;
};

/**
 * "Where you spend" on the Budget tab: a small still copy of the map page, with its colours and
 * pins, by the owner's direction over V2P-InsightsMonth's drawn map. The whole card opens the map,
 * so the map takes no touches. Lite mode is one still image, which scrolls with the page.
 */
export function MapTeaser({
  screen,
  places,
  expenses,
  withPlace,
  monthName,
  currency,
  onOpen,
}: MapTeaserProps) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const { categoryLook } = usePlaceSources();
  const [hasMap] = useState(mapsAvailable);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const shown = useMemo(() => places.slice(0, PINS), [places]);
  const region = useMemo(() => {
    const framed = regionFor(shown);
    return framed
      ? {
          ...framed,
          latitudeDelta: framed.latitudeDelta * ZOOM_OUT,
          longitudeDelta: framed.longitudeDelta * ZOOM_OUT,
        }
      : FALLBACK_REGION;
  }, [shown]);
  const clusters = usePinClusters(shown, region, size, currency);
  const caption = expenses
    ? `${places.length === 1 ? '1 place' : `${places.length} places`} · ${withPlace} of ${expenses} expenses had a place`
    : `Nothing spent in ${monthName} yet`;
  const label = shown.length
    ? `Where you spend. Biggest: ${places
        .slice(0, LABELS)
        .map(
          (place) =>
            `${place.name} ${formatMoney(place.totalMinor, currency)}`,
        )
        .join(', ')}. Open the map`
    : 'Where you spend. Open the map';

  return (
    <Press
      testID={tid(screen, 'open-map')}
      accessibilityLabel={label}
      onPress={onOpen}
      className="gap-2.5 rounded-card bg-card px-[18px] py-3.5"
    >
      <View className="flex-row items-center justify-between">
        <Text
          variant="cardTitle"
          className="text-foreground"
        >
          Where you spend
        </Text>
        <View className="flex-row items-center gap-0.5">
          <Text className="text-[15px] leading-[21px] font-display-semibold text-deep-mint">
            Open map
          </Text>
          <IconSymbol
            name="chevron-right"
            size={18}
            color={tokens.deepMint}
          />
        </View>
      </View>
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        className="overflow-hidden rounded-field bg-sand-light"
        style={{ height: HEIGHT }}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
      >
        {hasMap ? (
          <MapView
            liteMode
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            customMapStyle={dark ? miniMapStyles.dark : miniMapStyles.light}
            initialRegion={region}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
          >
            <PlacePins
              clusters={clusters}
              selectedId={null}
              currency={currency}
              look={categoryLook}
              onPick={() => undefined}
            />
          </MapView>
        ) : null}
      </View>
      <Text
        variant="meta"
        className="text-muted"
      >
        {caption}
      </Text>
    </Press>
  );
}
