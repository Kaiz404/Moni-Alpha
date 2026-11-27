import type { CurrencyCode, MinorAmount } from '@repo/types';
import { glyphOn } from '@/lib/theme/glyph-on';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { CategoryLook } from './use-places';
import { clusterPins, formatMoney, pinMix, projector, singlePin, type PinCluster, type Place, type Region } from '@repo/core';

type Size = { width: number; height: number };

/** XM-Places capsule width: bubble and padding, 18 more per stacked bubble, ~8 per glyph, and the count badge. */
function pinWidth(label: string, members: number, discs: number): number {
  return 40 + (discs - 1) * 18 + label.length * 8 + (members > 1 ? 26 : 0);
}

export function usePinClusters(
  places: Place[],
  region: Region | null,
  size: Size | null,
  currency: CurrencyCode,
): PinCluster[] {
  return useMemo(() => {
    if (!region || !size) return places.map(singlePin);
    return clusterPins(places, projector(region, size), (total: MinorAmount, members, discs) =>
      pinWidth(formatMoney(total, currency, { whole: true }), members, discs),
    );
  }, [places, region, size, currency]);
}

type PlacePinsProps = {
  clusters: PinCluster[];
  selectedId: string | null;
  currency: CurrencyCode;
  look: (categoryId: string | null) => CategoryLook;
  onPick: (cluster: PinCluster) => void;
};

export function PlacePins({ clusters, selectedId, currency, look, onPick }: PlacePinsProps) {
  return clusters.map((cluster) => {
    const on = cluster.members.some((member) => member.id === selectedId);
    const label = formatMoney(cluster.totalMinor, currency, { whole: true });
    const names = cluster.members.map((member) => member.name).join(' and ');
    return (
      <PinMarker
        key={`${cluster.lead.id}:${on}:${cluster.members.length}:${label}:${cluster.categories.map((category) => category.categoryId).join(',')}`}
        cluster={cluster}
        on={on}
        label={label}
        look={look}
        accessibilityLabel={`${names}, ${formatMoney(cluster.totalMinor, currency)}`}
        onPress={() => onPick(cluster)}
      />
    );
  });
}

/**
 * Android draws a custom marker as a bitmap. It tracks view changes only while
 * the capsule first lays out, and the parent remounts it (by key) when its
 * look changes, so panning never re-rasterises every pin.
 */
function PinMarker({
  cluster,
  on,
  label,
  look,
  accessibilityLabel,
  onPress,
}: {
  cluster: PinCluster;
  on: boolean;
  label: string;
  look: (categoryId: string | null) => CategoryLook;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), 600);
    return () => clearTimeout(timer);
  }, []);
  const multi = cluster.members.length > 1;
  return (
    <Marker
      coordinate={cluster.lead}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking}
      zIndex={on ? 5 : 2}
      accessibilityLabel={accessibilityLabel}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <View
        className={`h-8 flex-row items-center gap-1.5 rounded-full border-[1.5px] pl-[3px] pr-2.5 ${on ? 'border-primary bg-primary' : 'border-hairline bg-card'}`}
      >
        <PinBubbles
          cluster={cluster}
          on={on}
          look={look}
        />
        <Text
          className={`text-[14px] leading-[19px] font-display-bold ${on ? 'text-primary-foreground' : 'text-foreground'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {label}
        </Text>
        {multi ? (
          <View className={`h-5 min-w-5 items-center justify-center rounded-full px-[5px] ${on ? 'bg-ink-2' : 'bg-sand'}`}>
            <Text
              className={`text-[12px] leading-[16px] font-display-bold ${on ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {cluster.members.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

/** A pin's categories as overlapping bubbles, largest first, the last slot "+N" past three. */
function PinBubbles({
  cluster,
  on,
  look,
}: {
  cluster: PinCluster;
  on: boolean;
  look: (categoryId: string | null) => CategoryLook;
}) {
  const { shown, more } = pinMix(cluster.categories);
  const ring = on ? 'border-primary' : 'border-card';
  return (
    <View className="flex-row items-center">
      {shown.map(({ categoryId }, index) => {
        const bubble = (
          <PinBubble
            key={categoryId ?? 'none'}
            look={look(categoryId)}
            size={24}
            glyph={14}
          />
        );
        return index ? (
          <View
            key={categoryId ?? 'none'}
            className={`-ml-[10px] rounded-full border-2 ${ring}`}
          >
            {bubble}
          </View>
        ) : (
          bubble
        );
      })}
      {more ? (
        <View className={`-ml-[10px] rounded-full border-2 ${ring}`}>
          <View className="h-6 w-6 items-center justify-center rounded-full bg-sand">
            <Text className="text-[10px] leading-[14px] font-display-bold text-foreground">+{more}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A pin's category bubble, as on a row: the colour solid with an Ink glyph.
 */
export function PinBubble({ look, size, glyph }: { look: CategoryLook; size: number; glyph: number }) {
  const tokens = useThemeTokens();
  return (
    <View
      className="overflow-hidden rounded-full bg-sand"
      style={{ width: size, height: size }}
    >
      <View
        className="flex-1 items-center justify-center"
        style={look.color ? { backgroundColor: look.color } : undefined}
      >
        <IconSymbol
          name={look.icon}
          size={glyph}
          color={look.color ? glyphOn(look.color) : tokens.foreground}
        />
      </View>
    </View>
  );
}
