import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { toggleOff, toggleOn } from '@/lib/haptics';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { tid } from '@/lib/test-ids';
import { Press } from '@/components/ui/press';

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
        <View className="bg-sand mb-2 flex-row items-center rounded-2xl p-2">
          <Image
            source={{ uri: attachedImage }}
            style={{ width: 56, height: 56, borderRadius: 12 }}
            contentFit="cover"
          />
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-display-semibold text-foreground">
              Receipt ready to review
            </Text>
            <Text className="mt-0.5 text-[13px] text-muted">
              Send it when you&apos;re ready.
            </Text>
          </View>
          <HeaderIconButton
            testID={tid('chat', 'remove-attached-receipt')}
            accessibilityLabel="Remove attached receipt"
            icon="close"
            onPress={onRemoveImage}
          />
        </View>
      ) : null}

      {isSpeechRecognizing ? (
        <View className="mb-2 flex-row items-center rounded-2xl bg-primary-muted px-4 py-2.5">
          <View className="h-2 w-2 rounded-full bg-primary" />
          <Text className="ml-2 flex-1 text-[13px] font-display-semibold text-primary">
            Listeningâ€¦ release the microphone when you&apos;re done
          </Text>
        </View>
      ) : null}

      <View
        className="flex-row items-end"
        style={{ paddingBottom: bottomPad }}
      >
        <HeaderIconButton
          testID={tid('chat', 'attach-a-receipt')}
          accessibilityLabel="Attach a receipt photo"
          icon="camera"
          onPress={onOpenCamera}
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
          <Press
            testID={tid('chat', 'mic')}
            pressedClassName="bg-primary-pressed"
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: isSpeechRecognizing
                ? tokens.accents.lilac
                : tokens.primary,
            }}
            onPressIn={() => {
              toggleOn();
              onPressInMic();
            }}
            onPressOut={() => {
              toggleOff();
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
              name="microphone"
              size={22}
              color={
                isSpeechRecognizing
                  ? tokens.onPastel
                  : tokens.primaryForeground
              }
            />
          </Press>
        ) : (
          <Press
            testID={tid('chat', 'send-message')}
            pressedClassName="bg-primary-pressed"
            className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            onPress={onSend}
            disabled={!hasContent || isSpeechRecognizing}
            accessibilityLabel="Send message"
          >
            <IconSymbol
              name="arrow-up"
              size={22}
              color={tokens.primaryForeground}
            />
          </Press>
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
          name="auto-fix"
          size={30}
          color={primary}
        />
      </View>
      <Text className="text-center text-[22px] font-display-bold leading-7 text-foreground">
        A clearer view of your money
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
            <Text className="text-[15px] font-display-semibold text-foreground">
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
