import { router } from 'expo-router';
import { View } from 'react-native';

import { SIDE_WORDS } from '@/components/debts/debt-words';
import { PersonAvatar } from '@/components/debts/person-avatar';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates/day-label';
import type { DebtLine } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

/** An open debt in the people list; the whole row opens the person's page. */
export function PersonRow({ line }: { line: DebtLine }) {
  const {
    id,
    counterpartyName: name,
    direction,
    currency,
  } = line.debt;
  const words = SIDE_WORDS[direction];
  const amount = formatMoney(line.balanceMinor, currency);
  const ink =
    direction === 'owed_to_me' ? 'text-deep-mint' : 'text-foreground';
  return (
    <Press
      testID={tid('debts', 'person', id)}
      accessibilityLabel={
        direction === 'owed_to_me'
          ? `${name} owes you ${amount}`
          : `You owe ${name} ${amount}`
      }
      className="flex-row items-center gap-3.5 px-[18px] py-3"
      onPress={() =>
        router.push({ pathname: '/debt/[id]', params: { id } })
      }
    >
      <PersonAvatar name={name} />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {words.started} {formatDate(line.startedAt)}
        </Text>
      </View>
      <View className="items-end">
        <Text
          variant="rowTitle"
          className={ink}
        >
          {amount}
        </Text>
        <Text
          variant="meta"
          className={ink}
        >
          {words.rowSuffix}
        </Text>
      </View>
    </Press>
  );
}
