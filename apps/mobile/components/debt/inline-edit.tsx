import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/**
 * tokens.md "In-place edit": a Paper field with a 2 ink border and the
 * system keyboard, then cancel and save circles. One field at a time.
 */
export function InlineEdit({
  name,
  label,
  initial,
  placeholder,
  required = false,
  onCancel,
  onSave,
}: {
  /** testID part: `debts.<name>.input`, `.cancel`, `.save`. */
  name: string;
  label: string;
  initial: string;
  placeholder?: string;
  required?: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const tokens = useThemeTokens();
  const [draft, setDraft] = useState(initial);
  const blocked = required && draft.trim().length === 0;
  const save = () => {
    if (!blocked) onSave(draft.trim());
  };
  return (
    <View className="gap-1.5">
      <Text
        variant="meta"
        className="text-muted"
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="h-[52px] min-w-0 flex-1 justify-center rounded-field border-2 border-foreground bg-card px-3.5">
          <TextInput
            testID={tid('debts', name, 'input')}
            accessibilityLabel={label}
            autoFocus
            selectTextOnFocus={false}
            className="h-12 p-0 font-display-semibold text-[18px] text-foreground"
            placeholder={placeholder}
            placeholderTextColor={tokens.muted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={save}
            returnKeyType="done"
            maxLength={name === 'name' ? 120 : 1000}
          />
        </View>
        <Press
          testID={tid('debts', name, 'cancel')}
          accessibilityLabel="Cancel"
          pressedClassName="bg-hairline"
          className="h-11 w-11 items-center justify-center rounded-full bg-sand"
          onPress={onCancel}
        >
          <IconSymbol
            name="close"
            size={20}
            color={tokens.foreground}
          />
        </Press>
        <Press
          testID={tid('debts', name, 'save')}
          accessibilityLabel="Save"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          pressedClassName="bg-primary-pressed"
          className={`h-11 w-11 items-center justify-center rounded-full ${blocked ? 'bg-sand-light' : 'bg-primary'}`}
          onPress={save}
        >
          <IconSymbol
            name="check"
            size={22}
            color={blocked ? tokens.muted : tokens.primaryForeground}
          />
        </Press>
      </View>
    </View>
  );
}

/** The 32 Sand pencil circle that sits 8 after an editable value. */
export function Pencil() {
  const tokens = useThemeTokens();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      className="h-8 w-8 items-center justify-center rounded-full bg-sand"
    >
      <IconSymbol
        name="pencil-outline"
        size={16}
        color={tokens.foreground}
      />
    </View>
  );
}
