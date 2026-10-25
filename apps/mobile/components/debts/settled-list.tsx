import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PersonAvatar } from '@/components/debts/person-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DebtLine } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

/** "Settled and written off": a hairline capsule with a count that opens the closed debts. */
export function SettledList({
  lines,
  open,
  onToggle,
}: {
  lines: DebtLine[];
  open: boolean;
  onToggle: () => void;
}) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    turn.set(
      reduceMotion
        ? open
          ? 180
          : 0
        : withSpring(open ? 180 : 0, springs.control),
    );
  }, [open, reduceMotion, turn]);
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get()}deg` }],
  }));

  if (lines.length === 0) return null;
  return (
    <>
      <Press
        testID={tid('debts', 'settled', 'toggle')}
        accessibilityState={{ expanded: open }}
        radius={{ rest: 24, pressed: 16 }}
        className="h-12 flex-row items-center gap-2 border-[1.5px] border-hairline pl-[18px] pr-3.5"
        onPress={onToggle}
      >
        <Text className="flex-1 text-[15px] leading-[21px] font-display-semibold text-foreground">
          Settled and written off
        </Text>
        <View className="h-6 min-w-6 items-center justify-center rounded-full bg-sand px-1.5">
          <Text className="text-[13px] leading-[18px] font-display-bold text-foreground">
            {lines.length}
          </Text>
        </View>
        <Animated.View style={chevron}>
          <IconSymbol
            name="chevron-down"
            size={20}
            color={tokens.muted}
          />
        </Animated.View>
      </Press>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <ListCard>
            {lines.map((line) => (
              <ClosedRow
                key={line.debt.id}
                line={line}
              />
            ))}
          </ListCard>
        </Animated.View>
      ) : null}
    </>
  );
}

function ClosedRow({ line }: { line: DebtLine }) {
  const tokens = useThemeTokens();
  const { id, counterpartyName: name, note, currency } = line.debt;
  const settled = line.state === 'settled';
  const meta = [settled ? 'Settled' : 'Written off', note]
    .filter(Boolean)
    .join(' · ');
  return (
    <Press
      testID={tid('debts', 'settled', id)}
      accessibilityLabel={`${name}, ${meta}, ${formatMoney(line.principalMinor, currency)}`}
      className="flex-row items-center gap-3.5 px-[18px] py-3"
      onPress={() =>
        router.push({ pathname: '/debt/[id]', params: { id } })
      }
    >
      <PersonAvatar
        name={name}
        closed
      />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <IconSymbol
            name={settled ? 'check' : 'cancel'}
            size={14}
            color={settled ? tokens.deepMint : tokens.muted}
          />
          <Text
            variant="meta"
            className="min-w-0 flex-1 text-muted"
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
      </View>
      <Text
        variant="rowTitle"
        className="text-muted"
      >
        {formatMoney(line.principalMinor, currency)}
      </Text>
    </Press>
  );
}
