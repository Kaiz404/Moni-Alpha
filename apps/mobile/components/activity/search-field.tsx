import { TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="h-[52px] flex-row items-center gap-2.5 rounded-full bg-card pl-[18px] pr-1.5">
      <IconSymbol name="magnify" size={20} color={tokens.muted} />
      <TextInput
        testID={tid('activity', 'search')}
        accessibilityLabel="Search transactions"
        placeholder="Search merchant, note or amount"
        placeholderTextColor={tokens.muted}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        autoCorrect={false}
        className="h-full flex-1 font-display text-[15px] text-foreground"
      />
      {value ? (
        <Press
          testID={tid('activity', 'search', 'clear')}
          accessibilityLabel="Clear search"
          onPress={() => onChange('')}
          pressedClassName="bg-sand"
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <IconSymbol name="close" size={18} color={tokens.muted} />
        </Press>
      ) : null}
    </View>
  );
}
