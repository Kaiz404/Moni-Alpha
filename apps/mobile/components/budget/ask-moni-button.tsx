import type { Href } from 'expo-router';
import { router } from 'expo-router';

import { MoniGlyph } from '@/components/brand/mascot';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** The Sand capsule that opens Ask Moni to suggest a budget. Optional help, never in the way. */
export function AskMoniButton({
  testID,
  label,
  accessibilityLabel,
  href,
  disabled = false,
}: {
  testID: TestId;
  label: string;
  accessibilityLabel: string;
  href: Href;
  disabled?: boolean;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => router.push(href)}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 flex-row items-center gap-1.5 self-start bg-sand pl-3.5 pr-[18px]"
    >
      <MoniGlyph
        size={18}
        color={tokens.foreground}
      />
      <Text className="text-[15px] leading-5 font-display-semibold text-foreground">{label}</Text>
    </Press>
  );
}
