import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SIDE_WORDS } from '@/components/debts/debt-words';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDay } from '@/lib/dates/day-label';
import type { DebtLine } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

function RepaidBar({
  line,
  onMint,
}: {
  line: DebtLine;
  onMint?: boolean;
}) {
  const { principalMinor, repaidMinor, balanceMinor, debt } = line;
  const money = (minor: number) => formatMoney(minor, debt.currency);
  const share = Math.min(1, repaidMinor / principalMinor);
  const repaid = `${money(repaidMinor)} of ${money(principalMinor)} paid back`;
  const ink = onMint ? 'text-on-pastel' : 'text-ink-2';
  return (
    <View className="gap-1.5 pt-2">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={repaid}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(share * 100),
        }}
        className={`h-2 overflow-hidden rounded-full ${onMint ? 'bg-card' : 'bg-track'}`}
      >
        <View
          className="absolute inset-y-0 left-0 rounded-full bg-ink-2"
          style={{ width: `${share * 100}%` }}
        />
      </View>
      <View className="flex-row justify-between gap-2">
        <Text
          variant="meta"
          className={ink}
        >
          {repaidMinor > 0 ? repaid : 'Nothing paid back yet'}
        </Text>
        <Text
          variant="meta"
          className={ink}
        >
          {balanceMinor > 0
            ? `${money(balanceMinor)} to go`
            : 'Paid in full'}
        </Text>
      </View>
    </View>
  );
}

/** An open debt: what's left, how much came back, and the ways to move money on it. */
export function OpenStanding({
  line,
  remindedToday,
  onSettle,
  onRemind,
}: {
  line: DebtLine;
  remindedToday: boolean;
  onSettle: () => void;
  onRemind: () => void;
}) {
  const tokens = useThemeTokens();
  const { debt, balanceMinor } = line;
  const words = SIDE_WORDS[debt.direction];
  const owedToMe = debt.direction === 'owed_to_me';
  const toAmount = (mode: 'repay' | 'more') =>
    router.push({
      pathname: '/debt/amount',
      params: { id: debt.id, mode },
    });
  return (
    <>
      <View
        accessible
        accessibilityLiveRegion="polite"
        className="gap-1"
      >
        <Text
          variant="caps"
          className="text-ink-2"
        >
          {words.caps(debt.counterpartyName)}
        </Text>
        <Text
          variant="amountHero"
          className={owedToMe ? 'text-deep-mint' : 'text-foreground'}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(balanceMinor, debt.currency)}
        </Text>
        <RepaidBar line={line} />
      </View>
      <View className="gap-1">
        <View className="flex-row gap-2">
          <Button
            testID={tid('debts', 'record-repayment')}
            className="flex-1"
            icon="cash-refund"
            label="Record repayment"
            onPress={() => toAmount('repay')}
          />
          <Press
            testID={tid('debts', 'lend-more')}
            radius={{ rest: 26, pressed: 16 }}
            pressedClassName="bg-hairline"
            className="h-[52px] flex-row items-center justify-center gap-1.5 bg-sand px-[18px]"
            onPress={() => toAmount('more')}
          >
            <IconSymbol
              name="plus"
              size={18}
              color={tokens.foreground}
            />
            <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
              {words.more}
            </Text>
          </Press>
        </View>
        <View className="flex-row gap-1">
          <Press
            testID={tid('debts', 'settle')}
            className="h-11 flex-row items-center gap-1.5 rounded-full pl-1 pr-3"
            onPress={onSettle}
          >
            <IconSymbol
              name="check-all"
              size={18}
              color={tokens.deepMint}
            />
            <Text className="text-[15px] leading-[21px] font-display-semibold text-deep-mint">
              {words.settle}
            </Text>
          </Press>
          {!owedToMe ? null : remindedToday ? (
            <View className="h-11 flex-row items-center gap-1.5 px-3">
              <IconSymbol
                name="check"
                size={18}
                color={tokens.muted}
              />
              <Text className="text-[15px] leading-[21px] font-display-semibold text-muted">
                Reminded today
              </Text>
            </View>
          ) : (
            <Press
              testID={tid('debts', 'remind')}
              accessibilityHint="Opens the share sheet with a message"
              className="h-11 flex-row items-center gap-1.5 rounded-full px-3"
              onPress={onRemind}
            >
              <IconSymbol
                name="send-outline"
                size={18}
                color={tokens.deepMint}
              />
              <Text className="text-[15px] leading-[21px] font-display-semibold text-deep-mint">
                Remind {debt.counterpartyName}
              </Text>
            </Press>
          )}
        </View>
      </View>
    </>
  );
}

/**
 * V2P-DebtSettle: the Mint card once everything is paid back. `pop` grows the
 * check in from 0.6 on the control spring, for the moment it settles on this page.
 */
export function SquareCard({
  line,
  pop = false,
}: {
  line: DebtLine;
  pop?: boolean;
}) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(pop && !reduceMotion ? 0.6 : 1);
  useEffect(() => {
    scale.set(withSpring(1, springs.control));
  }, [scale]);
  const grow = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const { debt, principalMinor } = line;
  const words = SIDE_WORDS[debt.direction];
  return (
    <View
      accessibilityLiveRegion="polite"
      className="gap-3.5 rounded-card bg-mint px-[18px] pb-[18px] pt-[22px]"
    >
      <Animated.View
        className="h-16 w-16 items-center justify-center rounded-full bg-card"
        style={grow}
      >
        <IconSymbol
          name="check-bold"
          size={34}
          color={tokens.states.approved}
        />
      </Animated.View>
      <View className="gap-1">
        <Text
          variant="screenTitle"
          className="text-on-pastel"
          accessibilityRole="header"
        >
          {words.squareTitle(debt.counterpartyName)}
        </Text>
        <Text
          variant="body"
          className="text-on-pastel"
        >
          {words.squareSentence(
            debt.counterpartyName,
            formatMoney(principalMinor, debt.currency),
          )}
        </Text>
      </View>
      <RepaidBar
        line={line}
        onMint
      />
      <View className="flex-row gap-2">
        <Button
          testID={tid('debts', 'done')}
          className="flex-1"
          label="Done"
          onPress={() => router.back()}
        />
        <Press
          testID={tid('debts', 'lend-again')}
          radius={{ rest: 26, pressed: 16 }}
          className="h-[52px] flex-1 flex-row items-center justify-center gap-1.5 bg-card"
          onPress={() =>
            router.push({
              pathname: '/debt/amount',
              params: { id: debt.id, mode: 'more' },
            })
          }
        >
          <IconSymbol
            name="plus"
            size={18}
            color={tokens.foreground}
          />
          <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
            {words.again}
          </Text>
        </Press>
      </View>
    </View>
  );
}

/** A debt let go of: nothing left, no money moved. */
export function WrittenOff({ line }: { line: DebtLine }) {
  const { debt, principalMinor, repaidMinor, lastAt } = line;
  const day = formatDay(lastAt);
  const when =
    day === 'Today' || day === 'Yesterday'
      ? day.toLowerCase()
      : `on ${day}`;
  return (
    <View
      accessible
      className="gap-1"
    >
      <Text
        variant="caps"
        className="text-ink-2"
      >
        Written off
      </Text>
      <Text
        variant="amountHero"
        className="text-foreground"
      >
        {formatMoney(0, debt.currency)}
      </Text>
      <Text
        variant="body"
        className="text-ink-2"
      >
        {formatMoney(principalMinor - repaidMinor, debt.currency)}{' '}
        written off {when}. No money moved.
      </Text>
    </View>
  );
}
