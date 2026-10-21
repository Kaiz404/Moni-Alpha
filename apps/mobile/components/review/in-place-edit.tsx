import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

type Field = 'merchant' | 'amount';

/** A value with its pencil (tokens.md "In-place edit"). Tapping the value also edits. */
export function EditableValue({
  field,
  label,
  showPencil,
  onEdit,
  children,
}: {
  field: Field;
  label: string;
  showPencil: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('review', field)}
      onPress={onEdit}
      accessibilityLabel={label}
      pressedScale={1}
      radius={{ rest: 16, pressed: 16 }}
      className="-ml-1 min-h-11 max-w-full flex-row items-center gap-2 self-start px-1"
    >
      <View className="min-w-0 shrink">{children}</View>
      <View
        className="h-8 w-8 items-center justify-center rounded-full bg-sand"
        style={{ opacity: showPencil ? 1 : 0 }}
      >
        <IconSymbol
          name="pencil-outline"
          size={16}
          color={tokens.foreground}
        />
      </View>
    </Press>
  );
}

/**
 * The open field: Paper, 2 ink border, radius 16, then cancel and save. Android back
 * cancels. Amounts use the phone's numeric keyboard, never a keypad.
 */
export function EditField({
  field,
  initial,
  prefix,
  onCancel,
  onSave,
}: {
  field: Field;
  initial: string;
  prefix?: string;
  onCancel: () => void;
  /** The parent closes the field when the value is valid and leaves it open otherwise. */
  onSave: (value: string) => void;
}) {
  const tokens = useThemeTokens();
  const [draft, setDraft] = useState(initial);
  const amount = field === 'amount';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [onCancel]);

  const save = () => onSave(draft);

  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`min-w-0 flex-1 flex-row items-center gap-1 rounded-field border-2 border-foreground bg-card ${amount ? 'h-16 px-3' : 'h-[52px] px-3.5'}`}
      >
        {prefix ? (
          <Text className="text-[28px] leading-[32px] font-display-bold text-muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          testID={tid('review', field, 'input')}
          accessibilityLabel={amount ? 'Amount' : 'Merchant name'}
          value={draft}
          onChangeText={setDraft}
          autoFocus
          selectTextOnFocus={amount}
          keyboardType={amount ? 'decimal-pad' : 'default'}
          returnKeyType="done"
          onSubmitEditing={save}
          className={`min-w-0 flex-1 p-0 text-foreground ${amount ? 'font-display-bold text-[40px] leading-[44px]' : 'font-display-semibold text-[18px] leading-[22px]'}`}
          cursorColor={tokens.foreground}
          selectionColor={tokens.foreground}
        />
      </View>
      <Press
        testID={tid('review', field, 'cancel')}
        onPress={onCancel}
        accessibilityLabel="Cancel"
        radius={{ rest: 22, pressed: 16 }}
        pressedClassName="bg-hairline"
        className="h-11 w-11 items-center justify-center bg-sand"
      >
        <IconSymbol
          name="close"
          size={20}
          color={tokens.foreground}
        />
      </Press>
      <Press
        testID={tid('review', field, 'save')}
        onPress={save}
        accessibilityLabel="Save"
        radius={{ rest: 22, pressed: 16 }}
        pressedClassName="bg-primary-pressed"
        className="h-11 w-11 items-center justify-center bg-primary"
      >
        <IconSymbol
          name="check"
          size={22}
          color={tokens.primaryForeground}
        />
      </Press>
    </View>
  );
}
