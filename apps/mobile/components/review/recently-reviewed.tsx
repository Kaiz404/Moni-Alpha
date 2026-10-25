import { useSelector, useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { sourceLabel } from '@/components/transaction/detail-tiles';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListSection } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { TintBubble, TransactionRowBody, rowAmount } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDayHeading } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { formatSignedMoney } from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import { financeProjection$ } from '@/lib/finance/projection';
import { categoriesForUser$, walletsForUser$ } from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { captureTime } from '@/lib/proposals/capture-source';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import {
  listRecentlyReviewed,
  proposalSource,
  type RejectedProposal,
  type ReviewedProposal,
} from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import { transactionRow, type RowLookups, type TransactionRowData } from '@/lib/transactions/row';

type Lookups = RowLookups & {
  aliases: ReturnType<typeof listMerchantAliases>;
  transactionsById: Record<string, FinanceTransaction>;
};

/** `gone`: approved, but its ledger row has since been deleted, so there is nothing to open. */
export type HistoryRow =
  | { kind: 'approved'; id: string; transactionId: string; row: TransactionRowData; meta: string }
  | { kind: 'gone'; id: string; title: string; meta: string; amount: string }
  | {
      kind: 'notMine';
      id: string;
      proposal: RejectedProposal;
      title: string;
      meta: string;
      amount: string;
    };

export type HistoryGroup = { key: string; label: string; rows: HistoryRow[] };

function historyRow(proposal: ReviewedProposal, lookups: Lookups, now: Date): HistoryRow {
  const meta = `${sourceLabel(proposalSource(proposal.sourceType))} · ${captureTime(proposal.transactionDate ?? proposal.createdAt, now)}`;
  const transaction = proposal.transactionId
    ? lookups.transactionsById[proposal.transactionId]
    : undefined;
  if (proposal.status === 'approved' && transaction) {
    const named = { ...transaction, merchant: merchantName(transaction.merchant, lookups.aliases) };
    return {
      kind: 'approved',
      id: proposal.id,
      transactionId: transaction.id,
      row: transactionRow(named, lookups),
      meta,
    };
  }
  const direction =
    proposal.type === 'income' ? 'income' : proposal.type === 'transfer' ? 'transfer' : 'expense';
  const shown = {
    id: proposal.id,
    title:
      merchantName(proposal.merchant, lookups.aliases) ??
      proposal.description ??
      (proposal.type === 'transfer' ? 'Transfer' : 'Capture'),
    meta,
    amount: formatSignedMoney(direction, proposal.amountMinor ?? 0, proposal.currency),
  };
  return proposal.status === 'rejected'
    ? { kind: 'notMine', ...shown, proposal: { ...proposal, status: 'rejected' } }
    : { kind: 'gone', ...shown };
}

export function historyGroups(
  reviewed: readonly ReviewedProposal[],
  lookups: Lookups,
  now: Date,
): HistoryGroup[] {
  const groups = new Map<string, HistoryGroup>();
  for (const proposal of reviewed) {
    const key = toLocalDateInput(new Date(proposal.reviewedAt));
    const group = groups.get(key) ?? {
      key,
      label: formatDayHeading(proposal.reviewedAt, now),
      rows: [],
    };
    group.rows.push(historyRow(proposal, lookups, now));
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function useRecentlyReviewed(): HistoryGroup[] {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId)) ?? [];
  const aliases = useSelector(() => (userId ? listMerchantAliases(userId) : []));
  const transactionsById = useValue(financeProjection$.transactionsById);
  const reviewed = useSelector(() => listRecentlyReviewed(new Date()));
  const lookups: Lookups = {
    categoriesById: Object.fromEntries(categories.map((c) => [c.id, c])),
    walletNames: Object.fromEntries(wallets.map((w) => [w.id, w.name])),
    aliases,
    transactionsById,
  };
  return historyGroups(reviewed, lookups, new Date());
}

export function historyCount(groups: readonly HistoryGroup[]): number {
  return groups.reduce((sum, group) => sum + group.rows.length, 0);
}

function DecisionBody({
  title,
  meta,
  amount,
  notMine,
}: {
  title: string;
  meta: string;
  amount: string;
  notMine: boolean;
}) {
  return (
    <View className="h-[66px] flex-row items-center gap-3.5 px-[18px]">
      <TintBubble
        icon={notMine ? 'close' : 'check'}
        color={null}
      />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {notMine ? (
            <StatusPill
              tone="auto"
              label="Not mine"
              variant="inline"
            />
          ) : null}
          <Text
            variant="meta"
            className="min-w-0 flex-shrink text-muted"
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
      </View>
      <Text
        variant="rowTitle"
        className={notMine ? 'text-muted line-through' : 'text-muted'}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {amount}
      </Text>
    </View>
  );
}

function MoveBackButton({ id, title, onPress }: { id: string; title: string; onPress: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('review', 'history', id, 'move-back')}
      accessibilityLabel={`Move ${title} back to review`}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 flex-row items-center gap-1.5 self-start bg-sand px-4"
    >
      <IconSymbol
        name="undo"
        size={18}
        color={tokens.foreground}
      />
      <Text className="text-[14px] leading-[19px] font-display-semibold text-foreground">
        Move back to review
      </Text>
    </Press>
  );
}

function HistoryItem({
  item,
  onMoveBack,
}: {
  item: HistoryRow;
  onMoveBack: (proposal: RejectedProposal) => void;
}) {
  if (item.kind === 'approved') {
    const amount = rowAmount(item.row);
    return (
      <Press
        testID={tid('review', 'history', item.id)}
        accessibilityLabel={`${item.row.title}, approved, ${item.meta}, ${amount}`}
        onPress={() =>
          router.push({ pathname: '/transaction/[id]', params: { id: item.transactionId } })
        }
      >
        <TransactionRowBody
          row={item.row}
          meta={item.meta}
          amount={amount}
        />
      </Press>
    );
  }
  const notMine = item.kind === 'notMine';
  return (
    <View
      testID={tid('review', 'history', item.id)}
      accessible={!notMine}
      accessibilityLabel={`${item.title}, ${notMine ? 'not mine' : 'approved'}, ${item.meta}, ${item.amount}`}
      className={notMine ? 'pb-2.5' : undefined}
    >
      <DecisionBody
        title={item.title}
        meta={item.meta}
        amount={item.amount}
        notMine={notMine}
      />
      {notMine ? (
        <View className="-mt-1 pl-[74px] pr-[18px]">
          <MoveBackButton
            id={item.id}
            title={item.title}
            onPress={() => onMoveBack(item.proposal)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function RecentlyReviewed({
  groups,
  onMoveBack,
  heading = true,
}: {
  groups: readonly HistoryGroup[];
  onMoveBack: (proposal: RejectedProposal) => void;
  heading?: boolean;
}) {
  if (!groups.length) return null;
  return (
    <View
      testID={tid('review', 'history')}
      className="gap-section"
    >
      {heading ? (
        <Text
          variant="sectionTitle"
          className="pl-1 text-foreground"
          accessibilityRole="header"
        >
          Recently reviewed
        </Text>
      ) : null}
      {groups.map((group) => (
        <ListSection
          key={group.key}
          label={group.label}
        >
          {group.rows.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              onMoveBack={onMoveBack}
            />
          ))}
        </ListSection>
      ))}
    </View>
  );
}

export function HistoryToggle({
  count,
  open,
  onPress,
}: {
  count: number;
  open: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('review', 'history', 'toggle')}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Recently reviewed, ${count}`}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 flex-row items-center gap-1.5 self-center bg-sand px-[18px]"
    >
      <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
        {`Recently reviewed · ${count}`}
      </Text>
      <IconSymbol
        name={open ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={tokens.foreground}
      />
    </Press>
  );
}
