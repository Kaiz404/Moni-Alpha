import { View } from 'react-native';

import { debtMoney, SIDE_WORDS } from '@/components/debts/debt-words';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DebtSide, DebtSummary } from '@repo/core';

const SIDES = [
  { side: 'owed_to_me', glyph: 'arrow-bottom-left' },
  { side: 'i_owe', glyph: 'arrow-top-right' },
] as const;

/**
 * The Mint hero, read only: where the user stands overall, then a bar that sizes what they are
 * owed against what they owe, with each total under its end (XD-DebtsFilter-B).
 */
export function NetPosition({ summary }: { summary: DebtSummary }) {
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
  const totals: Record<DebtSide, number> = {
    owed_to_me: summary.owedToMeMinor,
    i_owe: summary.iOweMinor,
  };
  const any = totals.owed_to_me + totals.i_owe > 0;
  return (
    <View
      accessibilityLabel="Where you stand"
      className="gap-2.5 rounded-card bg-block-mint py-4 pl-[18px] pr-4"
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
      {any ? (
        <>
          <View
            importantForAccessibility="no-hide-descendants"
            className="mt-0.5 h-2.5 flex-row gap-1"
          >
            {totals.owed_to_me > 0 ? (
              <View
                className="rounded-full bg-on-pastel"
                style={{ flex: totals.owed_to_me }}
              />
            ) : null}
            {totals.i_owe > 0 ? (
              <View
                className="rounded-full bg-card"
                style={{ flex: totals.i_owe }}
              />
            ) : null}
          </View>
          <View className="flex-row justify-between">
            {SIDES.map(({ side, glyph }) => (
              <View
                key={side}
                accessible
                className={`gap-0.5 ${side === 'i_owe' ? 'items-end' : ''}`}
              >
                <View className="flex-row items-center gap-1">
                  <IconSymbol
                    name={glyph}
                    size={16}
                    color={tokens.onPastel}
                  />
                  <Text className="text-[13px] leading-[18px] font-display-semibold text-on-pastel">
                    {SIDE_WORDS[side].tile}
                  </Text>
                </View>
                <Text className="text-[22px] leading-[26px] font-display-bold text-on-pastel">
                  {debtMoney(totals[side], currency)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
