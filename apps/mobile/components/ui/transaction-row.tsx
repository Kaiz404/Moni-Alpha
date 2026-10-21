import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useUniwind } from 'uniwind';

import { useHold, type HoldAnchor } from '@/components/ui/hold-menu';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  formatDay,
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/display';
import type { TestId } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';

export type TransactionRowProps = {
  testID: TestId;
  row: TransactionRowData;
  /** Day-grouped lists read "Category · Wallet"; other lists "Date · Wallet". */
  grouped: boolean;
  onPress: () => void;
  /** Turns on the hold menu for this row. */
  onHold?: (anchor: HoldAnchor) => void;
  now?: Date;
};

export function rowMeta(
  row: TransactionRowData,
  grouped: boolean,
  now?: Date,
): string {
  if (row.kind === 'transfer')
    return `${row.wallet} → ${row.toWallet}`;
  const lead = grouped
    ? (row.category ??
      (row.kind === 'income' ? 'Income' : 'No category'))
    : formatDay(row.date, now);
  return `${lead} · ${row.wallet ?? 'no wallet yet'}`;
}

export function rowAmount(row: TransactionRowData): string {
  return row.kind === 'pending' || row.kind === 'transfer'
    ? formatMoney(row.amountMinor, row.currency)
    : formatSignedMoney(row.kind, row.amountMinor, row.currency);
}

const amountTone: Record<TransactionRowData['kind'], string> = {
  expense: 'text-foreground',
  income: 'text-deep-mint',
  transfer: 'text-muted',
  pending: 'text-ink-2',
};

/**
 * The 66-tall transaction row: tint bubble, title, meta, amount. No chevron and
 * no ⋯; the whole row opens the detail, and a hold opens quick actions.
 */
export function TransactionRow({
  testID,
  row,
  grouped,
  onPress,
  onHold,
  now,
}: TransactionRowProps) {
  const hold = useHold(onHold);
  const meta = rowMeta(row, grouped, now);
  const amount = rowAmount(row);
  return (
    <View
      ref={hold?.ref}
      collapsable={false}
    >
      <Press
        testID={testID}
        accessibilityLabel={`${row.title}, ${meta}, ${amount}`}
        accessibilityActions={
          hold
            ? [{ name: 'quickActions', label: 'Quick actions' }]
            : undefined
        }
        onAccessibilityAction={
          hold ? () => hold.openFromCenter() : undefined
        }
        onPress={() => {
          if (!hold || hold.isTap()) onPress();
        }}
        {...hold?.pressProps}
      >
        {hold ? (
          <Animated.View
            pointerEvents="none"
            className="absolute bg-bloom"
            style={hold.bloomStyle}
          />
        ) : null}
        <TransactionRowBody
          row={row}
          meta={meta}
          amount={amount}
        />
      </Press>
    </View>
  );
}

/** The row's content without its press, as the hold menu lifts it. */
export function TransactionRowBody({
  row,
  meta,
  amount,
}: {
  row: TransactionRowData;
  meta: string;
  amount: string;
}) {
  return (
    <View className="h-[66px] flex-row items-center gap-3.5 px-[18px]">
      <RowBubble row={row} />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {row.title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {row.kind === 'pending' ? (
            <StatusPill
              tone="review"
              label="To review"
              size="row"
            />
          ) : row.autoAdded ? (
            <StatusPill
              tone="auto"
              label="Auto"
              size="row"
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
        className={amountTone[row.kind]}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {amount}
      </Text>
    </View>
  );
}

function RowBubble({ row }: { row: TransactionRowData }) {
  const tokens = useThemeTokens();
  if (row.kind === 'pending') {
    return (
      <View
        className="h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-dashed bg-card"
        style={{ borderColor: row.color ?? tokens.sky }}
      >
        <IconSymbol
          name={row.icon}
          size={20}
          color={tokens.foreground}
        />
      </View>
    );
  }
  return (
    <TintBubble
      icon={row.icon}
      color={row.kind === 'transfer' ? null : row.color}
    />
  );
}

/** The 42 bubble tinted from a category's own colour, or Sand when it has none. */
export function TintBubble({
  icon,
  color,
}: {
  icon: IconSymbolName;
  color: string | null;
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  return (
    <View
      className={`h-[42px] w-[42px] items-center justify-center rounded-full ${color ? '' : 'bg-sand'}`}
      style={
        color
          ? { backgroundColor: `${color}${dark ? '38' : '73'}` }
          : undefined
      }
    >
      <IconSymbol
        name={icon}
        size={20}
        color={color && dark ? color : tokens.foreground}
      />
    </View>
  );
}
