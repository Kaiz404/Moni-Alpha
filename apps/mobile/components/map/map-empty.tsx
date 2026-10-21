import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { currencySymbol } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

export type EmptyReason = 'location-off' | 'no-places';

const COPY = {
  'location-off': {
    note: 'Location off',
    noteIcon: 'map-marker-off-outline',
    title: 'You turned off location',
    body: 'Moni stops pinning a place on what you add, so this map stays empty. Turn it back on and your next expense lands here.',
  },
  'no-places': {
    note: 'No places yet',
    noteIcon: 'map-marker-outline',
    title: 'No places yet',
    body: 'Pay somewhere with location on and it lands here. Bills and online buys stay off the map.',
  },
} as const;

/** The capsule XM-Empty sets in the middle of the faded map. */
export function MapEmptyNote({ reason }: { reason: EmptyReason }) {
  const tokens = useThemeTokens();
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 items-center justify-center bg-canvas/45"
    >
      <View className="h-10 flex-row items-center gap-2 rounded-full border-[1.5px] border-hairline bg-card pl-3 pr-4">
        <IconSymbol
          name={COPY[reason].noteIcon}
          size={18}
          color={tokens.foreground}
        />
        <Text className="text-[14px] leading-[19px] font-display-semibold text-foreground">
          {COPY[reason].note}
        </Text>
      </View>
    </View>
  );
}

type MapEmptyProps = {
  reason: EmptyReason;
  currency: string;
  onTurnOnLocation: () => void;
  onAddExpense: () => void;
  onPastExpense: () => void;
};

/** The sheet body of XM-Empty, for location off and for no places yet. */
export function MapEmpty({
  reason,
  currency,
  onTurnOnLocation,
  onAddExpense,
  onPastExpense,
}: MapEmptyProps) {
  return (
    <View
      accessibilityLabel={reason === 'location-off' ? 'Location is off' : 'No places yet'}
      className="gap-[18px] pt-1.5"
    >
      <View className="gap-2">
        <Text
          variant="screenTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          {COPY[reason].title}
        </Text>
        <Text
          variant="body"
          className="text-ink-2"
        >
          {COPY[reason].body}
        </Text>
      </View>
      <View className="flex-row items-center gap-3.5 rounded-tile border-[1.5px] border-dashed border-hairline p-[18px]">
        <View className="h-8 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-border-strong pl-[3px] pr-2.5">
          <View className="h-6 w-6 rounded-full bg-sand" />
          <Text className="text-[14px] leading-[19px] font-display-bold text-muted">
            {`${currencySymbol(currency)}—`}
          </Text>
        </View>
        <Text
          variant="body"
          className="min-w-0 flex-1 text-ink-2"
        >
          Your first place shows up here, with what you spent there.
        </Text>
      </View>
      {reason === 'location-off' ? (
        <Button
          testID={tid('map', 'empty', 'turn-on-location')}
          label="Turn location back on"
          icon="map-marker"
          pinned
          onPress={onTurnOnLocation}
        />
      ) : (
        <Button
          testID={tid('map', 'empty', 'add-expense')}
          label="Add an expense"
          icon="plus"
          pinned
          onPress={onAddExpense}
        />
      )}
      <Button
        testID={tid('map', 'empty', 'past-expense')}
        label="Add a place to a past expense"
        variant="tertiary"
        icon="chevron-right"
        className="-mt-2 self-center"
        onPress={onPastExpense}
      />
      <Text
        variant="meta"
        className="text-center text-muted"
      >
        Bills and online buys never need a place. Moni reads your location only when you add something or a payment
        arrives.
      </Text>
    </View>
  );
}
