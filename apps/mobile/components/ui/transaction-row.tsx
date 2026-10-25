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
import { formatDay } from '@/lib/dates/day-label';
import {
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/format-money';
import type { TestId } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';

export type MetaLead = 'category' | 'date';

export type TransactionRowProps = {
  testID: TestId;
  row: TransactionRowData;
  metaLead: MetaLead;
  onPress: () => void;
  onHold?: (anchor: HoldAnchor) => void;
  now?: Date;
};

export function rowMeta(
  row: TransactionRowData,
  metaLead: MetaLead,
  now?: Date,
): string {
  if (row.kind === 'transfer')
    return `${row.wallet} → ${row.toWallet}`;
  const lead =
    metaLead === 'category'
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

/** The pill a row shows first in its meta, read aloud with the row. */
function rowPill(row: TransactionRowData): string | null {
  if (row.kind === 'pending') return 'To review';
  return row.autoAdded ? 'Auto' : null;
}

const amountTone: Record<TransactionRowData['kind'], string> = {
  expense: 'text-foreground',
  income: 'text-deep-mint',
  transfer: 'text-muted',
  pending: 'text-ink-2',
};

export function TransactionRow({
  testID,
  row,
  metaLead,
  onPress,
  onHold,
  now,
}: TransactionRowProps) {
  const hold = useHold(onHold);
  const meta = rowMeta(row, metaLead, now);
  const amount = rowAmount(row);
  return (
    <View
      ref={hold?.ref}
      collapsable={false}
    >
      <Press
        testID={testID}
        accessibilityLabel={[row.title, rowPill(row), meta, amount]
          .filter(Boolean)
          .join(', ')}
        accessibilityActions={
          hold
            ? [{ name: 'quickActions', label: 'Quick actions' }]
            : undefined
        }
        onAccessibilityAction={
          hold ? () => hold.openFromCenter() : undefined
        }
        onPress={() => {
          if (!hold || hold.releasedBeforeBloom()) onPress();
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
    <View className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3">
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
              variant="inline"
            />
          ) : row.autoAdded ? (
            <StatusPill
              tone="auto"
              label="Auto"
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
