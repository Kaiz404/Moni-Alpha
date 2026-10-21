import { useState, type ReactNode } from 'react';
import { TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid, type Screen } from '@/lib/test-ids';

type InPlaceFieldProps = {
  screen: Screen;
  /** Its controls are `<screen>.<name>.edit`, `.input`, `.cancel` and `.save`. */
  name: string;
  label: string;
  /** What the value reads at rest. */
  children: ReactNode;
  /** The text the field opens with. */
  draft: string;
  /** Returns false to keep the field open on a value it cannot take. */
  onSave: (text: string) => boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  keyboard: 'text' | 'amount';
  /** The sign and symbol beside the digits while an amount edits. */
  prefix?: string;
};

/**
 * tokens.md "In-place edit": a value with a 32 Sand pencil; tapping either
 * opens a Paper field with a 2 ink border on the phone's own keyboard, then
 * cancel and save circles.
 */
export function InPlaceField({
  screen,
  name,
  label,
  children,
  draft,
  onSave,
  editing,
  onEditingChange,
  keyboard,
  prefix,
}: InPlaceFieldProps) {
  const tokens = useThemeTokens();
  const [text, setText] = useState(draft);
  const amount = keyboard === 'amount';

  if (!editing) {
    return (
      <Press
        testID={tid(screen, name, 'edit')}
        accessibilityLabel={`Edit ${label}`}
        pressedClassName=""
        className="flex-row items-center gap-2 self-start"
        onPress={() => {
          setText(draft);
          onEditingChange(true);
        }}
      >
        <View className="min-w-0 flex-shrink">{children}</View>
        <View className="h-8 w-8 items-center justify-center rounded-full bg-sand">
          <IconSymbol
            name="pencil-outline"
            size={16}
            color={tokens.foreground}
          />
        </View>
      </Press>
    );
  }

  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`flex-1 flex-row items-center gap-1 rounded-field border-2 border-foreground bg-card px-3.5 ${amount ? 'h-16' : 'h-[52px]'}`}
      >
        {prefix ? (
          <Text className="text-[28px] leading-[32px] font-display-bold text-muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          testID={tid(screen, name, 'input')}
          accessibilityLabel={label}
          autoFocus
          selectTextOnFocus
          keyboardType={amount ? 'decimal-pad' : 'default'}
          returnKeyType="done"
          className={`flex-1 p-0 text-foreground ${amount ? 'text-[40px] leading-[44px] font-display-bold' : 'text-[18px] leading-[22px] font-display-semibold'}`}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => {
            if (onSave(text)) onEditingChange(false);
          }}
        />
      </View>
      <Press
        testID={tid(screen, name, 'cancel')}
        accessibilityLabel="Cancel"
        pressedClassName="bg-hairline"
        className="h-11 w-11 items-center justify-center rounded-full bg-sand"
        onPress={() => onEditingChange(false)}
      >
        <IconSymbol
          name="close"
          size={20}
          color={tokens.foreground}
        />
      </Press>
      <Press
        testID={tid(screen, name, 'save')}
        accessibilityLabel={`Save ${label}`}
        pressedClassName="bg-primary-pressed"
        className="h-11 w-11 items-center justify-center rounded-full bg-primary"
        onPress={() => {
          if (onSave(text)) onEditingChange(false);
        }}
      >
        <IconSymbol
          name="check"
          size={20}
          color={tokens.primaryForeground}
        />
      </Press>
    </View>
  );
}
