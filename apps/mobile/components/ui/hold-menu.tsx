import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { holdCommit } from '@/lib/haptics';
import { preferencesMMKV } from '@/lib/mmkv/preferences';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

export const HOLD_BLOOM_MS = 250;
export const HOLD_COMMIT_MS = 500;
const DRIFT_CANCEL_PX = 10;

type Frame = { x: number; y: number; width: number; height: number };

type HeldTouch = {
  pageX: number;
  pageY: number;
  at: number;
  frame: Frame | null;
  cancelled: boolean;
};

/** Where the finger held, and the held row's frame, both in window coordinates. */
export type HoldAnchor = { x: number; y: number; frame: Frame };

/**
 * Hold on a row (V2A-ActivityMenu). Press feedback comes from `Press` at 0 ms;
 * from 250 ms a fill blooms from the finger; at 500 ms the hold commits with
 * the Confirm haptic. A release between 250 and 500 ms, or a drift past 10 px,
 * cancels, and nothing opens.
 */
export function useHold(
  onHold: ((anchor: HoldAnchor) => void) | undefined,
) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<View>(null);
  const bloom = useSharedValue(0);
  const origin = useSharedValue({ x: 0, y: 0, width: 0 });
  const touch = useRef<HeldTouch | null>(null);

  const retract = () => bloom.set(withSpring(0, springs.press));

  const bloomStyle = useAnimatedStyle(() => {
    const { x, y, width } = origin.get();
    const size = width * 2;
    const p = bloom.get();
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: x - size / 2,
      top: y - size / 2,
      opacity: reduceMotion ? p : p > 0 ? 1 : 0,
      transform: [{ scale: reduceMotion ? 1 : 0.05 + 0.95 * p }],
    };
  });

  if (!onHold) return null;

  return {
    ref,
    bloomStyle,
    pressProps: {
      delayLongPress: HOLD_COMMIT_MS,
      onPressIn: (event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        const held: HeldTouch = {
          pageX,
          pageY,
          at: Date.now(),
          frame: null,
          cancelled: false,
        };
        touch.current = held;
        ref.current?.measureInWindow((x, y, width, height) => {
          held.frame = { x, y, width, height };
          origin.set({ x: pageX - x, y: pageY - y, width });
        });
        bloom.set(
          withDelay(
            HOLD_BLOOM_MS,
            reduceMotion
              ? withTiming(1, { duration: 150 })
              : withTiming(1, {
                  duration: HOLD_COMMIT_MS - HOLD_BLOOM_MS,
                  easing: Easing.linear,
                }),
          ),
        );
      },
      onTouchMove: (event: GestureResponderEvent) => {
        const held = touch.current;
        if (!held || held.cancelled) return;
        const { pageX, pageY } = event.nativeEvent;
        if (
          Math.hypot(pageX - held.pageX, pageY - held.pageY) >
          DRIFT_CANCEL_PX
        ) {
          held.cancelled = true;
          retract();
        }
      },
      onPressOut: retract,
      onLongPress: () => {
        const held = touch.current;
        if (!held || held.cancelled || !held.frame) return;
        holdCommit();
        onHold({ x: held.pageX, y: held.pageY, frame: held.frame });
      },
    },
    /** A release after the bloom started is a cancelled hold, not a tap. */
    isTap: () => {
      const held = touch.current;
      return (
        !held ||
        (!held.cancelled && Date.now() - held.at < HOLD_BLOOM_MS)
      );
    },
    /** TalkBack's "Quick actions" opens the menu from the row's centre. */
    openFromCenter: () =>
      ref.current?.measureInWindow((x, y, width, height) =>
        onHold({
          x: x + width / 2,
          y: y + height / 2,
          frame: { x, y, width, height },
        }),
      ),
  };
}

export type HoldAction = 'editCategory' | 'changeWallet' | 'delete';

const ITEMS: {
  action: HoldAction;
  label: string;
  icon: IconSymbolName;
}[] = [
  {
    action: 'editCategory',
    label: 'Edit category',
    icon: 'tag-outline',
  },
  {
    action: 'changeWallet',
    label: 'Change wallet',
    icon: 'wallet-outline',
  },
  { action: 'delete', label: 'Delete', icon: 'trash-can-outline' },
];

const MENU_WIDTH = 220;
const MENU_HEIGHT = ITEMS.length * 44 + 12;
const EDGE = 16;
const GAP = 6;
const SCRIM = 'rgba(23,24,26,0.16)';
const LIFT_SHADOW = {
  elevation: 12,
  shadowColor: '#17181A',
  shadowOpacity: 0.18,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 12 },
};

type HoldMenuProps = {
  screen: Screen;
  anchor: HoldAnchor | null;
  /** The held row, drawn lifted above the dimmed page. */
  preview: ReactNode;
  /** The row's name, for "Quick actions for GRAB*FOOD". */
  name: string;
  onAction: (action: HoldAction) => void;
  onClose: () => void;
};

/**
 * The menu a committed hold opens: the row lifts to 1.02 above a 16% dim and a
 * 220-wide Paper menu springs out from the finger with Edit category, Change
 * wallet, and Delete. Tapping outside or Android back closes it.
 */
export function HoldMenu({
  anchor,
  onClose,
  ...props
}: HoldMenuProps) {
  return (
    <Modal
      visible={anchor !== null}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {anchor ? (
        <HoldMenuLayer
          anchor={anchor}
          onClose={onClose}
          {...props}
        />
      ) : null}
    </Modal>
  );
}

function HoldMenuLayer({
  screen,
  anchor,
  preview,
  name,
  onAction,
  onClose,
}: HoldMenuProps & { anchor: HoldAnchor }) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const shown = useSharedValue(0);

  useEffect(() => {
    markHoldHintSeen();
    shown.set(
      reduceMotion
        ? withTiming(1, { duration: 150 })
        : withSpring(1, springs.sheet),
    );
  }, [reduceMotion, shown]);

  const { frame } = anchor;
  const left = Math.min(
    Math.max(anchor.x - MENU_WIDTH / 2, EDGE),
    window.width - MENU_WIDTH - EDGE,
  );
  const below = frame.y + frame.height + GAP;
  const fitsBelow =
    below + MENU_HEIGHT <= window.height - insets.bottom - EDGE;
  const top = fitsBelow
    ? below
    : Math.max(frame.y - GAP - MENU_HEIGHT, insets.top + EDGE);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(shown.get(), 1),
  }));
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 + 0.02 * shown.get() }],
  }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: Math.min(shown.get(), 1),
    transform: [
      { scale: reduceMotion ? 1 : 0.9 + 0.1 * shown.get() },
    ],
  }));

  return (
    <View className="flex-1">
      <Animated.View
        className="absolute inset-0"
        style={[{ backgroundColor: SCRIM }, scrimStyle]}
      >
        <Pressable
          testID={tid(screen, 'hold', 'close')}
          className="flex-1"
          accessibilityLabel="Close quick actions"
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        className="absolute overflow-hidden rounded-tile bg-bloom"
        style={[
          {
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          },
          LIFT_SHADOW,
          liftStyle,
        ]}
      >
        {preview}
      </Animated.View>
      <Animated.View
        accessibilityRole="menu"
        accessibilityLabel={`Quick actions for ${name}`}
        className="absolute rounded-tile bg-card py-1.5"
        style={[
          {
            left,
            top,
            width: MENU_WIDTH,
            transformOrigin: `${anchor.x - left}px ${fitsBelow ? 0 : MENU_HEIGHT}px`,
          },
          LIFT_SHADOW,
          menuStyle,
        ]}
      >
        {ITEMS.map((item) => {
          const destructive = item.action === 'delete';
          return (
            <Press
              key={item.action}
              testID={tid(screen, 'hold', item.action)}
              accessibilityRole="menuitem"
              className="h-11 flex-row items-center gap-3 px-4"
              onPress={() => onAction(item.action)}
            >
              <IconSymbol
                name={item.icon}
                size={20}
                color={destructive ? tokens.over : tokens.foreground}
              />
              <Text
                className={`text-[15px] leading-[21px] font-display-semibold ${destructive ? 'text-over' : 'text-foreground'}`}
              >
                {item.label}
              </Text>
            </Press>
          );
        })}
      </Animated.View>
    </View>
  );
}

const HINT_SEEN_KEY = 'hold-hint-seen';
const hintListeners = new Set<() => void>();
let hintSeen: boolean | null = null;

function readHintSeen(): boolean {
  hintSeen ??= preferencesMMKV.getBoolean(HINT_SEEN_KEY) ?? false;
  return hintSeen;
}

export function markHoldHintSeen(): void {
  if (readHintSeen()) return;
  hintSeen = true;
  preferencesMMKV.set(HINT_SEEN_KEY, true);
  hintListeners.forEach((listener) => listener());
}

function subscribeHint(listener: () => void) {
  hintListeners.add(listener);
  return () => {
    hintListeners.delete(listener);
  };
}

/**
 * "Hold a row for quick actions", shown above the list until its ✕ or the
 * first hold, then never again.
 */
export function HoldHint({ screen }: { screen: Screen }) {
  const seen = useSyncExternalStore(subscribeHint, readHintSeen);
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  if (seen) return null;
  return (
    <Animated.View
      exiting={
        reduceMotion
          ? FadeOut.duration(150)
          : FadeOutUp.springify()
              .stiffness(springs.sheet.stiffness)
              .damping(springs.sheet.damping)
      }
      className="h-9 flex-row items-center gap-2 self-start rounded-full bg-sand pl-3 pr-1"
    >
      <IconSymbol
        name="gesture-tap-hold"
        size={18}
        color={tokens.ink2}
      />
      <Text className="text-[14px] leading-[19px] font-display-semibold text-foreground">
        Hold a row for quick actions
      </Text>
      <Press
        testID={tid(screen, 'hold-hint', 'dismiss')}
        accessibilityLabel="Dismiss hint"
        hitSlop={8}
        pressedClassName="bg-hairline"
        className="h-7 w-7 items-center justify-center rounded-full"
        onPress={markHoldHintSeen}
      >
        <IconSymbol
          name="close"
          size={16}
          color={tokens.ink2}
        />
      </Press>
    </Animated.View>
  );
}
