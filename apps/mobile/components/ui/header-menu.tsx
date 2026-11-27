import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press, PressRows } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@repo/design';
import { tid, type Screen } from '@/lib/test-ids';

/** V2H-WalletDetail's menu `rise`: up 8 and fade in on the sheet spring. */
const RISE = FadeInUp.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping)
  .mass(springs.sheet.mass)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });

const SHADOW = {
  elevation: 12,
  shadowColor: '#17181A',
  shadowOpacity: 0.18,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 12 },
};

export type HeaderMenuItem<A extends string> = {
  action: A;
  label: string;
  icon: IconSymbolName;
  destructive?: boolean;
};

/** A page header's ⋯ and the menu under it, such as Edit wallet and Delete wallet. */
export function HeaderMenu<A extends string>({
  screen,
  accessibilityLabel,
  items,
  onAction,
}: {
  screen: Screen;
  accessibilityLabel: string;
  items: readonly HeaderMenuItem<A>[];
  onAction: (action: A) => void;
}) {
  const [open, setOpen] = useState(false);
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const run = (action: A) => {
    setOpen(false);
    onAction(action);
  };
  return (
    <>
      <HeaderIconButton
        testID={tid(screen, 'more')}
        icon="dots-horizontal"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          testID={tid(screen, 'menu', 'close')}
          accessibilityLabel="Close menu"
          className="absolute inset-0"
          onPress={() => setOpen(false)}
        />
        <Animated.View
          entering={RISE}
          exiting={FadeOut.duration(120)}
          accessibilityRole="menu"
          className="absolute right-5 w-[220px] rounded-tile bg-card"
          style={[{ top: insets.top + 52 }, SHADOW]}
        >
          <View className="overflow-hidden rounded-tile">
            <PressRows>
              {items.map((item) => (
                <Press
                  key={item.action}
                  testID={tid(screen, 'menu', item.action)}
                  accessibilityRole="menuitem"
                  className="h-11 flex-row items-center gap-3 px-4"
                  onPress={() => run(item.action)}
                >
                  <View pointerEvents="none">
                    <IconSymbol
                      name={item.icon}
                      size={20}
                      color={item.destructive ? tokens.over : tokens.foreground}
                    />
                  </View>
                  <Text
                    className={`font-display-semibold text-[15px] leading-[21px] ${item.destructive ? 'text-over' : 'text-foreground'}`}
                  >
                    {item.label}
                  </Text>
                </Press>
              ))}
            </PressRows>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}
