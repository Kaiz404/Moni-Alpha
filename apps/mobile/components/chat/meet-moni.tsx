import { View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

const STARTERS: { text: string; icon: IconSymbolName }[] = [
  { text: 'lunch 12.50 at Mamak Ali', icon: 'silverware-fork-knife' },
  { text: 'Set a RM450 food budget', icon: 'chart-box' },
  { text: 'What can you do?', icon: 'creation' },
];

/** The first time chat opens: who Moni is, and three things to try. */
export function MeetMoni({
  name,
  onStarter,
}: {
  name: string | null;
  onStarter: (text: string) => void;
}) {
  const tokens = useThemeTokens();
  const first = name?.trim().split(/\s+/)[0];
  return (
    <View
      accessibilityLabel="Meet Moni"
      className="mb-4 gap-3 rounded-card bg-primary p-[18px]"
    >
      <View className="flex-row items-center gap-1.5">
        <IconSymbol
          name="creation"
          size={16}
          color={tokens.lilac}
        />
        <Text
          variant="caps"
          className="text-primary-foreground opacity-70"
        >
          Moni
        </Text>
      </View>
      <Text
        variant="sectionTitle"
        className="text-primary-foreground"
      >
        {`Hi${first ? ` ${first}` : ''}. Tell me what you spent and I'll file it.`}
      </Text>
      <Text
        variant="body"
        className="text-primary-foreground opacity-85"
      >
        Type it like a text, or tap the mic. Once you have a few days in, I can answer questions about your money too.
      </Text>
      <View className="gap-2">
        {STARTERS.map((starter, index) => (
          <Press
            key={starter.text}
            testID={tid('chat', 'starter', index)}
            onPress={() => onStarter(starter.text)}
            pressedClassName="bg-sand-light"
            className="min-h-12 flex-row items-center gap-3 rounded-tile bg-card py-1.5 pl-1.5 pr-3"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-sand">
              <IconSymbol
                name={starter.icon}
                size={18}
                color={tokens.foreground}
              />
            </View>
            <Text
              variant="body"
              className="flex-1 text-foreground"
            >
              {starter.text}
            </Text>
            <IconSymbol
              name="arrow-up"
              size={18}
              color={tokens.muted}
            />
          </Press>
        ))}
      </View>
    </View>
  );
}
