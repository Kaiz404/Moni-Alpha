import { router } from 'expo-router';
import { View } from 'react-native';

import { PersonAvatar } from '@/components/debts/person-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';
import { type DebtLine, formatMoney } from '@repo/core';

/** One settled or written-off debt in the Debts list; the whole row opens its page. */
export function ClosedRow({ line }: { line: DebtLine }) {
  const tokens = useThemeTokens();
  const { id, counterpartyName: name, note, currency } = line.debt;
  const settled = line.state === 'settled';
  const meta = [settled ? 'Settled' : 'Written off', note]
    .filter(Boolean)
    .join(', ');
  return (
    <Press
      testID={tid('debts', 'settled', id)}
      accessibilityLabel={`${name}, ${meta}, ${formatMoney(line.principalMinor, currency)}`}
      className="flex-row items-center gap-3.5 px-[18px] py-3"
      onPress={() =>
        router.push({ pathname: '/debt/[id]', params: { id } })
      }
    >
      <PersonAvatar
        name={name}
        closed
      />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <IconSymbol
            name={settled ? 'check' : 'cancel'}
            size={14}
            color={settled ? tokens.deepMint : tokens.muted}
          />
          <Text
            variant="meta"
            className="min-w-0 flex-1 text-muted"
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
      </View>
      <Text
        variant="rowTitle"
        className="text-muted"
      >
        {formatMoney(line.principalMinor, currency)}
      </Text>
    </Press>
  );
}
