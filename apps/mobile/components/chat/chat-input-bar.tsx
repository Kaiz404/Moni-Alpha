import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { IconAction } from '@/components/ui/icon-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Surface } from '@/components/ui/surface';
import { TactilePressable } from '@/components/ui/tactile-pressable';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
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

/** Quiet, touch-friendly composer with text, receipt, and voice entry. */
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const hasContent = input.trim().length > 0 || !!attachedImage;
  const showMicMode = isSpeechRecognizing || !hasContent;
  const inputPlaceholder = isSpeechRecognizing
    ? 'Listeningâ€¦ speak naturally'
    : 'Ask or add a transaction';

  return (
    <View className="border-t border-border-subtle bg-canvas px-5 pt-2">
      {attachedImage ? (
        <Surface className="mb-2 flex-row items-center rounded-2xl p-2" tone="muted">
          <Image
            source={{ uri: attachedImage }}
            style={{ width: 56, height: 56, borderRadius: 12 }}
            contentFit="cover"
          />
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-foreground">
              Receipt ready to review
            </Text>
            <Text className="mt-0.5 text-[13px] text-muted">
              Send it when you&apos;re ready.
            </Text>
          </View>
          <IconAction
            accessibilityLabel="Remove attached receipt"
            icon="close"
            onPress={onRemoveImage}
            tone="default"
          />
        </Surface>
      ) : null}

      {isSpeechRecognizing ? (
        <View className="mb-2 flex-row items-center rounded-2xl bg-primary-muted px-4 py-2.5">
          <View className="h-2 w-2 rounded-full bg-primary" />
          <Text className="ml-2 flex-1 text-[13px] font-semibold text-primary">
            Listeningâ€¦ release the microphone when you&apos;re done
          </Text>
        </View>
      ) : null}

      <View
        className="flex-row items-end"
        style={{ paddingBottom: bottomPad }}
      >
        <IconAction
          accessibilityLabel="Attach a receipt photo"
          icon="photo-camera"
          onPress={onOpenCamera}
          tone="accent"
        />

        <TextInput
          className={`ml-2 mr-2 min-h-11 max-h-30 flex-1 rounded-2xl bg-card px-4 py-2.5 text-base leading-5 text-foreground ${
            isInputFocused ? 'border border-primary' : ''
          }`}
          placeholder={inputPlaceholder}
          placeholderTextColor={tokens.muted}
          value={input}
          onChangeText={onChangeText}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          multiline
          editable={!isSpeechRecognizing}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSend}
          accessibilityLabel="Message Moni"
        />

        {showMicMode ? (
          <TactilePressable
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: isSpeechRecognizing
                ? tokens.accents.lilac
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
              isSpeechRecognizing
                ? 'Listening. Release to stop recording'
                : 'Hold to speak to Moni'
            }
            accessibilityHint="Hold while speaking, then release to add your words"
          >
            <IconSymbol
              name="mic"
              size={22}
              color={
                isSpeechRecognizing ? tokens.foreground : tokens.primaryForeground
              }
            />
          </TactilePressable>
        ) : (
          <TactilePressable
            className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            onPress={onSend}
            disabled={!hasContent || isSpeechRecognizing}
            accessibilityLabel="Send message"
          >
            <IconSymbol
              name="arrow-upward"
              size={22}
              color={tokens.primaryForeground}
            />
          </TactilePressable>
        )}
      </View>
    </View>
  );
}

type ChatEmptyStateProps = {
  primary: string;
  onSuggestion?: (text: string) => void;
};

/** Companion cue and useful, data-safe starting prompts for a new chat. */
export function ChatEmptyState({
  primary,
  onSuggestion,
}: ChatEmptyStateProps) {
  const suggestions = [
    'How much did I spend on food this month?',
    'Help me set a budget for dining',
    'Add a coffee for $5',
  ];

  return (
    <View className="flex-1 items-center justify-center px-5 py-12">
      <View
        className="mb-5 h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${primary}26` }}
      >
        <IconSymbol
          name="auto-awesome"
          size={30}
          color={primary}
        />
      </View>
      <Text className="text-center text-[22px] font-bold leading-7 text-foreground">
        A clearer view of your money
      </Text>
      <Text className="mt-2 max-w-sm text-center text-[15px] leading-[22px] text-muted">
        Ask Moni a question, describe a transaction, or attach a receipt.
        You&apos;ll always review changes before they&apos;re added.
      </Text>
      <View className="mt-7 w-full max-w-md gap-2">
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => onSuggestion?.(suggestion)}
            disabled={!onSuggestion}
            className="rounded-2xl bg-card px-4 py-3.5 active:bg-surface-2"
            accessibilityRole="button"
          >
            <Text className="text-[15px] font-medium text-foreground">
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
