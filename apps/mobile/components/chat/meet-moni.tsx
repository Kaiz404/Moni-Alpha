import { View } from 'react-native';

import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { tid } from '@/lib/test-ids';

import { InkCardLabel, InkRow, useOnInk, type SoftTint } from './ink-card';

const STARTERS: { text: string; icon: IconSymbolName; tint: SoftTint }[] = [
  { text: 'lunch 12.50 at Mamak Ali', icon: 'silverware-fork-knife', tint: 'coral' },
  { text: 'Set a RM450 food budget', icon: 'calendar-blank', tint: 'mint' },
  { text: 'What can you do?', icon: 'creation', tint: 'lilac' },
];

/** The first time chat opens: who Moni is, and three things to try. */
export function MeetMoni({
  name,
  onStarter,
}: {
  name: string | null;
  onStarter: (text: string) => void;
}) {
  const onInk = useOnInk();
  const first = name?.trim().split(/\s+/)[0];
  return (
    <View
      accessibilityLabel="Meet Moni"
      className="gap-3.5 rounded-card bg-primary p-[18px]"
    >
      <InkCardLabel label="Moni" />
      <Text
        variant="sectionTitle"
        className="text-primary-foreground"
      >
        {`Hi${first ? ` ${first}` : ''}. Tell me what you spent and I'll file it.`}
      </Text>
      <Text
        variant="body"
        className={onInk.body}
      >
        Type it like a text, or tap the mic. Once you have a few days in, I can answer questions about your money too.
      </Text>
      <View className="gap-1">
        {STARTERS.map((starter, index) => (
          <InkRow
            key={starter.text}
            testID={tid('chat', 'starter', index)}
            icon={starter.icon}
            tint={starter.tint}
            title={starter.text}
            onPress={() => onStarter(starter.text)}
          />
        ))}
      </View>
    </View>
  );
}
