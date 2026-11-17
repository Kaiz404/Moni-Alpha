import { ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

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
const CLEAR_OUT = FadeOut.duration(140);

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
    <Animated.View layout={RESIZE}>
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

/** Activity's filters, one picker each, in one row that scrolls sideways edge to edge, so each label shows in full. The dates clear with ×. */
export function FilterRow({
  rangeLabel,
  rangeActive,
  onRange,
  onClearRange,
  kindLabel,
  kindActive,
  onKind,
  walletLabel,
  walletActive,
  onWallet,
}: {
  rangeLabel: string;
  rangeActive: boolean;
  onRange: () => void;
  onClearRange: () => void;
  kindLabel: string;
  kindActive: boolean;
  onKind: () => void;
  walletLabel: string;
  walletActive: boolean;
  onWallet: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <ScrollView
      horizontal
      accessibilityLabel="Filter"
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className="-mx-screen"
      contentContainerClassName="flex-row items-center gap-2 px-screen"
    >
      <FilterTrigger
        testID={tid('activity', 'range')}
        name="Dates"
        label={rangeLabel}
        active={rangeActive}
        onPress={onRange}
      />
      {rangeActive ? (
        <Animated.View
          entering={LABEL_IN}
          exiting={CLEAR_OUT}
          layout={RESIZE}
        >
          <Press
            testID={tid('activity', 'range', 'clear')}
            accessibilityLabel="Clear dates"
            onPress={onClearRange}
            hitSlop={4}
            pressedClassName="bg-hairline"
            className="h-9 w-9 items-center justify-center rounded-full bg-sand"
          >
            <IconSymbol
              name="close"
              size={18}
              color={tokens.foreground}
            />
          </Press>
        </Animated.View>
      ) : null}
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
    </ScrollView>
  );
}
