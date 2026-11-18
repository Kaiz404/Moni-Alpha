import { View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { useBudgetData, useBudgetMonth } from '@/components/budget/use-budget';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';
import { reviewSafeToSpend } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

function CaptureLogLink({ onPress }: { onPress: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('review', 'capture-log')}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel="Capture log"
      pressedScale={1}
      radius={{ rest: 12, pressed: 12 }}
      className="-ml-1 h-11 flex-row items-center gap-1.5 self-start px-1"
    >
      <IconSymbol
        name="bell-outline"
        size={18}
        color={tokens.deepMint}
      />
      <Text className="text-[15px] leading-[21px] font-display-semibold text-deep-mint">
        Capture log
      </Text>
      <IconSymbol
        name="chevron-right"
        size={18}
        color={tokens.deepMint}
      />
    </Press>
  );
}

export function CaughtUp({
  sentence,
  addedMinor,
  onCaptureLog,
}: {
  sentence: string;
  /** Main-currency spending this session approved, for the safe to spend a day change. */
  addedMinor: number;
  onCaptureLog: () => void;
}) {
  const tokens = useThemeTokens();
  const data = useBudgetData();
  const month = useBudgetMonth(data, deviceCalendar.monthKey(data.now));
  const safe = reviewSafeToSpend(month, addedMinor);
  return (
    <View
      testID={tid('review', 'caught-up')}
      className="gap-3.5 rounded-card bg-block-mint px-[18px] py-[22px]"
    >
      <Mascot
        mood="celebrate"
        size={72}
        pop
      />
      <View className="gap-1">
        <Text
          variant="screenTitle"
          className="text-on-pastel"
          accessibilityRole="header"
        >
          All caught up
        </Text>
        <Text
          variant="body"
          className="text-on-pastel"
        >
          {sentence}
        </Text>
      </View>
      {safe ? (
        <View
          testID={tid('review', 'safe-to-spend')}
          className="gap-0.5"
        >
          <Text
            variant="caps"
            className="text-on-pastel"
          >
            Safe to spend a day
          </Text>
          <View
            accessible
            accessibilityLabel={safe.before ? `${safe.before} to ${safe.after}` : safe.after}
            className="flex-row items-center gap-1.5"
          >
            {safe.before ? (
              <>
                <Text className="text-[34px] leading-[40px] font-display-bold text-on-pastel">
                  {safe.before}
                </Text>
                <IconSymbol
                  name="arrow-right"
                  size={26}
                  color={tokens.onPastel}
                />
              </>
            ) : null}
            <Text className="text-[34px] leading-[40px] font-display-bold text-on-pastel">
              {safe.after}
            </Text>
          </View>
          <Text
            variant="meta"
            className="text-on-pastel"
          >
            {safe.sentence}
          </Text>
        </View>
      ) : null}
      <CaptureLogLink onPress={onCaptureLog} />
    </View>
  );
}

/** Opened with nothing waiting. */
export function NothingToReview({ onCaptureLog }: { onCaptureLog: () => void }) {
  return (
    <View
      testID={tid('review', 'empty')}
      className="gap-3.5 rounded-card border-[1.5px] border-dashed border-hairline px-[22px] py-7"
    >
      <Mascot
        mood="happy"
        size={72}
      />
      <Text
        variant="screenTitle"
        className="text-foreground"
        accessibilityRole="header"
      >
        Nothing to review
      </Text>
      <Text
        variant="body"
        className="text-ink-2"
      >
        Bank alerts and Moni chat entries land here until you decide. Routine ones are added for
        you and marked Auto.
      </Text>
      <CaptureLogLink onPress={onCaptureLog} />
    </View>
  );
}
