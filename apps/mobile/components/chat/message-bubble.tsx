import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ChatMessage, NoticedItem, QuickReplyOption } from '@/lib/ai/chat/messages';
import { tid } from '@/lib/test-ids';

import { AnswerCard } from './answer-card';
import { chatTime } from './chat-time';
import { DraftCard } from './draft-card';
import { NoticedCard } from './noticed-card';
import { QuickReplyChips } from './quick-reply-chips';
import { ThinkingCard } from './thinking-card';

type MessageBubbleProps = {
  message: ChatMessage;
  asked: ReadonlySet<string>;
  onQuickReply: (option: QuickReplyOption, message: ChatMessage) => void;
  onNoticed: (item: NoticedItem) => void;
};

/** A 280-wide bubble with its time under it: the user's on the right, Moni's on the left. */
function Bubble({
  mine,
  fill,
  createdAt,
  children,
}: {
  mine: boolean;
  fill: string;
  createdAt: string;
  children: ReactNode;
}) {
  return (
    <View className={`max-w-[280px] gap-1 ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
      <View className={`rounded-[22px] px-4 py-2.5 ${mine ? 'rounded-br-md' : 'rounded-bl-md'} ${fill}`}>
        {children}
      </View>
      <Text
        variant="smallest"
        className="text-muted"
      >
        {chatTime(createdAt)}
      </Text>
    </View>
  );
}

/** One thread item: the user's words on Sand, Moni's on Ink, and Moni's cards. */
export function MessageBubble({ message, asked, onQuickReply, onNoticed }: MessageBubbleProps) {
  const tokens = useThemeTokens();
  switch (message.kind) {
    case 'user_text':
    case 'user_image':
      return (
        <Bubble
          mine
          fill="bg-sand"
          createdAt={message.createdAt}
        >
          {message.kind === 'user_image' ? (
            <Image
              source={{ uri: message.imageUri }}
              style={{ width: 200, height: 140, borderRadius: 12, marginBottom: message.content ? 8 : 0 }}
              contentFit="cover"
              accessibilityLabel="Receipt photo"
            />
          ) : null}
          {message.content ? (
            <Text
              variant="body"
              className="text-foreground"
            >
              {message.content}
            </Text>
          ) : null}
        </Bubble>
      );
    case 'assistant_status':
      return <ThinkingCard label={message.content} />;
    case 'assistant_draft':
      return <DraftCard message={message} />;
    case 'assistant_card':
      return <AnswerCard message={message} />;
    case 'assistant_noticed':
      return (
        <NoticedCard
          message={message}
          asked={asked}
          onPick={onNoticed}
        />
      );
    case 'assistant_text':
      if (message.status === 'error')
        return (
          <Bubble
            mine={false}
            fill="bg-sand"
            createdAt={message.createdAt}
          >
            <View
              accessibilityLiveRegion="polite"
              className="flex-row gap-2"
            >
              <IconSymbol
                name="cloud-off-outline"
                size={18}
                color={tokens.ink2}
              />
              <Text
                testID={tid('chat', 'unavailable')}
                variant="body"
                className="shrink text-foreground"
              >
                {message.content}
              </Text>
            </View>
          </Bubble>
        );
      return (
        <Bubble
          mine={false}
          fill="bg-primary"
          createdAt={message.createdAt}
        >
          <Text
            variant="body"
            className="text-primary-foreground"
          >
            {message.content}
          </Text>
        </Bubble>
      );
    case 'assistant_clarify':
      return (
        <Bubble
          mine={false}
          fill="bg-primary"
          createdAt={message.createdAt}
        >
          <Text
            variant="body"
            className="text-primary-foreground"
          >
            {message.content}
          </Text>
          <QuickReplyChips
            options={message.quickReplies}
            onSelect={(option) => onQuickReply(option, message)}
          />
        </Bubble>
      );
  }
}
