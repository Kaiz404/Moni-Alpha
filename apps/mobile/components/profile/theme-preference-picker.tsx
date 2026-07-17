import { View, Text, Pressable } from 'react-native';
import { useUniwind } from 'uniwind';
import {
  THEME_PREFERENCE_OPTIONS,
  resolveActivePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme/preference';

export function ThemePreferencePicker() {
  const { theme, hasAdaptiveThemes } = useUniwind();
  const active = resolveActivePreference(theme, hasAdaptiveThemes);

  const select = (preference: ThemePreference) => {
    setThemePreference(preference);
  };

  return (
    <View className="mb-2 overflow-hidden rounded-[22px] border border-border bg-card">
      {THEME_PREFERENCE_OPTIONS.map((option, index) => {
        const selected = active === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => select(option.value)}
            className={`min-h-18 flex-row items-center px-4 py-3.5 active:bg-surface-2 ${
              index > 0 ? 'border-t border-border' : ''
            }`}
          >
            <View className="flex-1 min-w-0 pr-3">
              <Text className="text-[17px] font-semibold text-foreground">
                {option.label}
              </Text>
              <Text className="mt-0.5 text-[13px] text-muted">
                {option.subtitle}
              </Text>
            </View>
            <View
              className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected
                  ? 'border-primary bg-primary'
                  : 'border-border bg-card'
              }`}
            >
              {selected ? (
                <View className="h-2 w-2 rounded-full bg-primary-foreground" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
