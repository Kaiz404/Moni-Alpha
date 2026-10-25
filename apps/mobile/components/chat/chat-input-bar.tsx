import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { TextInput, View } from 'react-native';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

import { useOnInk } from './ink-card';

type ChatInputBarProps = {
  input: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus: boolean;
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

/** The bars of the listening capsule, in the board's heights. */
const WAVE = [8, 16, 22, 12, 18];

/** The composer: receipt camera, the system keyboard, and the mic (tap to talk, Done to send). */
export function ChatInputBar({
  input,
  onChangeText,
  placeholder,
  autoFocus,
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
  const onInk = useOnInk();
  const canSend = input.trim().length > 0 || !!attachedImage;

  return (
    <View
      className="gap-2 bg-canvas px-3 pt-5"
      style={{ paddingBottom: bottomInset }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${tokens.canvas}00`, tokens.canvas]}
        style={{ position: 'absolute', left: 0, right: 0, top: -16, height: 16 }}
      />
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
          className="h-[52px] flex-row items-center gap-3 rounded-full bg-primary pl-1 pr-1"
        >
          <Press
            testID={tid('chat', 'listen', 'cancel')}
            accessibilityLabel="Cancel"
            onPress={onCancelListen}
            pressedClassName="bg-ink-2/40"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <IconSymbol
              name="close"
              size={20}
              color={onInk.metaGlyph}
            />
          </Press>
          <View
            aria-hidden
            className="h-6 flex-row items-center gap-[3px]"
          >
            {WAVE.map((height, index) => (
              <View
                key={index}
                className="w-[3px] rounded-full bg-mint-key"
                style={{ height }}
              />
            ))}
          </View>
          <Text
            className="flex-1 text-[15px] leading-[20px] font-display-semibold text-primary-foreground"
            numberOfLines={1}
          >
            {input || 'Listening. Tap done to send.'}
          </Text>
          <Press
            testID={tid('chat', 'listen', 'done')}
            onPress={onDoneListen}
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName="bg-mint-key-pressed"
            className="h-11 justify-center bg-mint-key px-4"
          >
            <Text className="text-[15px] font-display-semibold text-on-pastel">Done</Text>
          </Press>
        </View>
      ) : (
        <View className="min-h-[52px] flex-row items-end gap-1 rounded-[26px] border-[1.5px] border-hairline bg-card px-1 py-[2.5px]">
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
              color={tokens.ink2}
            />
          </Press>
          <TextInput
            testID={tid('chat', 'input')}
            accessibilityLabel="Message Moni"
            autoFocus={autoFocus}
            className="max-h-32 min-h-11 flex-1 py-[11px] font-display text-[16px] leading-[22px] text-foreground"
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
                size={20}
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
                name="microphone-outline"
                size={20}
                color={tokens.primaryForeground}
              />
            </Press>
          )}
        </View>
      )}
    </View>
  );
}
