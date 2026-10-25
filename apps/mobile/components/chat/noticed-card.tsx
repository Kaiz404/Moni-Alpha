import { View } from 'react-native';

import type { ChatMessage, NoticedItem } from '@/lib/ai/chat/messages';
import { tid } from '@/lib/test-ids';

import { chatTime } from './chat-time';
import { InkCardLabel, InkRow } from './ink-card';

type NoticedMessage = Extract<ChatMessage, { kind: 'assistant_noticed' }>;

/** "Moni noticed": what stood out when today's thread opened; each line asks Moni about it. */
export function NoticedCard({
  message,
  asked,
  onPick,
}: {
  message: NoticedMessage;
  /** Questions already in the thread: their lines dim and show a check. */
  asked: ReadonlySet<string>;
  onPick: (item: NoticedItem) => void;
}) {
  return (
    <View
      accessibilityLabel="Moni noticed"
      className="gap-1 rounded-card bg-primary px-[18px] pb-2.5 pt-3.5"
    >
      <View className="pb-1">
        <InkCardLabel
          label="Moni noticed"
          trailing={chatTime(message.createdAt)}
        />
      </View>
      {message.items.map((item, index) => (
        <InkRow
          key={item.title}
          testID={tid('chat', 'noticed', index)}
          accessibilityLabel={
            item.target.kind === 'ask' ? `Ask Moni: ${item.target.question}` : `${item.title}. Open Review`
          }
          icon={item.icon}
          tint={item.tint ?? 'lilac'}
          title={item.title}
          meta={item.meta}
          done={item.target.kind === 'ask' && asked.has(item.target.question)}
          onPress={() => onPick(item)}
        />
      ))}
    </View>
  );
}
