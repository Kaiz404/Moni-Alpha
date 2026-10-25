import { View } from 'react-native';
import Animated, {
  useReducedMotion,
  withSpring,
  withTiming,
  type EntryAnimationsValues,
} from 'react-native-reanimated';

import type { MerchantRow as MerchantRowData } from '@/components/merchants/use-merchant-names';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceField, type Saved } from '@/components/ui/in-place-field';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

export type MerchantSection = 'to-name' | 'named';

type MerchantRowProps = {
  row: MerchantRowData;
  section: MerchantSection;
  /** The row the last save or forget moved here rises into place. */
  rises: boolean;
  onSave: (name: string) => Promise<Saved | void>;
  onForget: () => void;
};

const payments = (count: number) => `${count} ${count === 1 ? 'payment' : 'payments'}`;

function riseIn(reduceMotion: boolean) {
  return (_values: EntryAnimationsValues) => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: reduceMotion ? 0 : 8 }] },
      animations: {
        opacity: reduceMotion ? withTiming(1, { duration: 150 }) : withSpring(1, springs.sheet),
        transform: [{ translateY: reduceMotion ? 0 : withSpring(0, springs.sheet) }],
      },
    };
  };
}

export function MerchantRow({ row, section, rises, onSave, onForget }: MerchantRowProps) {
  const reduceMotion = useReducedMotion();
  const tokens = useThemeTokens();
  const meta = row.wallet ? `${payments(row.count)} · ${row.wallet}` : payments(row.count);
  return (
    <Animated.View entering={rises ? riseIn(reduceMotion) : undefined}>
      <InPlaceField
        testID={tid('merchants', section, row.key)}
        label={`Name for ${row.raw}`}
        kind="text"
        required
        maxLength={30}
        autoCapitalize="words"
        placeholder="What is it?"
        value={row.name ?? ''}
        onSave={onSave}
      >
        {({ editable, editor, draft, setDraft }) =>
          editor ? (
            <View className="gap-2 px-[18px] py-3">
              <Text
                variant="meta"
                className="text-muted"
              >
                <Text
                  variant="meta"
                  className="font-display-bold text-foreground"
                >
                  {row.raw}
                </Text>
                {` · ${meta}`}
              </Text>
              {editor}
              {section === 'to-name' && row.guess && draft.trim() !== row.guess ? (
                <Press
                  testID={tid('merchants', section, row.key, 'guess')}
                  onPress={() => setDraft(row.guess ?? '')}
                  radius={{ rest: 18, pressed: 16 }}
                  pressedClassName="bg-lilac"
                  className="h-9 flex-row items-center gap-1.5 self-start bg-pending-fill pl-2.5 pr-3.5"
                >
                  <IconSymbol
                    name="creation"
                    size={16}
                    color={tokens.states.pending}
                  />
                  <Text className="text-[14px] leading-[19px] font-display-semibold text-state-pending">
                    {`Moni's guess: ${row.guess}`}
                  </Text>
                </Press>
              ) : null}
              <Text
                variant="meta"
                className="text-ink-2"
              >
                {row.count > 0
                  ? `Moni shows it on ${row.count} past ${row.count === 1 ? 'payment' : 'payments'} and every new one.`
                  : 'Moni shows it on every new payment.'}
              </Text>
              {section === 'named' ? (
                <Press
                  testID={tid('merchants', section, row.key, 'forget')}
                  onPress={onForget}
                  radius={{ rest: 22, pressed: 16 }}
                  className="h-11 flex-row items-center gap-1.5 self-start pl-2.5 pr-3.5"
                >
                  <IconSymbol
                    name="trash-can-outline"
                    size={18}
                    color={tokens.over}
                  />
                  <Text className="text-[15px] leading-[21px] font-display-semibold text-over">
                    Forget this name
                  </Text>
                </Press>
              ) : null}
            </View>
          ) : (
            editable(
              <View className="flex-row items-center gap-3.5">
                <TintBubble
                  icon={row.icon}
                  color={row.color}
                />
                <View className="min-w-0 flex-1">
                  <Text
                    variant="rowTitle"
                    className="text-foreground"
                    style={row.name ? undefined : { letterSpacing: 0.32 }}
                    numberOfLines={1}
                  >
                    {row.name ?? row.raw}
                  </Text>
                  <Text
                    variant="meta"
                    className="text-muted"
                    numberOfLines={1}
                  >
                    {row.name
                      ? `${row.raw} · ${payments(row.count)}`
                      : `${payments(row.count)} · ${row.wallet ?? 'no wallet'}`}
                  </Text>
                </View>
              </View>,
              {
                className: 'min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3',
                accessibilityLabel: row.name ? `Rename ${row.name}` : `Name ${row.raw}`,
              },
            )
          )
        }
      </InPlaceField>
    </Animated.View>
  );
}
