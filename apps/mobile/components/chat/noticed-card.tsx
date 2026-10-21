import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ChatMessage, NoticedItem } from '@/lib/ai/chat/messages';
import { tid } from '@/lib/test-ids';

import { chatTime } from './chat-time';

type NoticedMessage = Extract<ChatMessage, { kind: 'assistant_noticed' }>;

/** "Moni noticed": what stood out when today's thread opened; each line asks about it. */
export function NoticedCard({
  message,
  onPick,
}: {
  message: NoticedMessage;
  onPick: (item: NoticedItem) => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View
      accessibilityLabel="Moni noticed"
      className="mb-4 gap-1 rounded-card bg-primary px-3.5 py-3.5"
    >
      <View className="flex-row items-center gap-1.5 px-1 pb-1">
        <IconSymbol
          name="creation"
          size={16}
          color={tokens.lilac}
        />
        <Text
          variant="caps"
          className="flex-1 text-primary-foreground opacity-70"
        >
          Moni noticed
        </Text>
        <Text
          variant="smallest"
          className="text-primary-foreground opacity-70"
        >
          {chatTime(message.createdAt)}
        </Text>
      </View>
      {message.items.map((item, index) => (
        <Press
          key={item.title}
          testID={tid('chat', 'noticed', index)}
          accessibilityLabel={
            item.target.kind === 'ask' ? `Ask Moni: ${item.target.question}` : `${item.title}. Open Review`
          }
          onPress={() => onPick(item)}
          pressedClassName="bg-ink-2/40"
          className="flex-row items-center gap-3 rounded-tile px-1 py-2"
        >
          <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-lilac">
            <IconSymbol
              name={item.icon}
              size={20}
              color={tokens.onPastel}
            />
          </View>
          <View className="min-w-0 flex-1">
            <Text
              variant="rowTitle"
              className="text-primary-foreground"
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              variant="meta"
              className="text-primary-foreground opacity-70"
              numberOfLines={1}
            >
              {item.meta}
            </Text>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-foreground">
            <IconSymbol
              name={item.target.kind === 'ask' ? 'arrow-up' : 'chevron-right'}
              size={18}
              color={tokens.primary}
            />
          </View>
        </Press>
      ))}
    </View>
  );
}
