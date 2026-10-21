import { useUniwind } from 'uniwind';

import { Segmented } from '@/components/ui/segmented';
import {
  THEME_PREFERENCE_OPTIONS,
  resolveActivePreference,
  setThemePreference,
} from '@/lib/theme/preference';

export function ThemePreferencePicker() {
  const { theme, hasAdaptiveThemes } = useUniwind();
  return (
    <Segmented
      screen="profile"
      name="theme"
      accessibilityLabel="Appearance"
      options={THEME_PREFERENCE_OPTIONS}
      value={resolveActivePreference(theme, hasAdaptiveThemes)}
      onChange={setThemePreference}
    />
  );
}
