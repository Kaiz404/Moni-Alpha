import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/** The Home way into Moni chat (D4 keeps it beside the header Moni button). */
export function AskBox({ onPress }: { onPress: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('home', 'ask-box')}
      accessibilityLabel="Ask Moni. Ask or add a transaction"
      onPress={onPress}
      className="h-12 flex-row items-center gap-2.5 rounded-full border-[1.5px] border-hairline bg-card px-4"
    >
      <View pointerEvents="none">
        <IconSymbol
          name="creation"
          size={20}
          color={tokens.deepMint}
        />
      </View>
      <Text
        variant="body"
        className="flex-1 text-ink-2"
      >
        Ask or add a transaction
      </Text>
    </Press>
  );
}
