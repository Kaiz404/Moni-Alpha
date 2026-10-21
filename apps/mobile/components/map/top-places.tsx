import type { CurrencyCode } from '@repo/types';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { placesTotal, type Place } from '@/lib/finance/places';
import { tid } from '@/lib/test-ids';
import { placeCategoryLine, plural, type CategoryLook } from './use-places';

type TopPlacesProps = {
  places: Place[];
  currency: CurrencyCode;
  look: (categoryId: string | null) => CategoryLook;
  onOpen: (place: Place) => void;
};

export function TopPlaces({ places, currency, look, onOpen }: TopPlacesProps) {
  const tokens = useThemeTokens();
  return (
    <View className="gap-3.5 pt-2.5">
      <View className="flex-row items-baseline justify-between">
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Top places
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`${formatMoney(placesTotal(places), currency, { whole: true })} at ${plural(places.length, 'place')}`}
        </Text>
      </View>
      <ListCard>
        {places.map((place) => {
          const top = look(place.categories[0]?.categoryId ?? null);
          const meta = placeCategoryLine(place, look);
          const amount = formatMoney(place.totalMinor, currency);
          return (
            <Press
              key={place.id}
              testID={tid('map', 'top-place', place.id)}
              accessibilityLabel={`${place.name}, ${meta}, ${amount}`}
              onPress={() => onOpen(place)}
              className="flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
            >
              <TintBubble
                icon={top.icon}
                color={top.color}
              />
              <View className="min-w-0 flex-1">
                <Text
                  variant="rowTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {place.name}
                </Text>
                <Text
                  variant="meta"
                  className="text-muted"
                  numberOfLines={1}
                >
                  {meta}
                </Text>
              </View>
              <Text
                variant="rowTitle"
                className="text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {amount}
              </Text>
              <IconSymbol
                name="chevron-right"
                size={20}
                color={tokens.muted}
              />
            </Press>
          );
        })}
      </ListCard>
    </View>
  );
}
