import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

/** V2H-WalletDetail's menu `rise`: up 8 and fade in on the sheet spring. */
const RISE = FadeInUp.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping)
  .mass(springs.sheet.mass)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });

const ITEMS: {
  action: 'edit' | 'delete';
  label: string;
  icon: IconSymbolName;
}[] = [
  {
    action: 'edit',
    label: 'Edit wallet',
    icon: 'cog-outline',
  },
  {
    action: 'delete',
    label: 'Delete wallet',
    icon: 'trash-can-outline',
  },
];

const SHADOW = {
  elevation: 12,
  shadowColor: '#17181A',
  shadowOpacity: 0.18,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 12 },
};

/** The header ⋯ and its menu: Edit wallet, Delete wallet. */
export function WalletMenu({
  walletName,
  onEdit,
  onDelete,
}: {
  walletName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const run = (action: 'edit' | 'delete') => {
    setOpen(false);
    if (action === 'edit') onEdit();
    else onDelete();
  };
  return (
    <>
      <HeaderIconButton
        testID={tid('wallet', 'more')}
        icon="dots-horizontal"
        accessibilityLabel={`More actions for ${walletName}`}
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
          testID={tid('wallet', 'menu', 'close')}
          accessibilityLabel="Close menu"
          className="absolute inset-0"
          onPress={() => setOpen(false)}
        />
        <Animated.View
          entering={RISE}
          exiting={FadeOut.duration(120)}
          accessibilityRole="menu"
          className="absolute right-5 w-[220px] rounded-tile bg-card py-1.5"
          style={[{ top: insets.top + 52 }, SHADOW]}
        >
          {ITEMS.map((item) => {
            const destructive = item.action === 'delete';
            return (
              <Press
                key={item.action}
                testID={tid('wallet', 'menu', item.action)}
                accessibilityRole="menuitem"
                className="h-11 flex-row items-center gap-3 px-4"
                onPress={() => run(item.action)}
              >
                <View pointerEvents="none">
                  <IconSymbol
                    name={item.icon}
                    size={20}
                    color={
                      destructive ? tokens.over : tokens.foreground
                    }
                  />
                </View>
                <Text
                  className={`font-display-semibold text-[15px] leading-[21px] ${destructive ? 'text-over' : 'text-foreground'}`}
                >
                  {item.label}
                </Text>
              </Press>
            );
          })}
        </Animated.View>
      </Modal>
    </>
  );
}
