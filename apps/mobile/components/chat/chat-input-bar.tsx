import { Image } from 'expo-image';
import { TextInput, View } from 'react-native';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

type ChatInputBarProps = {
  input: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  attachedImage: string | null;
  onRemoveImage: () => void;
  onOpenCamera: () => void;
  onSend: () => void;
  listening: boolean;
  onListen: () => void;
  onCancelListen: () => void;
  onDoneListen: () => void;
  bottomInset: number;
};

/** The composer: receipt camera, the system keyboard, and the mic (tap to talk, Done to stop). */
export function ChatInputBar({
  input,
  onChangeText,
  placeholder,
  attachedImage,
  onRemoveImage,
  onOpenCamera,
  onSend,
  listening,
  onListen,
  onCancelListen,
  onDoneListen,
  bottomInset,
}: ChatInputBarProps) {
  const tokens = useThemeTokens();
  const canSend = input.trim().length > 0 || !!attachedImage;

  return (
    <View
      className="gap-2 bg-canvas px-3 pt-2"
      style={{ paddingBottom: bottomInset + 8 }}
    >
      {attachedImage ? (
        <View className="flex-row items-center gap-3 rounded-tile bg-card p-2 pr-3">
          <Image
            source={{ uri: attachedImage }}
            style={{ width: 52, height: 52, borderRadius: 12 }}
            contentFit="cover"
            accessibilityLabel="Receipt photo"
          />
          <Text
            variant="rowTitle"
            className="flex-1 text-foreground"
          >
            Receipt ready to send
          </Text>
          <HeaderIconButton
            testID={tid('chat', 'remove-receipt')}
            accessibilityLabel="Remove the receipt"
            icon="close"
            onPress={onRemoveImage}
          />
        </View>
      ) : null}

      {listening ? (
        <View
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          className="h-14 flex-row items-center gap-3 rounded-full bg-card pl-1.5 pr-1.5"
        >
          <Press
            testID={tid('chat', 'listen', 'cancel')}
            accessibilityLabel="Cancel"
            onPress={onCancelListen}
            pressedClassName="bg-hairline"
            className="h-11 w-11 items-center justify-center rounded-full bg-sand"
          >
            <IconSymbol
              name="close"
              size={20}
              color={tokens.foreground}
            />
          </Press>
          <Text
            variant="body"
            className="flex-1 text-ink-2"
            numberOfLines={1}
          >
            {input || 'Listening. Tap done to send.'}
          </Text>
          <Press
            testID={tid('chat', 'listen', 'done')}
            onPress={onDoneListen}
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName="bg-primary-pressed"
            className="h-11 justify-center bg-primary px-4"
          >
            <Text className="text-[15px] font-display-semibold text-primary-foreground">Done</Text>
          </Press>
        </View>
      ) : (
        <View className="min-h-14 flex-row items-end gap-1 rounded-[28px] border-[1.5px] border-hairline bg-card p-1.5">
          <Press
            testID={tid('chat', 'scan')}
            accessibilityLabel="Scan a receipt"
            onPress={onOpenCamera}
            pressedClassName="bg-sand"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <IconSymbol
              name="camera-outline"
              size={22}
              color={tokens.foreground}
            />
          </Press>
          <TextInput
            testID={tid('chat', 'input')}
            accessibilityLabel="Message Moni"
            className="max-h-32 min-h-11 flex-1 py-2.5 font-display text-[16px] leading-[22px] text-foreground"
            placeholder={placeholder}
            placeholderTextColor={tokens.muted}
            value={input}
            onChangeText={onChangeText}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          {canSend ? (
            <Press
              testID={tid('chat', 'send')}
              accessibilityLabel="Send"
              onPress={onSend}
              pressedClassName="bg-primary-pressed"
              className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            >
              <IconSymbol
                name="arrow-up"
                size={22}
                color={tokens.primaryForeground}
              />
            </Press>
          ) : (
            <Press
              testID={tid('chat', 'mic')}
              accessibilityLabel="Talk to Moni"
              onPress={onListen}
              pressedClassName="bg-primary-pressed"
              className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            >
              <IconSymbol
                name="microphone"
                size={22}
                color={tokens.primaryForeground}
              />
            </Press>
          )}
        </View>
      )}
    </View>
  );
}
