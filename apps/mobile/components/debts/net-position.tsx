import { View } from 'react-native';

import { debtMoney, SIDE_WORDS } from '@/components/debts/debt-words';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type {
  DebtSide,
  DebtSummary,
} from '@/lib/finance/debt-summary';
import { tid } from '@/lib/test-ids';

const TILES = [
  { side: 'owed_to_me', glyph: 'arrow-bottom-left' },
  { side: 'i_owe', glyph: 'arrow-top-right' },
] as const;

/**
 * The Mint hero: where the user stands overall, then one tile per side. A tile
 * filters the people list below it in place (D5); tapping it again clears it.
 */
export function NetPosition({
  summary,
  filter,
  onFilter,
}: {
  summary: DebtSummary;
  filter: DebtSide | null;
  onFilter: (side: DebtSide | null) => void;
}) {
  const tokens = useThemeTokens();
  const { netMinor, currency } = summary;
  const label =
    netMinor > 0
      ? 'Overall, you are owed'
      : netMinor < 0
        ? 'Overall, you owe'
        : summary.owedToMeMinor > 0
          ? 'Overall, you are even'
          : 'Everyone is square';
  const totals = {
    owed_to_me: summary.owedToMeMinor,
    i_owe: summary.iOweMinor,
  };
  return (
    <View
      accessibilityLabel="Where you stand"
      className="gap-3 rounded-card bg-mint py-4 pl-[18px] pr-4"
    >
      <View
        accessible
        accessibilityLiveRegion="polite"
        className="gap-0.5"
      >
        <Text className="text-[15px] leading-[21px] font-display-semibold text-on-pastel">
          {label}
        </Text>
        <Text
          variant="hero"
          className="text-on-pastel"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {debtMoney(Math.abs(netMinor), currency)}
        </Text>
      </View>
      <View className="flex-row gap-2">
        {TILES.map(({ side, glyph }) => {
          const on = filter === side;
          const ink = on
            ? tokens.primaryForeground
            : tokens.foreground;
          const amount = debtMoney(totals[side], currency);
          return (
            <Press
              key={side}
              testID={tid('debts', 'tile', side)}
              accessibilityLabel={`${SIDE_WORDS[side].tile} ${amount}`}
              accessibilityHint={
                on
                  ? 'Shows everyone again'
                  : 'Shows only these people'
              }
              accessibilityState={{ selected: on }}
              pressedClassName={
                on ? 'bg-primary-pressed' : 'bg-sand-light'
              }
              radius={{ rest: 18, pressed: 16 }}
              className={`flex-1 gap-0.5 py-2.5 pl-3.5 pr-2.5 ${on ? 'bg-primary' : 'bg-card'}`}
              onPress={() => onFilter(on ? null : side)}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-[13px] leading-[18px] font-display-semibold ${on ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {SIDE_WORDS[side].tile}
                </Text>
                <IconSymbol
                  name={glyph}
                  size={18}
                  color={ink}
                />
              </View>
              <Text
                className={`text-[22px] leading-[26px] font-display-bold ${on ? 'text-primary-foreground' : 'text-foreground'}`}
                numberOfLines={1}
              >
                {amount}
              </Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}
