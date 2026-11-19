import { View } from 'react-native';
import { glyphOn } from '@/lib/theme/glyph-on';
import Animated from 'react-native-reanimated';

import { useHold, type HoldAnchor } from '@/components/ui/hold-menu';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';
import { dayLabel, formatMoney, formatSignedMoney } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

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
  if (row.kind === 'transfer') return `${row.wallet} to ${row.toWallet}`;
  const lead =
    metaLead === 'category'
      ? (row.category ??
        (row.kind === 'income' ? 'Income' : 'No category'))
      : dayLabel(deviceCalendar.dayKey(row.date), deviceCalendar.dayKey(now ?? new Date()));
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
          {row.kind === 'transfer' ? (
            <TransferMeta
              from={row.wallet}
              to={row.toWallet}
            />
          ) : (
            <Text
              variant="meta"
              className="min-w-0 flex-shrink text-muted"
              numberOfLines={1}
            >
              {meta}
            </Text>
          )}
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

/** A transfer's meta: the two wallets with an arrow icon centred between them. */
function TransferMeta({ from, to }: { from: string; to: string }) {
  const tokens = useThemeTokens();
  return (
    <View className="min-w-0 flex-shrink flex-row items-center gap-1">
      <Text
        variant="meta"
        className="min-w-0 flex-shrink text-muted"
        numberOfLines={1}
      >
        {from}
      </Text>
      <IconSymbol
        name="arrow-right"
        size={14}
        color={tokens.muted}
      />
      <Text
        variant="meta"
        className="min-w-0 flex-shrink text-muted"
        numberOfLines={1}
      >
        {to}
      </Text>
    </View>
  );
}

function RowBubble({ row }: { row: TransactionRowData }) {
  const tokens = useThemeTokens();
  // Rows only carry names that passed transactionIcon's MDI check.
  const icon = row.icon as IconSymbolName;
  if (row.kind === 'pending') {
    return (
      <View
        className="h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-dashed bg-card"
        style={{ borderColor: row.color ?? tokens.sky }}
      >
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.foreground}
        />
      </View>
    );
  }
  return (
    <TintBubble
      icon={icon}
      color={row.color}
    />
  );
}

/** Bubble diameter to glyph size: Type it fields 32, rows 42, picker tiles 44, detail heroes 52. */
export const BUBBLE_GLYPH = {
  32: 17,
  42: 20,
  44: 22,
  52: 24,
} as const;

export type TintBubbleSize = keyof typeof BUBBLE_GLYPH;

export function TintBubble({
  icon,
  color,
  size = 42,
}: {
  icon: IconSymbolName;
  color: string | null;
  size?: TintBubbleSize;
}) {
  const tokens = useThemeTokens();
  return (
    <View
      className={`items-center justify-center rounded-full ${color ? '' : 'bg-sand'}`}
      style={[
        { width: size, height: size },
        color ? { backgroundColor: color } : null,
      ]}
    >
      <IconSymbol
        name={icon}
        size={BUBBLE_GLYPH[size]}
        color={color ? glyphOn(color) : tokens.foreground}
      />
    </View>
  );
}
