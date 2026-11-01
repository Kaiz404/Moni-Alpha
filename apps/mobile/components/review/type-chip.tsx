import type { TransactionType } from '@repo/types';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';
import { TRANSACTION_TYPE_COPY } from '@/lib/transactions/type-change';

/** A capture's type on the Review card: the card's 32 Sand control, opening the Type sheet. */
export function TypeChip({ type, onPress }: { type: TransactionType; onPress: () => void }) {
  const tokens = useThemeTokens();
  const { label } = TRANSACTION_TYPE_COPY[type];
  return (
    <Press
      testID={tid('review', 'type')}
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={`Type ${label}. Change type`}
      radius={{ rest: 16, pressed: 12 }}
      pressedClassName="bg-hairline"
      className="h-8 flex-row items-center gap-0.5 bg-sand pl-2.5 pr-1.5"
    >
      <Text className="text-[14px] leading-[19px] font-display-semibold text-foreground">
        {label}
      </Text>
      <IconSymbol
        name="chevron-down"
        size={16}
        color={tokens.foreground}
      />
    </Press>
  );
}
