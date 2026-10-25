import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TAB_BAR_REACH,
  tabBarBottom,
} from '@/components/nav/plus-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';
import {
  dismissToast,
  undoToast,
  useToast,
  type ShownToast,
} from '@/lib/toast/toast-store';

const RISE = 8;
const SHADOW = { boxShadow: '0 12px 32px rgba(23,24,26,0.18)' };

export function ToastHost() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const onTabRoot = useSegments()[0] === '(tabs)';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') dismissToast();
    });
    return () => sub.remove();
  }, []);

  // V2F-Components "Toast with Undo": 10 above the + ring on a tab root, else 20 above the keyboard or the bottom edge.
  const rest = onTabRoot
    ? tabBarBottom(insets.bottom) + TAB_BAR_REACH + 10
    : insets.bottom + 20;
  const lift = useAnimatedStyle(() => {
    const up = keyboard.height.get();
    return { paddingBottom: up > 0 ? up + 20 : rest };
  });

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 px-5"
      style={lift}
    >
      <ToastCapsule
        key={toast.id}
        toast={toast}
      />
    </Animated.View>
  );
}

function ToastCapsule({ toast }: { toast: ShownToast }) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.set(
      reduceMotion
        ? withTiming(1, { duration: 150 })
        : withSpring(1, springs.sheet),
    );
  }, [reduceMotion, shown]);

  const rise = useAnimatedStyle(() => ({
    opacity: Math.min(shown.get(), 1),
    transform: [
      { translateY: reduceMotion ? 0 : RISE * (1 - shown.get()) },
    ],
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="polite"
      className={`min-h-14 flex-row items-center gap-2.5 rounded-full bg-primary py-1.5 pl-[18px] ${toast.undo ? 'pr-1.5' : 'pr-[18px]'}`}
      style={[SHADOW, rise]}
    >
      <IconSymbol
        name={
          toast.icon ??
          (toast.tone === 'removed'
            ? 'trash-can-outline'
            : 'check-circle')
        }
        size={20}
        color={
          toast.icon
            ? tokens.primaryForeground
            : toast.tone === 'removed'
              ? tokens.inactive
              : tokens.onInkPositive
        }
      />
      <Text
        className="min-w-0 flex-1 text-[14px] leading-[19px] text-primary-foreground"
        numberOfLines={2}
      >
        {toast.text}
      </Text>
      {toast.undo ? (
        <Press
          testID={tid('nav', 'toast', 'undo')}
          accessibilityLabel="Undo"
          onPress={undoToast}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-ink-2"
          className="h-11 flex-row items-center gap-1.5 bg-primary-pressed px-4"
        >
          <IconSymbol
            name="undo"
            size={18}
            color={tokens.onInkPositive}
          />
          <Text className="text-[14px] leading-[19px] font-display-bold text-on-ink-positive">
            Undo
          </Text>
        </Press>
      ) : null}
    </Animated.View>
  );
}
