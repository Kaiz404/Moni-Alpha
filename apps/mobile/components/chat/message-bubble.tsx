import { Image } from 'expo-image';
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
  onQuickReply: (option: QuickReplyOption, message: ChatMessage) => void;
  onNoticed: (item: NoticedItem) => void;
};

/** One thread item: the user's words on Sand, Moni's on Ink, and Moni's cards. */
export function MessageBubble({ message, onQuickReply, onNoticed }: MessageBubbleProps) {
  const tokens = useThemeTokens();
  switch (message.kind) {
    case 'user_text':
    case 'user_image':
      return (
        <View className="mb-4 items-end gap-1">
          <View className="max-w-[85%] rounded-[22px] rounded-br-md bg-sand px-4 py-3">
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
          </View>
          <Text
            variant="smallest"
            className="text-muted"
          >
            {chatTime(message.createdAt)}
          </Text>
        </View>
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
          onPick={onNoticed}
        />
      );
    case 'assistant_text':
      if (message.status === 'error')
        return (
          <View
            accessibilityLiveRegion="polite"
            className="mb-4 max-w-[88%] flex-row gap-2 self-start rounded-[22px] rounded-bl-md bg-sand px-4 py-3"
          >
            <IconSymbol
              name="cloud-off-outline"
              size={18}
              color={tokens.ink2}
            />
            <Text
              testID={tid('chat', 'unavailable')}
              variant="body"
              className="flex-1 text-foreground"
            >
              {message.content}
            </Text>
          </View>
        );
      return (
        <View className="mb-4 max-w-[88%] self-start rounded-[22px] rounded-bl-md bg-primary px-4 py-3">
          <Text
            variant="body"
            className="text-primary-foreground"
          >
            {message.content}
          </Text>
        </View>
      );
    case 'assistant_clarify':
      return (
        <View className="mb-4 max-w-[88%] self-start rounded-[22px] rounded-bl-md bg-primary px-4 py-3">
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
        </View>
      );
  }
}
