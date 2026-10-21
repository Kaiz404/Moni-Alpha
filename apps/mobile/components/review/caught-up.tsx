import { View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

export type SessionRow = {
  id: string;
  title: string;
  meta: string;
  amountText: string;
  icon: IconSymbolName;
  color: string | null;
  /** Not mine rows read struck through in Meta. */
  struck: boolean;
};

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

/** D6: this session's results, from memory. Nothing is kept once the page closes. */
export function CaughtUp({
  sentence,
  rows,
  onCaptureLog,
}: {
  sentence: string;
  rows: SessionRow[];
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
      {rows.length ? (
        <View className="rounded-card bg-card py-1.5">
          {rows.map((row) => (
            <View
              key={row.id}
              className="flex-row items-center gap-3.5 px-[18px] py-2.5"
            >
              <TintBubble
                icon={row.icon}
                color={row.color}
              />
              <View className="min-w-0 flex-1">
                <Text
                  variant="rowTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {row.title}
                </Text>
                <Text
                  variant="meta"
                  className="text-muted"
                  numberOfLines={1}
                >
                  {row.meta}
                </Text>
              </View>
              <Text
                variant="rowTitle"
                className={row.struck ? 'text-muted line-through' : 'text-foreground'}
              >
                {row.amountText}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
