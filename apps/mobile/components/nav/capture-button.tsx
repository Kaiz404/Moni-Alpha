import {
  type ComponentProps,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
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
  icon: ComponentProps<typeof MaterialIcons>['name'];
};

const ACTIONS: readonly CaptureAction[] = [
  {
    id: 'scan',
    label: 'Scan receipt',
    detail: 'Turn a receipt into a reviewable record',
    icon: 'receipt-long',
  },
  {
    id: 'transaction',
    label: 'Add transaction',
    detail: 'Enter an expense, income, or transfer',
    icon: 'add-card',
  },
  {
    id: 'chat',
    label: 'Ask Moni',
    detail: 'Ask a question or describe a transaction',
    icon: 'chat-bubble-outline',
  },
  {
    id: 'debt',
    label: 'Record debt',
    detail: 'Track money you owe or are owed',
    icon: 'people-outline',
  },
] as const;

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
        <Surface tone="aqua" className="mb-3 min-h-16 flex-row items-center px-4 py-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
            <MaterialIcons
              name={action.icon}
              size={22}
              color={tokens.primary}
            />
          </View>
          <View className="ml-3 min-w-0 flex-1">
            <Text className="text-base font-bold text-foreground">
              {action.label}
            </Text>
            <Text className="mt-0.5 text-xs leading-4 text-muted">
              {action.detail}
            </Text>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Global capture launcher. It is intentionally an action layer, not a fifth
 * tab: every choice is visible, labeled, and can be dismissed with a tap
 * outside or Android back.
 */
export function CaptureButton() {
  const tokens = useThemeTokens();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(open ? 1 : 0, {
      duration: reducedMotion ? 120 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [open, reducedMotion, rotation]);

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

  const chooseAction = useCallback((id: CaptureActionId) => {
    setOpen(false);
    void Haptics.selectionAsync();

    requestAnimationFrame(() => {
      if (id === 'scan') {
        if (Platform.OS === 'android') {
          void runFabReceiptScan();
        } else {
          router.push(captureActionDestination(id) as never);
        }
        return;
      }
      router.push(captureActionDestination(id) as never);
    });
  }, []);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: -28,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end bg-foreground/15 px-5 pb-28">
          <Pressable
            className="absolute inset-0"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close capture menu"
          />
          <View
            className="w-full self-center"
            style={{ maxWidth: 420 }}
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
          </View>
        </View>
      </Modal>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          open ? 'Close capture menu' : 'Open capture menu'
        }
        accessibilityHint="Choose scan receipt, add transaction, ask Moni, or record debt"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
          void Haptics.selectionAsync();
        }}
        className="h-16 w-16 items-center justify-center rounded-full border-[3px] border-background bg-primary"
        style={{ elevation: open ? 10 : 6 }}
      >
        <Animated.View style={fabStyle}>
          <MaterialIcons
            name="add"
            size={30}
            color={tokens.primaryForeground}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}
