import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import { tid, type TestId } from '@/lib/test-ids';

const RESIZE = LinearTransition.springify()
  .stiffness(springs.control.stiffness)
  .damping(springs.control.damping)
  .mass(springs.control.mass);
const LABEL_IN = FadeIn.duration(180);

/** A picker capsule: the current choice and a chevron, Ink once it narrows what shows. */
function FilterTrigger({
  testID,
  name,
  label,
  active,
  onPress,
}: {
  testID: TestId;
  /** What it filters, for the screen reader: "Type". */
  name: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const ink = active ? tokens.primaryForeground : tokens.foreground;
  return (
    <Animated.View
      layout={RESIZE}
      className="min-w-0 flex-shrink"
    >
      <Press
        testID={testID}
        accessibilityLabel={`${name}, ${label}`}
        accessibilityHint="Opens a picker"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        hitSlop={4}
        radius={{ rest: 18, pressed: 16 }}
        pressedClassName={active ? 'bg-primary-pressed' : 'bg-hairline'}
        className={`h-9 flex-row items-center gap-1 pl-3.5 pr-2.5 ${active ? 'bg-primary' : 'bg-sand'}`}
      >
        <Animated.View
          key={label}
          entering={LABEL_IN}
          className="min-w-0 flex-shrink"
        >
          <Text
            className={`text-[14px] leading-[19px] font-display-semibold ${active ? 'text-primary-foreground' : 'text-foreground'}`}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Animated.View>
        <IconSymbol
          name="chevron-down"
          size={18}
          color={ink}
        />
      </Press>
    </Animated.View>
  );
}

/** Activity's filters, one picker each, in one row that fits the screen. */
export function FilterRow({
  kindLabel,
  kindActive,
  onKind,
  walletLabel,
  walletActive,
  onWallet,
}: {
  kindLabel: string;
  kindActive: boolean;
  onKind: () => void;
  walletLabel: string;
  walletActive: boolean;
  onWallet: () => void;
}) {
  return (
    <View
      accessibilityLabel="Filter"
      className="flex-row items-center gap-2"
    >
      <FilterTrigger
        testID={tid('activity', 'filter', 'type')}
        name="Type"
        label={kindLabel}
        active={kindActive}
        onPress={onKind}
      />
      <FilterTrigger
        testID={tid('activity', 'filter', 'wallet')}
        name="Wallets"
        label={walletLabel}
        active={walletActive}
        onPress={onWallet}
      />
    </View>
  );
}
