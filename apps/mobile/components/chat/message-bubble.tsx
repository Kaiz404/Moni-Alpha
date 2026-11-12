import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { isFresh, settle } from '@/lib/ai/chat/fresh-replies';
import type { ChatMessage, NoticedItem, QuickReplyOption } from '@/lib/ai/chat/messages';
import { tid } from '@/lib/test-ids';

import { AnswerCard } from './answer-card';
import { chatTime } from './chat-time';
import { DraftCard } from './draft-card';
import { NoticedCard } from './noticed-card';
import { QuickReplyChips } from './quick-reply-chips';
import { RevealText } from './reveal-text';
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

/**
 * A reply that just replaced the thinking bubble rises in on a spring. `typed`
 * replies leave settling to their RevealText, which needs to see them fresh.
 */
function Arrive({ id, typed, children }: { id: string; typed: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [fresh] = useState(() => isFresh(id) && !reduceMotion);
  useEffect(() => {
    if (!typed) settle(id);
  }, [id, typed]);
  return (
    <Animated.View entering={fresh ? FadeInUp.springify().damping(18).stiffness(220) : undefined}>
      {children}
    </Animated.View>
  );
}

/** One thread item: the user's words on Sand, Moni's on Ink, and Moni's cards. */
export function MessageBubble(props: MessageBubbleProps) {
  const { message } = props;
  if (message.role !== 'assistant' || message.kind === 'assistant_status') return <ThreadItem {...props} />;
  const typed =
    (message.kind === 'assistant_text' && message.status !== 'error') ||
    message.kind === 'assistant_clarify' ||
    (message.kind === 'assistant_card' && message.content.length > 0);
  return (
    <Arrive
      id={message.id}
      typed={typed}
    >
      <ThreadItem {...props} />
    </Arrive>
  );
}

function ThreadItem({ message, asked, onQuickReply, onNoticed }: MessageBubbleProps) {
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
          <RevealText
            messageId={message.id}
            text={message.content}
            color={tokens.primaryForeground}
          />
        </Bubble>
      );
    case 'assistant_clarify':
      return (
        <Bubble
          mine={false}
          fill="bg-primary"
          createdAt={message.createdAt}
        >
          <RevealText
            messageId={message.id}
            text={message.content}
            color={tokens.primaryForeground}
          />
          <QuickReplyChips
            options={message.quickReplies}
            onSelect={(option) => onQuickReply(option, message)}
          />
        </Bubble>
      );
  }
}
