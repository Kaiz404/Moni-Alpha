import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
const SHADOW = {
  elevation: 12,
  shadowColor: '#17181A',
  shadowOpacity: 0.18,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 12 },
};

export function ToastHost() {
  const toast = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') dismissToast();
    });
    return () => sub.remove();
  }, []);

  if (!toast) return null;
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 px-5"
      style={{ paddingBottom: insets.bottom + 20 }}
    >
      <ToastCapsule
        key={toast.id}
        toast={toast}
      />
    </View>
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
      accessibilityRole="alert"
      className={`min-h-14 flex-row items-center gap-2.5 rounded-full bg-primary py-1.5 pl-[18px] ${toast.undo ? 'pr-1.5' : 'pr-[18px]'}`}
      style={[SHADOW, rise]}
    >
      <IconSymbol
        name={
          toast.tone === 'removed'
            ? 'trash-can-outline'
            : 'check-circle'
        }
        size={20}
        color={
          toast.tone === 'removed'
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
          pressedClassName="bg-ink-2"
          className="h-11 flex-row items-center gap-1.5 rounded-full bg-primary-pressed px-4"
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
