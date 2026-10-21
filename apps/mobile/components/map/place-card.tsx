import type { CurrencyCode } from '@repo/types';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import type { Place } from '@/lib/finance/places';
import { tid } from '@/lib/test-ids';
import { plural, type CategoryLook } from './use-places';

type PlaceCardProps = {
  place: Place;
  look: CategoryLook;
  currency: CurrencyCode;
  sentence: string;
  onOpen: () => void;
};

/**
 * The selected place, fixed in the sheet: the owner asked for it to stay part
 * of the page rather than a card that can be swiped away (canvas thread
 * f08b2d0e). It takes its colour from the place's biggest category.
 */
export function PlaceCard({ place, look, currency, sentence, onOpen }: PlaceCardProps) {
  const tokens = useThemeTokens();
  const amount = formatMoney(place.totalMinor, currency);
  return (
    <View
      accessibilityLabel={`Selected place, ${place.name}, ${amount}`}
      accessibilityLiveRegion="polite"
      className={`gap-3 rounded-card p-[18px] ${look.color ? '' : 'bg-sand'}`}
      style={look.color ? { backgroundColor: look.color } : undefined}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-card">
          <IconSymbol
            name={look.icon}
            size={20}
            color={tokens.foreground}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className={`text-[20px] leading-[24px] font-display-bold ${look.color ? 'text-on-pastel' : 'text-foreground'}`}
            numberOfLines={1}
          >
            {place.name}
          </Text>
          <Text
            variant="meta"
            className={look.color ? 'text-on-pastel' : 'text-foreground'}
            numberOfLines={1}
          >
            {`${plural(place.count, 'payment')} on ${plural(place.days, 'day')}`}
          </Text>
        </View>
        <Text
          className={`text-[22px] leading-[26px] font-display-bold ${look.color ? 'text-on-pastel' : 'text-foreground'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {amount}
        </Text>
      </View>
      <Text
        variant="body"
        className={look.color ? 'text-on-pastel' : 'text-foreground'}
      >
        {sentence}
      </Text>
      <Press
        testID={tid('map', 'place-card', 'open')}
        onPress={onOpen}
        accessibilityLabel={`See ${place.name}`}
        radius={{ rest: 26, pressed: 16 }}
        pressedClassName="bg-primary-pressed"
        className="h-[52px] flex-row items-center justify-center gap-1.5 bg-primary"
      >
        <Text className="text-[15px] leading-[21px] font-display-semibold text-primary-foreground">
          See this place
        </Text>
        <IconSymbol
          name="chevron-right"
          size={20}
          color={tokens.primaryForeground}
        />
      </Press>
    </View>
  );
}
