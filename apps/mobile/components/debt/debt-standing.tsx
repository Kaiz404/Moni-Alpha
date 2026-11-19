import { router } from 'expo-router';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';
import { type DebtLine, dayLabel, formatMoney } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

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

/** An open debt: what's left and how much came back. */
export function OpenStanding({ line }: { line: DebtLine }) {
  const { debt, balanceMinor } = line;
  const words = SIDE_WORDS[debt.direction];
  return (
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
        className={debt.direction === 'owed_to_me' ? 'text-deep-mint' : 'text-foreground'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatMoney(balanceMinor, debt.currency)}
      </Text>
      <RepaidBar line={line} />
    </View>
  );
}

/**
 * V2P-DebtSettle: the Mint card once everything is paid back. `pop` grows the
 * celebrating cat in, for the moment it settles on this page.
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
  const { debt, principalMinor } = line;
  const words = SIDE_WORDS[debt.direction];
  return (
    <View
      accessibilityLiveRegion="polite"
      className="gap-3.5 rounded-card bg-block-mint px-[18px] pb-[18px] pt-[22px]"
    >
      <Mascot
        mood="celebrate"
        size={72}
        pop={pop && !reduceMotion}
      />
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
  const day = dayLabel(
    deviceCalendar.dayKey(lastAt),
    deviceCalendar.dayKey(new Date()),
  );
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
