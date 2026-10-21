import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, {
  useReducedMotion,
  withSpring,
  withTiming,
  type EntryAnimationsValues,
} from 'react-native-reanimated';

import type { MerchantRow as MerchantRowData } from '@/components/merchants/use-merchant-names';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import { tid, type TestId } from '@/lib/test-ids';

export type MerchantSection = 'to-name' | 'named';

type MerchantRowProps = {
  row: MerchantRowData;
  section: MerchantSection;
  editing: boolean;
  /** Another row is open for editing: pencils hide, as one field edits at a time. */
  locked: boolean;
  /** The row the last save or forget moved here rises into place. */
  rises: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (name: string) => void;
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

export function MerchantRow(props: MerchantRowProps) {
  const reduceMotion = useReducedMotion();
  const { row, section } = props;
  return (
    <Animated.View entering={props.rises ? riseIn(reduceMotion) : undefined}>
      {props.editing ? (
        <MerchantEditor {...props} />
      ) : (
        <View className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3">
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
          {props.locked ? null : (
            <Pencil
              testID={tid('merchants', section, row.key, 'edit')}
              label={row.name ? `Rename ${row.name}` : `Name ${row.raw}`}
              onPress={props.onEdit}
            />
          )}
        </View>
      )}
    </Animated.View>
  );
}

function Pencil({
  testID,
  label,
  onPress,
}: {
  testID: TestId;
  label: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
      pressedClassName="bg-hairline"
      className="h-8 w-8 items-center justify-center rounded-full bg-sand"
    >
      <IconSymbol
        name="pencil-outline"
        size={16}
        color={tokens.foreground}
      />
    </Press>
  );
}

function MerchantEditor({ row, section, onCancel, onSave, onForget }: MerchantRowProps) {
  const tokens = useThemeTokens();
  const [draft, setDraft] = useState(row.name ?? '');
  const name = draft.trim();
  const save = () => {
    if (name) onSave(name);
  };
  const meta = row.wallet ? `${payments(row.count)} · ${row.wallet}` : payments(row.count);

  return (
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
      <View className="flex-row items-center gap-2">
        <TextInput
          testID={tid('merchants', section, row.key, 'field')}
          accessibilityLabel={`Name for ${row.raw}`}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={save}
          placeholder="What is it?"
          placeholderTextColor={tokens.muted}
          maxLength={30}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          className="h-[52px] min-w-0 flex-1 rounded-field border-2 border-foreground bg-card px-3.5 text-foreground"
          style={{ fontFamily: 'FunnelDisplay_600SemiBold', fontSize: 18, lineHeight: 22 }}
        />
        <Press
          testID={tid('merchants', section, row.key, 'cancel')}
          onPress={onCancel}
          accessibilityLabel="Cancel"
          pressedClassName="bg-hairline"
          className="h-11 w-11 items-center justify-center rounded-full bg-sand"
        >
          <IconSymbol
            name="close"
            size={20}
            color={tokens.foreground}
          />
        </Press>
        <Press
          testID={tid('merchants', section, row.key, 'save')}
          onPress={save}
          disabled={!name}
          accessibilityLabel="Save name"
          accessibilityState={{ disabled: !name }}
          pressedClassName="bg-primary-pressed"
          className={`h-11 w-11 items-center justify-center rounded-full bg-primary ${name ? '' : 'opacity-50'}`}
        >
          <IconSymbol
            name="check"
            size={22}
            color={tokens.primaryForeground}
          />
        </Press>
      </View>
      {section === 'to-name' && row.guess && name !== row.guess ? (
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
  );
}
