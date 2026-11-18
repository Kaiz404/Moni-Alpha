import { ScrollView, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

const STARTERS: { title: string; meta: string; send: string; icon: IconSymbolName }[] = [
  { title: 'Log a lunch', meta: '12.50 at Mamak Ali', send: 'lunch 12.50 at Mamak Ali', icon: 'silverware-fork-knife' },
  { title: 'Set a budget', meta: 'RM450 for food', send: 'Set a RM450 food budget', icon: 'calendar-blank' },
  { title: 'Ask Moni', meta: 'what it can do', send: 'What can you do?', icon: 'chat-question-outline' },
];

const LEAVE = FadeOut.duration(160);

/** The first open's hello, top left of the empty thread. */
export function BlankGreeting({ name }: { name: string | null }) {
  const first = name?.trim().split(/\s+/)[0];
  return (
    <Animated.View
      exiting={LEAVE}
      className="px-5 pt-6"
    >
      <Text
        variant="screenTitle"
        className="text-foreground"
      >
        {`Hi${first ? ` ${first}` : ''}.`}
      </Text>
      <Text
        variant="screenTitle"
        className="text-muted"
      >
        What did you spend?
      </Text>
    </Animated.View>
  );
}

/** Three things to try, side by side above the composer; the third peeks off the edge. */
export function StarterCards({ onStarter }: { onStarter: (text: string) => void }) {
  const tokens = useThemeTokens();
  return (
    <Animated.View exiting={LEAVE}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 px-3"
      >
        {STARTERS.map((starter, index) => (
          <Press
            key={starter.send}
            testID={tid('chat', 'starter', index)}
            onPress={() => onStarter(starter.send)}
            className="flex-row items-center gap-3 rounded-tile bg-card py-3 pl-3.5 pr-4"
          >
            <IconSymbol
              name={starter.icon}
              size={20}
              color={tokens.foreground}
            />
            <View>
              <Text className="text-[15px] leading-[20px] font-display-bold text-foreground">
                {starter.title}
              </Text>
              <Text
                variant="meta"
                className="text-muted"
              >
                {starter.meta}
              </Text>
            </View>
          </Press>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
