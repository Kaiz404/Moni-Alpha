import { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type {
  NavigationRoute,
  ParamListBase,
} from 'expo-router/react-navigation';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { CaptureButton } from '@/components/nav/capture-button';

/** Matches `CaptureButton` width (`h-16 w-16`) so side tabs clear the FAB. */
const CAPTURE_BUTTON_SLOT_WIDTH = 64;

/**
 * Custom tab bar so a floating capture button can sit above the bar between
 * tabs, while the 4 real routes keep their existing icons/titles from
 * `Tabs.Screen options` (read via `descriptors`, not re-declared here).
 */
export function TabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const focusedOptions =
    descriptors[state.routes[state.index].key].options;

  useEffect(() => {
    if (!focusedOptions.tabBarHideOnKeyboard) return;
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [focusedOptions.tabBarHideOnKeyboard]);

  if (keyboardVisible && focusedOptions.tabBarHideOnKeyboard)
    return null;

  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  const renderTab = (
    route: NavigationRoute<ParamListBase, string>,
    index: number,
  ) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const color = isFocused ? tokens.accent : tokens.muted;
    const label = options.title ?? route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        onPress={onPress}
        className="flex-1 items-center justify-center gap-1 py-1"
      >
        {options.tabBarIcon?.({
          focused: isFocused,
          color,
          size: 26,
        })}
        <Text
          style={{
            fontSize: 11,
            fontWeight: isFocused ? '700' : '500',
            color,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ position: 'relative' }}>
      <CaptureButton />
      <View
        className="flex-row border-t border-border bg-card"
        style={{
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        }}
      >
        <View className="flex-1 flex-row">
          {leftRoutes.map((route, i) => renderTab(route, i))}
        </View>
        <View style={{ width: CAPTURE_BUTTON_SLOT_WIDTH }} />
        <View className="flex-1 flex-row">
          {rightRoutes.map((route, i) =>
            renderTab(route, i + leftRoutes.length),
          )}
        </View>
      </View>
    </View>
  );
}
