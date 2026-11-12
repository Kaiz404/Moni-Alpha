import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { VoiceWave } from '@/components/capture/reading-motion';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

import { HeldCapsule, MicButton, useMicHold } from './hold-to-talk';
import { useOnInk } from './ink-card';
import { ListeningPanel } from './listening-panel';

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
  /** Holding the mic: talk while held. Letting go sends, or cancels after sliding left. */
  onHoldStart: () => void;
  onHoldEnd: (send: boolean) => void;
  /** Mic loudness from 0 to 1. */
  level: SharedValue<number>;
  bottomInset: number;
};

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
  onHoldStart,
  onHoldEnd,
  level,
  bottomInset,
}: ChatInputBarProps) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  const canSend = input.trim().length > 0 || !!attachedImage;
  // From the hold's start until its capsule has collapsed, which outlasts the finger.
  const [holding, setHolding] = useState(false);
  const hold = useMicHold({
    onTap: onListen,
    onHoldStart: () => {
      setHolding(true);
      onHoldStart();
    },
    onRelease: (cancelled) => onHoldEnd(!cancelled),
    onSettled: () => setHolding(false),
  });

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

      {listening || holding ? (
        <ListeningPanel
          transcript={input}
          level={level}
          hint={holding ? 'Listening…' : 'Listening. Tap Done to send.'}
        />
      ) : null}
      {listening && !holding ? (
        <View
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
          <View className="flex-1 items-center">
            <VoiceWave
              level={level}
              range={18}
              color={tokens.mintKey}
            />
          </View>
          <Press
            testID={tid('chat', 'listen', 'done')}
            onPress={onDoneListen}
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName="bg-mint-key-pressed"
            className="h-11 justify-center bg-mint-key px-4"
          >
            <Text className="text-[15px] font-display-semibold text-on-mint-key">Done</Text>
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
          <HeldCapsule hold={hold}>
            {holding ? (
              <>
                <VoiceWave
                  level={level}
                  range={16}
                  color={tokens.mintKey}
                />
                <Text
                  accessibilityLiveRegion="polite"
                  className="flex-1 text-[15px] leading-[20px] font-display-semibold text-primary-foreground"
                  numberOfLines={1}
                >
                  {input || 'Let go to send'}
                </Text>
              </>
            ) : null}
          </HeldCapsule>
          {canSend && !holding ? (
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
            <MicButton
              hold={hold}
              holding={holding}
              level={level}
              onTap={onListen}
            />
          )}
        </View>
      )}
    </View>
  );
}
