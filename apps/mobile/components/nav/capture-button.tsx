import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { Surface } from '@/components/ui/surface';
import { runFabReceiptScan } from '@/lib/receipts/scan-receipt';
import {
  captureActionDestination,
  type CaptureActionId,
} from './capture-actions';

type CaptureAction = {
  id: CaptureActionId;
  label: string;
  detail: string;
  icon: ComponentProps<typeof MaterialDesignIcons>['name'];
};

const ACTIONS: readonly CaptureAction[] = [
  {
    id: 'scan',
    label: 'Scan receipt',
    detail: 'Capture and review a receipt',
    icon: 'receipt-text',
  },
  {
    id: 'expense',
    label: 'Add expense',
    detail: 'Record money spent manually',
    icon: 'minus-circle-outline',
  },
  {
    id: 'income',
    label: 'Add income',
    detail: 'Record money received manually',
    icon: 'plus-circle-outline',
  },
] as const;

/** Shared FAB geometry for the tab bar and the capture menu anchor. */
export const CAPTURE_FAB_LAYOUT = {
  size: 64,
  /** Leave only one quarter of the FAB above the tab bar. */
  peekHeight: 16,
  /** Approximate content height used only before the FAB can be measured. */
  fallbackTabBarContentHeight: 60,
} as const;

/**
 * Tweak these together to refine the FAB cradle without changing its path
 * calculation or animation wiring.
 */
export const FAB_MENU_SHAPE = {
  /** Diameter of the lower, circular half of the droplet. */
  notchDiameter: 80,
  /** Half the width where the droplet blends into the menu surface. */
  notchUpperHalfWidth: 150,
  /** Distance from the menu edge to the semicircle's diameter line. */
  notchShoulderDrop: 16,
  /** Maximum vertical handle used to ease into the lower semicircle. */
  notchShoulderEndHandle: 30,
  notchSheetOverlap: 1,
  panelBottomPadding: 16,
  /** Position the menu edge relative to the measured FAB's top. */
  panelBottomAtFabTopOffset: 16,
} as const;

const MENU_ANIMATION_DURATION = 280;

function CaptureMenuItem({
  action,
  index,
  reducedMotion,
  onPress,
}: {
  action: CaptureAction;
  index: number;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      reducedMotion ? 0 : index * 56,
      withTiming(1, {
        duration: reducedMotion ? 120 : 210,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [index, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: reducedMotion
          ? 0
          : interpolate(progress.value, [0, 1], [18, 0]),
      },
      {
        scale: reducedMotion
          ? 1
          : interpolate(progress.value, [0, 1], [0.96, 1]),
      },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityHint={action.detail}
      >
        {({ pressed }) => (
          <Surface
            tone="default"
            className="mb-3 min-h-16 flex-row items-center px-4 py-3"
            style={{
              backgroundColor: pressed
                ? tokens.primaryMuted
                : tokens.card,
            }}
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
              <MaterialDesignIcons
                name={action.icon}
                size={22}
                color={tokens.primary}
              />
            </View>
            <View className="ml-3 min-w-0 flex-1">
              <Text className="text-base font-bold text-foreground">
                {action.label}
              </Text>
            </View>
          </Surface>
        )}
      </Pressable>
    </Animated.View>
  );
}

function CaptureFab({
  accessibilityLabel,
  accessibilityHint,
  expanded,
  onPress,
  animatedStyle,
  iconColor,
}: {
  accessibilityLabel: string;
  accessibilityHint?: string;
  expanded?: boolean;
  onPress: () => void;
  animatedStyle: ComponentProps<typeof Animated.View>['style'];
  iconColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        expanded === undefined ? undefined : { expanded }
      }
      onPress={onPress}
      className="h-16 w-16 items-center justify-center rounded-full bg-accent"
    >
      <Animated.View style={animatedStyle}>
        <MaterialDesignIcons
          name="plus"
          size={30}
          color={iconColor}
        />
      </Animated.View>
    </Pressable>
  );
}

/** A custom lower edge lets the FAB sit in a continuous, tangent-matched curve. */
function FabMenuNotch({
  width,
  color,
}: {
  width: number;
  color: string;
}) {
  const {
    notchDiameter,
    notchShoulderDrop,
    notchShoulderEndHandle,
    notchSheetOverlap,
    notchUpperHalfWidth,
  } = FAB_MENU_SHAPE;
  const center = width / 2;
  const radius = notchDiameter / 2;
  const depth = notchShoulderDrop + radius;
  const circleLeft = center - radius;
  const circleRight = center + radius;
  const semicircleControl = radius * 0.55228475;
  const shoulderSpan = Math.max(0, notchUpperHalfWidth - radius);
  const shoulderEndHandle = Math.min(
    notchShoulderEndHandle,
    notchShoulderDrop,
    Math.sqrt((2 * radius * shoulderSpan) / 3),
  );
  // Match the shoulder's curvature to the lower semicircle at their join.
  const shoulderStartHandle = Math.max(
    0,
    shoulderSpan - (3 * shoulderEndHandle ** 2) / (2 * radius),
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        // Overlap the sheet so native anti-aliasing cannot reveal a seam.
        bottom: -depth + notchSheetOverlap,
        left: 0,
        width,
        height: depth,
      }}
    >
      <Svg
        width={width}
        height={depth}
        viewBox={`0 0 ${width} ${depth}`}
      >
        <Path
          fill={color}
          d={`M ${center - notchUpperHalfWidth} 0 C ${center - notchUpperHalfWidth + shoulderStartHandle} 0 ${circleLeft} ${notchShoulderDrop - shoulderEndHandle} ${circleLeft} ${notchShoulderDrop} C ${circleLeft} ${notchShoulderDrop + semicircleControl} ${center - semicircleControl} ${depth} ${center} ${depth} C ${center + semicircleControl} ${depth} ${circleRight} ${notchShoulderDrop + semicircleControl} ${circleRight} ${notchShoulderDrop} C ${circleRight} ${notchShoulderDrop - shoulderEndHandle} ${center + notchUpperHalfWidth - shoulderStartHandle} 0 ${center + notchUpperHalfWidth} 0 Z`}
        />
      </Svg>
    </View>
  );
}

/**
 * Global capture launcher. It is intentionally an action layer, not a fifth
 * tab: every choice is visible, labeled, and can be dismissed with a tap
 * outside or Android back.
 */
export function CaptureButton() {
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } =
    useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [measuredFabTop, setMeasuredFabTop] = useState<number>();
  const fabContainerRef = useRef<View>(null);
  const rotation = useSharedValue(0);
  const menuProgress = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(open ? 1 : 0, {
      duration: reducedMotion ? 120 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [open, reducedMotion, rotation]);

  useEffect(() => {
    const duration = reducedMotion ? 140 : MENU_ANIMATION_DURATION;

    if (open) {
      if (menuVisible) {
        menuProgress.value = withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
        return;
      }

      menuProgress.value = 0;
      setMenuVisible(true);
      requestAnimationFrame(() => {
        menuProgress.value = withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      });
      return;
    }

    if (menuVisible) {
      menuProgress.value = withTiming(
        0,
        { duration, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMenuVisible)(false);
        },
      );
    }
  }, [menuProgress, menuVisible, open, reducedMotion]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(rotation.value, [0, 1], [0, 45])}deg`,
      },
      {
        scale: reducedMotion
          ? 1
          : interpolate(rotation.value, [0, 1], [1, 0.94]),
      },
    ],
  }));

  const menuPanelStyle = useAnimatedStyle(
    () => ({
      transformOrigin: 'bottom center',
      transform: [
        {
          scale: reducedMotion
            ? 1
            : interpolate(menuProgress.value, [0, 1], [0.08, 1]),
        },
      ],
    }),
    [reducedMotion],
  );

  const fabBorderStyle = useAnimatedStyle(
    () => ({
      opacity: menuProgress.value,
      transform: [
        {
          scale: reducedMotion
            ? 1
            : interpolate(menuProgress.value, [0, 1], [0.6, 1]),
        },
      ],
    }),
    [reducedMotion],
  );

  const measureFabPosition = useCallback(() => {
    requestAnimationFrame(() => {
      fabContainerRef.current?.measureInWindow((_x, y) => {
        setMeasuredFabTop(y);
      });
    });
  }, []);

  const fabTop =
    measuredFabTop ??
    windowHeight -
      Math.max(insets.bottom, 10) -
      CAPTURE_FAB_LAYOUT.fallbackTabBarContentHeight -
      CAPTURE_FAB_LAYOUT.peekHeight;
  const panelWidth = Math.min(windowWidth - 40, 420);
  const panelBottom =
    fabTop + FAB_MENU_SHAPE.panelBottomAtFabTopOffset;

  const chooseAction = useCallback(
    (id: CaptureActionId) => {
      setOpen(false);
      void Haptics.selectionAsync();

      setTimeout(
        () => {
          if (id === 'scan') {
            if (Platform.OS === 'android') {
              void runFabReceiptScan();
            } else {
              router.push(captureActionDestination(id) as never);
            }
            return;
          }
          router.push(captureActionDestination(id) as never);
        },
        reducedMotion ? 140 : MENU_ANIMATION_DURATION,
      );
    },
    [reducedMotion],
  );

  return (
    <View
      ref={fabContainerRef}
      onLayout={measureFabPosition}
      collapsable={false}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: -CAPTURE_FAB_LAYOUT.peekHeight,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View
          className="flex-1 justify-end px-5"
          style={{ paddingBottom: windowHeight - panelBottom }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close capture menu"
          />
          <Animated.View
            className="w-full self-center"
            style={[{ maxWidth: 420 }, menuPanelStyle]}
          >
            <Surface
              smoothing="hero"
              tone="raised"
              className="rounded-[28px] px-3 pt-3 bg-primary"
              style={{
                paddingBottom: FAB_MENU_SHAPE.panelBottomPadding,
              }}
            >
              {ACTIONS.map((action, index) => (
                <CaptureMenuItem
                  key={action.id}
                  action={action}
                  index={ACTIONS.length - 1 - index}
                  reducedMotion={reducedMotion}
                  onPress={() => chooseAction(action.id)}
                />
              ))}
            </Surface>
            <FabMenuNotch
              width={panelWidth}
              color={tokens.primary}
            />
          </Animated.View>
        </View>
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: fabTop,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View className="h-16 w-16 items-center justify-center">
            <Animated.View
              pointerEvents="none"
              style={[fabBorderStyle]}
            />
            <CaptureFab
              accessibilityLabel="Close capture menu"
              onPress={() => setOpen(false)}
              animatedStyle={fabStyle}
              iconColor={tokens.primary}
            />
          </View>
        </View>
      </Modal>
      <CaptureFab
        accessibilityLabel={
          open ? 'Close capture menu' : 'Open capture menu'
        }
        accessibilityHint="Choose scan receipt, add expense, or add income"
        expanded={open}
        onPress={() => {
          setOpen((value) => !value);
          void Haptics.selectionAsync();
        }}
        animatedStyle={fabStyle}
        iconColor={tokens.primary}
      />
    </View>
  );
}
