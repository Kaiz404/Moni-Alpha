import type { UpcomingBill } from '@repo/types';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

export type BillLook = {
  wallet: string | null;
  icon: string | null;
  color: string | null;
};

type DueTone = 'late' | 'soon' | 'plain';

/** "Tomorrow", "8 days left": how far off a due date is, counted in local days. */
export function dueLabel(dueDate: string, now: Date): { text: string; tone: DueTone } {
  const due = parseLocalDateInput(dueDate) ?? now;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: 'Overdue', tone: 'late' };
  if (days === 0) return { text: 'Today', tone: 'soon' };
  if (days === 1) return { text: 'Tomorrow', tone: 'soon' };
  return { text: `${days} days left`, tone: 'plain' };
}

const toneClass: Record<DueTone, string> = {
  late: 'text-over',
  soon: 'text-state-attention',
  plain: 'text-foreground',
};

type BillsListProps = {
  bills: readonly UpcomingBill[];
  looks: Record<string, BillLook>;
  now: Date;
  currency: string;
  /** "31 Oct", the end of the month the bills are due in. */
  monthEnd: string;
  onOpen?: (bill: UpcomingBill) => void;
  onAdd?: () => void;
};

/** The Bills block on the Budget tab: what is still due this month, soonest first. */
export function BillsList({ bills, looks, now, currency, monthEnd, onOpen, onAdd }: BillsListProps) {
  const tokens = useThemeTokens();
  const total = bills.reduce((sum, bill) => sum + Number(bill.amountMinor), 0);
  if (!bills.length && !onAdd) return null;
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Bills
        </Text>
        {bills.length ? (
          <Text
            variant="meta"
            className="text-muted"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {`${formatMoney(total, currency)} due by ${monthEnd}`}
          </Text>
        ) : null}
      </View>
      <ListCard>
        {bills.map((bill) => {
          const look = looks[bill.seriesKey];
          const due = dueLabel(bill.dueDate, now);
          const amount = formatMoney(bill.amountMinor, bill.currency);
          const body = (
            <>
              <TintBubble
                icon={resolveTransactionIcon(look?.icon ?? 'repeat', 'expense')}
                color={look?.color ?? null}
              />
              <View className="min-w-0 flex-1">
                <Text
                  variant="rowTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {bill.name}
                </Text>
                <Text
                  variant="meta"
                  className="text-muted"
                  numberOfLines={1}
                >
                  <Text className={`font-display-bold ${toneClass[due.tone]}`}>{due.text}</Text>
                  {look?.wallet ? ` · ${look.wallet}` : ''}
                </Text>
              </View>
              <Text
                variant="rowTitle"
                className="text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {amount}
              </Text>
            </>
          );
          return onOpen ? (
            <Press
              key={bill.seriesKey}
              testID={tid('budget', 'bill', bill.name)}
              accessibilityLabel={`${bill.name}, ${amount}, ${due.text}${look?.wallet ? `, from ${look.wallet}` : ''}`}
              onPress={() => onOpen(bill)}
              className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
            >
              {body}
              <IconSymbol
                name="chevron-right"
                size={20}
                color={tokens.muted}
              />
            </Press>
          ) : (
            <View
              key={bill.seriesKey}
              accessible
              accessibilityLabel={`${bill.name}, ${amount}, ${due.text}${look?.wallet ? `, from ${look.wallet}` : ''}`}
              className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
            >
              {body}
            </View>
          );
        })}
        {onAdd ? (
          <Press
            testID={tid('budget', 'add-bill')}
            accessibilityLabel="Add a bill"
            onPress={onAdd}
            className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
          >
            <View className="h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-dashed border-inactive">
              <IconSymbol
                name="plus"
                size={20}
                color={tokens.foreground}
              />
            </View>
            <Text
              variant="rowTitle"
              className="min-w-0 flex-1 text-foreground"
            >
              Add a bill
            </Text>
            <IconSymbol
              name="chevron-right"
              size={20}
              color={tokens.muted}
            />
          </Press>
        ) : null}
      </ListCard>
    </View>
  );
}
