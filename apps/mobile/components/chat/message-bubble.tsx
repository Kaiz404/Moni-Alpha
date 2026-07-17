import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type {
  ChatMessage,
  QuickReplyOption,
} from '@/lib/ai/chat/messages';
import { QuickReplyChips } from './quick-reply-chips';

type MessageBubbleProps = {
  message: ChatMessage;
  onQuickReply?: (
    option: QuickReplyOption,
    message: ChatMessage,
  ) => void;
};

/** Clear human/Moni attribution without turning conversation into a card wall. */
export function MessageBubble({
  message,
  onQuickReply,
}: MessageBubbleProps) {
  const tokens = useThemeTokens();
  const isUser = message.role === 'user';

  if (message.kind === 'assistant_status' && message.status === 'processing') {
    return (
      <View className="mb-4 flex-row items-center" accessibilityLiveRegion="polite">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-muted">
          <ActivityIndicator size="small" color={tokens.primary} />
        </View>
        <Text className="ml-2 text-[13px] font-medium text-muted">
          {message.content}
        </Text>
      </View>
    );
  }

  if (isUser) {
    return (
      <View className="mb-4 items-end">
        <View className="max-w-[88%] rounded-[22px] rounded-br-md bg-primary px-4 py-3">
          {message.imageUri ? (
            <Image
              source={{ uri: message.imageUri }}
              style={{
                width: 200,
                height: 140,
                borderRadius: 12,
                marginBottom: message.content ? 8 : 0,
              }}
              contentFit="cover"
            />
          ) : null}
          {message.content ? (
            <Text className="text-[15px] leading-[22px] text-primary-foreground">
              {message.content}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  const isError = message.status === 'error';
  return (
    <View className="mb-4 items-start">
      <View className="mb-1 flex-row items-center">
        <View className="h-5 w-5 items-center justify-center rounded-full bg-primary-muted">
          <IconSymbol
            name={isError ? 'info-outline' : 'auto-awesome'}
            size={12}
            color={isError ? tokens.danger : tokens.primary}
          />
        </View>
        <Text className="ml-1.5 text-[12px] font-semibold text-muted">
          Moni
        </Text>
      </View>
      <View
        className={`max-w-[88%] rounded-[22px] rounded-tl-md border px-4 py-3 ${
          isError ? 'border-danger/25 bg-danger/10' : 'border-border bg-card'
        }`}
      >
        <Text
          className={`text-[15px] leading-[22px] ${
            isError ? 'text-danger' : 'text-foreground'
          }`}
        >
          {message.content}
        </Text>
        {message.kind === 'assistant_clarify' &&
        message.quickReplies &&
        message.pendingContext &&
        onQuickReply ? (
          <QuickReplyChips
            options={message.quickReplies}
            onSelect={(option) => onQuickReply(option, message)}
          />
        ) : null}
      </View>
    </View>
  );
}
