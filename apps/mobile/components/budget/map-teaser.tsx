import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { Place } from '@/lib/finance/places';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

const HEIGHT = 132;
const PAD = 24;
const MAX_BUBBLES = 12;
const LABELS = 3;
/** The street art is drawn on the board's 314-wide map and stretched to the card. */
const ART_WIDTH = 314;
const ROADS = [
  { d: 'M -4 123 L 318 92', width: 6 },
  { d: 'M 57 -4 L 94 180', width: 5 },
  { d: 'M 182 -4 C 173 70, 195 123, 176 180', width: 5 },
  { d: 'M 220 -4 L 276 180', width: 4 },
];

type MapTeaserProps = {
  places: readonly Place[];
  expenses: number;
  withPlace: number;
  monthName: string;
  currency: string;
  onOpen: () => void;
};

/**
 * "Where you spend" on the Budget tab: the month's places as bubbles sized
 * by spend, the three biggest named. The whole card opens the map.
 */
export function MapTeaser({
  places,
  expenses,
  withPlace,
  monthName,
  currency,
  onOpen,
}: MapTeaserProps) {
  const tokens = useThemeTokens();
  const [width, setWidth] = useState(0);
  const shown = places.slice(0, MAX_BUBBLES);
  const lats = shown.map((place) => place.latitude);
  const lngs = shown.map((place) => place.longitude);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  const biggest = Number(shown[0]?.totalMinor ?? 1);
  const point = (place: Place) => ({
    x:
      PAD +
      ((place.longitude - minLng) / (maxLng - minLng || 1)) *
        (width - PAD * 2 || 1),
    y:
      PAD +
      ((maxLat - place.latitude) / (maxLat - minLat || 1)) *
        (HEIGHT - PAD * 2),
    r: 8 + 13 * Math.sqrt(Number(place.totalMinor) / biggest),
  });
  const single = shown.length === 1;
  const whole = (value: number) =>
    formatMoney(value, currency, { whole: true });
  const caption = expenses
    ? `${places.length === 1 ? '1 place' : `${places.length} places`} · ${withPlace} of ${expenses} expenses had a place`
    : `Nothing spent in ${monthName} yet`;
  const label = shown.length
    ? `Where you spend. Biggest: ${shown
        .slice(0, LABELS)
        .map(
          (place) =>
            `${place.name} ${formatMoney(place.totalMinor, currency)}`,
        )
        .join(', ')}. Open the map`
    : 'Where you spend. Open the map';

  return (
    <Press
      testID={tid('budget', 'open-map')}
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
        className="overflow-hidden rounded-field bg-sand-light"
        style={{ height: HEIGHT }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <>
            <Svg
              width={width}
              height={HEIGHT}
              viewBox={`0 22 ${ART_WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              style={{ position: 'absolute' }}
            >
              <Rect
                x={38}
                y={60}
                width={44}
                height={30}
                rx={12}
                fill={tokens.mint}
                fillOpacity={0.3}
              />
              <Path
                d="M -4 53 C 78 63, 141 109, 195 102 S 270 70, 318 81"
                fill="none"
                stroke={tokens.sky}
                strokeOpacity={0.5}
                strokeWidth={7}
                strokeLinecap="round"
              />
              {ROADS.map((road) => (
                <Path
                  key={road.d}
                  d={road.d}
                  fill="none"
                  stroke={tokens.card}
                  strokeWidth={road.width}
                  strokeLinecap="round"
                />
              ))}
            </Svg>
            <Svg
              width={width}
              height={HEIGHT}
            >
              {[...shown].reverse().map((place, index) => {
                const at = single
                  ? { x: width / 2, y: HEIGHT / 2, r: 18 }
                  : point(place);
                return (
                  <Circle
                    key={index}
                    cx={at.x}
                    cy={at.y}
                    r={at.r}
                    fill={tokens.coral}
                    fillOpacity={0.78}
                    stroke={tokens.foreground}
                    strokeWidth={1.5}
                  />
                );
              })}
            </Svg>
            {shown.slice(0, LABELS).map((place, index) => {
              const at = single
                ? { x: width / 2, y: HEIGHT / 2, r: 18 }
                : point(place);
              const text = `${place.name} · ${whole(Number(place.totalMinor))}`;
              const chipWidth = Math.min(
                width - 16,
                12 + text.length * 7,
              );
              const below = at.y < HEIGHT / 2;
              return (
                <View
                  key={index}
                  pointerEvents="none"
                  className="absolute h-6 justify-center rounded-full bg-card px-2.5"
                  style={{
                    left: Math.max(
                      8,
                      Math.min(
                        width - chipWidth - 8,
                        at.x - chipWidth / 2,
                      ),
                    ),
                    top: Math.max(
                      6,
                      Math.min(
                        HEIGHT - 30,
                        below ? at.y + at.r + 4 : at.y - at.r - 28,
                      ),
                    ),
                    maxWidth: width - 16,
                  }}
                >
                  <Text
                    className="text-[12px] font-display-bold text-foreground"
                    numberOfLines={1}
                  >
                    {text}
                  </Text>
                </View>
              );
            })}
          </>
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
