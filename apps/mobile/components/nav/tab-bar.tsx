import { useEffect, useState } from 'react';
import { Keyboard, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openCaptureChooser } from '@/components/nav/capture-chooser';
import {
  PlusButton,
  RING_SIZE,
  TAB_BAR_HEIGHT,
  TAB_BAR_REACH,
  tabBarBottom,
} from '@/components/nav/plus-button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/** The four tab roots in bar order; the + sits between Activity and Budget. */
export const TABS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'activity', title: 'Activity', icon: 'receipt-text' },
  { name: 'budget', title: 'Budget', icon: 'chart-box' },
  { name: 'debts', title: 'Debts', icon: 'handshake-outline' },
] as const satisfies readonly {
  name: string;
  title: string;
  icon: IconSymbolName;
}[];

const PLUS_CELL = 2;

function useKeyboardUp() {
  const [up, setUp] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setUp(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

/**
 * Bottom padding for a tab root's scroll content: 120 on a phone with no
 * system nav bar, as V2F-Nav draws it, and more above a taller one.
 */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  return tabBarBottom(insets.bottom) + TAB_BAR_REACH + 8;
}

/**
 * The floating Ink pill from V2F-Nav: five equal cells, the centre one holding
 * the raised +. The active cell only turns cream; nothing slides. The row
 * reaches up to the ring so Android delivers touches on the + (it drops
 * touches outside a parent's bounds), and so TalkBack reads the + third.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const keyboardUp = useKeyboardUp();
  const bottom = tabBarBottom(insets.bottom);

  // V2F-Components "Hidden when": the bar leaves while the keyboard is up.
  if (keyboardUp) return null;

  const cells = state.routes.map((route, index) => {
    const tab = TABS.find((t) => t.name === route.name);
    if (!tab) return null;
    const focused = state.index === index;
    const color = focused ? tokens.onTabBar : tokens.inactive;
    return (
      <View
        key={route.key}
        className="flex-1 justify-center"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        <Press
          testID={tid('nav', 'tab', route.name)}
          accessibilityRole="tab"
          accessibilityLabel={tab.title}
          accessibilityState={{ selected: focused }}
          pressedScale={0.94}
          pressedClassName="bg-on-tab-bar/12"
          className="h-14 items-center justify-center gap-0.5 rounded-full"
          onPress={() => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }}
        >
          <IconSymbol
            name={tab.icon}
            size={24}
            color={color}
          />
          <Text
            className="text-[11px] leading-[14px] font-display-semibold"
            style={{ color }}
          >
            {tab.title}
          </Text>
        </Press>
      </View>
    );
  });
  cells.splice(
    PLUS_CELL,
    0,
    <View
      key="plus"
      className="flex-1 items-center self-start"
      style={{ minWidth: RING_SIZE }}
    >
      <PlusButton
        testID={tid('nav', 'plus')}
        open={false}
        onPress={() => void openCaptureChooser()}
      />
    </View>,
  );

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-3"
      style={{ bottom, height: TAB_BAR_REACH }}
    >
      <View
        className="absolute inset-x-0 bottom-0 rounded-full bg-tab-bar"
        style={{
          height: TAB_BAR_HEIGHT,
          boxShadow: '0 12px 32px rgba(23,24,26,0.18)',
        }}
      />
      <View
        pointerEvents="box-none"
        className="flex-1 flex-row items-end"
      >
        {cells}
      </View>
    </View>
  );
}
