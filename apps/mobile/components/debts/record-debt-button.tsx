import { router } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** The Sand "Record a debt" capsule, in the Debts header and in the empty tile. */
export function RecordDebtButton({ testID }: { testID: TestId }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 flex-row items-center gap-1.5 self-start bg-sand pl-3.5 pr-[18px]"
      onPress={() => router.push('/debt/new')}
    >
      <IconSymbol
        name="plus"
        size={20}
        color={tokens.foreground}
      />
      <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
        Record a debt
      </Text>
    </Press>
  );
}
