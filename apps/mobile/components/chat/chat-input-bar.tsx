import {
  View,
  TextInput,
  Pressable,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Image } from 'expo-image';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hapticVoiceStart, hapticVoiceStop } from '@/lib/haptics';

type ChatInputBarProps = {
  input: string;
  onChangeText: (text: string) => void;
  attachedImage: string | null;
  onRemoveImage: () => void;
  onOpenCamera: () => void;
  onSend: () => void;
  isSpeechRecognizing: boolean;
  onPressInMic: () => void;
  onPressOutMic: () => void;
  bottomPad: number;
};

export function ChatInputBar({
  input,
  onChangeText,
  attachedImage,
  onRemoveImage,
  onOpenCamera,
  onSend,
  isSpeechRecognizing,
  onPressInMic,
  onPressOutMic,
  bottomPad,
}: ChatInputBarProps) {
  const tokens = useThemeTokens();
  const hasContent = input.trim().length > 0 || !!attachedImage;
  const showMicMode = isSpeechRecognizing || !hasContent;
  const inputPlaceholder = isSpeechRecognizing
    ? 'Listening… speak now'
    : 'Message Moni…';

  return (
    <>
      {attachedImage ? (
        <View className="px-4 pb-2 pt-1">
          <View className="flex-row items-center rounded-xl border border-border bg-card p-2 shadow-sm">
            <Image
              source={{ uri: attachedImage }}
              style={{ width: 56, height: 56, borderRadius: 8 }}
              contentFit="cover"
            />
            <Text
              className="ml-3 flex-1 text-sm text-muted"
              numberOfLines={1}
            >
              Receipt attached
            </Text>
            <Pressable
              onPress={onRemoveImage}
              className="h-9 w-9 items-center justify-center"
              hitSlop={8}
            >
              <IconSymbol
                name="close"
                size={22}
                color={tokens.muted}
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        className="flex-row items-end border-t border-border bg-background px-4 pt-2"
        style={{ paddingBottom: bottomPad }}
      >
        <Pressable
          className="mr-2 h-11 w-11 items-center justify-center rounded-full bg-card"
          onPress={onOpenCamera}
        >
          <IconSymbol
            name="photo-camera"
            size={24}
            color={tokens.primary}
          />
        </Pressable>

        <TextInput
          className="mr-2 max-h-28 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground"
          placeholder={inputPlaceholder}
          placeholderTextColor={tokens.muted}
          value={input}
          onChangeText={onChangeText}
          multiline
          editable={!isSpeechRecognizing}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSend}
        />

        {showMicMode ? (
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: isSpeechRecognizing
                ? tokens.danger
                : tokens.primary,
            }}
            onPressIn={() => {
              hapticVoiceStart();
              onPressInMic();
            }}
            onPressOut={() => {
              hapticVoiceStop();
              onPressOutMic();
            }}
            accessibilityLabel={
              isSpeechRecognizing ? 'Listening' : 'Hold to speak'
            }
          >
            <IconSymbol
              name="mic"
              size={24}
              color="#ffffff"
            />
          </Pressable>
        ) : (
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: tokens.primary }}
            onPress={onSend}
            disabled={!hasContent || isSpeechRecognizing}
            activeOpacity={0.7}
          >
            <IconSymbol
              name="send"
              size={22}
              color="#ffffff"
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

type ChatEmptyStateProps = {
  primary: string;
};

export function ChatEmptyState({ primary }: ChatEmptyStateProps) {
  const suggestions = [
    'Coffee $5 at Starbucks',
    'How much did I spend on food this month?',
    'Am I over budget on dining?',
    'Or snap a photo of your receipt',
  ];

  return (
    <View className="items-center px-4 py-12">
      <View
        className="mb-4 h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${primary}33` }}
      >
        <IconSymbol
          name="chat-bubble-outline"
          size={36}
          color={primary}
        />
      </View>
      <Text className="mb-2 text-xl font-semibold text-foreground">
        Chat with Moni
      </Text>
      <Text className="mb-8 text-center text-sm leading-5 text-muted">
        Log transactions, scan receipts, or ask about your finances.
      </Text>
      <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Try asking
      </Text>
      <View className="w-full">
        {suggestions.map((s) => (
          <View
            key={s}
            className="mb-2 rounded-xl border border-border bg-card px-4 py-3"
          >
            <Text className="text-sm text-foreground">{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
