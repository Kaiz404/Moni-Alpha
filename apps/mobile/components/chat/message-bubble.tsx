import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ChatMessage, QuickReplyOption } from '@/lib/ai/chat/messages';
import { QuickReplyChips } from './quick-reply-chips';

type MessageBubbleProps = {
  message: ChatMessage;
  onQuickReply?: (option: QuickReplyOption, message: ChatMessage) => void;
};

export function MessageBubble({ message, onQuickReply }: MessageBubbleProps) {
  const tokens = useThemeTokens();
  const isUser = message.role === 'user';

  if (message.kind === 'assistant_clarify') {
    return (
      <View className="mb-3 items-start">
        <View className="max-w-[88%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
          <Text className="text-sm leading-6 text-foreground">{message.content}</Text>
          {message.quickReplies && message.pendingContext && onQuickReply ? (
            <QuickReplyChips
              options={message.quickReplies}
              onSelect={(option) => onQuickReply(option, message)}
            />
          ) : null}
        </View>
      </View>
    );
  }

  if (message.kind === 'assistant_status' && message.status === 'processing') {
    return (
      <View className="mb-3 items-start">
        <View className="flex-row items-center max-w-[88%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
          <ActivityIndicator size="small" color={tokens.primary} />
          <Text className="ml-2 text-sm text-muted">{message.content}</Text>
        </View>
      </View>
    );
  }

  if (isUser) {
    return (
      <View className="mb-3 items-end">
        <View className="max-w-[88%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3">
          {message.imageUri ? (
            <Image
              source={{ uri: message.imageUri }}
              style={{ width: 200, height: 140, borderRadius: 10, marginBottom: message.content ? 8 : 0 }}
              contentFit="cover"
            />
          ) : null}
          {message.content ? (
            <Text className="text-sm leading-6 text-white">{message.content}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View className="mb-3 items-start">
      <View
        className={`max-w-[88%] rounded-2xl rounded-tl-sm border px-4 py-3 ${
          message.status === 'error'
            ? 'border-danger/30 bg-danger/10'
            : 'border-border bg-card'
        }`}
      >
        <Text
          className={`text-sm leading-6 ${
            message.status === 'error' ? 'text-danger' : 'text-foreground'
          }`}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}
