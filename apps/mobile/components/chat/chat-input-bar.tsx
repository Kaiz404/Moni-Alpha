import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { holdCommit } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
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
  /** Holding the mic: talk while held. Letting go sends, or cancels after sliding left. */
  onHoldStart: () => void;
  onHoldEnd: (send: boolean) => void;
  /** Mic loudness from 0 to 1. */
  level: SharedValue<number>;
  bottomInset: number;
};

/** The bars of the listening capsule, in the board's heights. */
const WAVE = [8, 16, 22, 12, 18];
const HOLD_MS = 250;
/** How far left a held finger slides to cancel instead of send. */
const CANCEL_PX = 72;
const QUIET = 0.35;

function WaveBar({ height, level }: { height: number; level: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: QUIET + (1 - QUIET) * level.get() }],
  }));
  return (
    <Animated.View
      className="w-[3px] rounded-full bg-mint-key"
      style={[{ height }, style]}
    />
  );
}

/** The listening bars, moving with how loud the mic hears you. */
function LiveWave({ level }: { level: SharedValue<number> }) {
  return (
    <View
      aria-hidden
      className="h-6 flex-row items-center gap-[3px]"
    >
      {WAVE.map((height, index) => (
        <WaveBar
          key={index}
          height={height}
          level={level}
        />
      ))}
    </View>
  );
}

/** A ring behind the held mic, swelling with your voice. The outer one reaches further. */
function MicRing({
  reach,
  level,
  className,
}: {
  reach: number;
  level: SharedValue<number>;
  className: string;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1.1 + reach * level.get() }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      className={`absolute inset-0 rounded-full ${className}`}
      style={style}
    />
  );
}

/**
 * The mic stays mounted while held, because the gesture ends with its view. A tap opens the
 * listening capsule as the board draws it, and holding talks until you let go.
 */
function MicButton({
  holding,
  cancelling,
  level,
  onTap,
  onHoldStart,
  onSlide,
  onRelease,
}: {
  holding: boolean;
  cancelling: boolean;
  level: SharedValue<number>;
  onTap: () => void;
  onHoldStart: () => void;
  onSlide: (cancelling: boolean) => void;
  onRelease: (cancelled: boolean) => void;
}) {
  const tokens = useThemeTokens();
  const latest = useRef({ onTap, onHoldStart, onSlide, onRelease });
  useEffect(() => {
    latest.current = { onTap, onHoldStart, onSlide, onRelease };
  });
  const gesture = useMemo(() => {
    const hold = Gesture.Pan()
      .withTestId('chat.mic.hold')
      .runOnJS(true)
      .activateAfterLongPress(HOLD_MS)
      .onStart(() => {
        holdCommit();
        latest.current.onHoldStart();
      })
      .onUpdate((event) => latest.current.onSlide(event.translationX < -CANCEL_PX))
      // From the release itself: a slide and a release in one frame would beat the slide's state.
      .onEnd((event) => latest.current.onRelease(event.translationX < -CANCEL_PX));
    const tap = Gesture.Tap()
      .withTestId('chat.mic.tap')
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) latest.current.onTap();
      });
    return Gesture.Exclusive(hold, tap);
  }, []);

  const grown = useSharedValue(1);
  useEffect(() => {
    grown.set(withSpring(holding ? 1.12 : 1, springs.control));
  }, [grown, holding]);
  const button = useAnimatedStyle(() => ({ transform: [{ scale: grown.get() }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={tid('chat', 'mic')}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Talk to Moni"
        accessibilityHint="Or hold to talk, and let go to send"
        onAccessibilityTap={onTap}
        className={`h-11 w-11 items-center justify-center rounded-full ${holding ? (cancelling ? 'bg-coral' : 'bg-mint-key') : 'bg-primary'}`}
        style={button}
      >
        {holding && !cancelling ? (
          <>
            <MicRing
              reach={1.1}
              level={level}
              className="bg-mint-key/20"
            />
            <MicRing
              reach={0.55}
              level={level}
              className="bg-mint-key/35"
            />
          </>
        ) : null}
        <IconSymbol
          name={cancelling ? 'close' : 'microphone-outline'}
          size={20}
          color={holding ? tokens.onPastel : tokens.primaryForeground}
        />
      </Animated.View>
    </GestureDetector>
  );
}

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
  const [holding, setHolding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

      {listening && !holding ? (
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
          <LiveWave level={level} />
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
          {holding ? (
            <Animated.View
              entering={FadeIn.duration(120)}
              pointerEvents="none"
              accessibilityLiveRegion="polite"
              className="absolute inset-0 flex-row items-center gap-3 rounded-[26px] bg-primary pl-4 pr-14"
            >
              <LiveWave level={level} />
              <Text
                className="flex-1 text-[15px] leading-[20px] font-display-semibold text-primary-foreground"
                numberOfLines={1}
              >
                {cancelling ? 'Let go to cancel' : input || 'Let go to send'}
              </Text>
            </Animated.View>
          ) : null}
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
              holding={holding}
              cancelling={cancelling}
              level={level}
              onTap={onListen}
              onHoldStart={() => {
                setCancelling(false);
                setHolding(true);
                onHoldStart();
              }}
              onSlide={setCancelling}
              onRelease={(cancelled) => {
                setHolding(false);
                setCancelling(false);
                onHoldEnd(!cancelled);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
