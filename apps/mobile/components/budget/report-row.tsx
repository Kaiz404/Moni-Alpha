import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

/** A line of the month's spending that opens its payments: bubble, name over meta, amount, chevron. */
export function ReportRow({
  testID,
  icon,
  color,
  title,
  meta,
  amount,
  onPress,
}: {
  testID: TestId;
  icon: string | null;
  color: string | null;
  title: string;
  meta: string | null;
  amount: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityLabel={[title, meta, amount].filter(Boolean).join(', ')}
      accessibilityHint="Opens these payments"
      className="min-h-[66px] flex-row items-center gap-3.5 py-2 pl-[18px] pr-3"
    >
      <TintBubble
        icon={resolveTransactionIcon(icon, 'expense')}
        color={color}
      />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            variant="meta"
            className="text-muted"
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      <Text
        variant="rowTitle"
        className="text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {amount}
      </Text>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}
