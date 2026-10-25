import { View } from 'react-native';

import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { RiseIn, RiseInGroup } from '@/components/ui/rise-in';
import { Text } from '@/components/ui/text';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { FinanceTransaction } from '@/lib/finance/types';
import { tid } from '@/lib/test-ids';
import {
  transactionRow,
  type RowLookups,
} from '@/lib/transactions/row';

/** "Recent": the newest three rows and See all, or the first-run empty tile. */
export function RecentList({
  transactions,
  lookups,
  onOpen,
  onSeeAll,
  onAdd,
}: {
  transactions: readonly FinanceTransaction[];
  lookups: RowLookups;
  onOpen: (transaction: FinanceTransaction) => void;
  onSeeAll: () => void;
  onAdd: () => void;
}) {
  const tokens = useThemeTokens();
  const hold = useTransactionHold('home');
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Recent
        </Text>
        {transactions.length ? (
          <Press
            testID={tid('home', 'recent', 'see-all')}
            onPress={onSeeAll}
            pressedClassName="bg-transparent"
            className="min-h-11 flex-row items-center gap-0.5"
          >
            <Text className="text-[15px] font-display-semibold text-deep-mint">
              See all
            </Text>
            <IconSymbol
              name="chevron-right"
              size={18}
              color={tokens.deepMint}
            />
          </Press>
        ) : null}
      </View>
      {transactions.length ? (
        <ListCard>
          <RiseInGroup>
            {transactions.map((transaction, index) => {
              const row = transactionRow(transaction, lookups);
              return (
                <RiseIn
                  key={transaction.id}
                  index={index}
                >
                  <TransactionRow
                    testID={tid(
                      'home',
                      'recent',
                      'row',
                      transaction.id,
                    )}
                    row={row}
                    metaLead="date"
                    onPress={() => onOpen(transaction)}
                    onHold={hold.holdFor(transaction, row)}
                  />
                </RiseIn>
              );
            })}
          </RiseInGroup>
        </ListCard>
      ) : (
        <EmptyTile
          tone="quiet"
          icon="receipt-text"
          title="No transactions yet"
          body="Type it, scan a receipt or tell Moni. Your newest show here."
          action={{
            testID: tid('home', 'recent', 'add'),
            label: 'Add a transaction',
            icon: 'plus',
            onPress: onAdd,
          }}
        />
      )}
      {hold.menu}
    </View>
  );
}
