import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

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

/** This session's counts. The decisions themselves are listed in Recently reviewed below. */
export function CaughtUp({
  sentence,
  onCaptureLog,
}: {
  sentence: string;
  onCaptureLog: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View
      testID={tid('review', 'caught-up')}
      className="gap-3.5 rounded-card bg-mint px-[18px] py-[22px]"
    >
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
        <IconSymbol
          name="check-bold"
          size={34}
          color={tokens.primaryForeground}
        />
      </View>
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
      <CaptureLogLink onPress={onCaptureLog} />
    </View>
  );
}

/** Opened with nothing waiting. */
export function NothingToReview({ onCaptureLog }: { onCaptureLog: () => void }) {
  const tokens = useThemeTokens();
  return (
    <View
      testID={tid('review', 'empty')}
      className="gap-3.5 rounded-card border-[1.5px] border-dashed border-hairline px-[22px] py-7"
    >
      <View className="h-16 w-16 items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name="check"
          size={30}
          color={tokens.foreground}
        />
      </View>
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
