import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** A 44 circle tightens to 16 corners under the finger (V2F-Components "Icon button"). */
const PRESSED_CORNERS = { rest: 22, pressed: 16 };

type HeaderIconButtonProps = {
  testID: TestId;
  icon: IconSymbolName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** Selected, as V2F-Components draws it: Ink fill and edge, cream glyph (a toggled filter or the map's list view). */
  active?: boolean;
  /** Back and close draw at 22; every other header glyph at 20. */
  glyphSize?: 20 | 22;
};

/** The 44 hairline circle used for every header action except Ask Moni. */
export function HeaderIconButton({
  testID,
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  active = false,
  glyphSize = 20,
}: HeaderIconButtonProps) {
  const tokens = useThemeTokens();
  const edge = disabled
    ? 'border-sand-light'
    : active
      ? 'border-primary bg-primary'
      : 'border-hairline';
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      radius={PRESSED_CORNERS}
      pressedClassName={active ? 'bg-primary-pressed' : 'bg-sand'}
      className={`h-11 w-11 items-center justify-center border-[1.5px] ${edge}`}
    >
      <View pointerEvents="none">
        <IconSymbol
          name={icon}
          size={glyphSize}
          color={
            disabled
              ? tokens.muted
              : active
                ? tokens.primaryForeground
                : tokens.foreground
          }
        />
      </View>
    </Press>
  );
}

type MoniButtonProps = {
  testID: TestId;
  onPress: () => void;
};

/** Ink circle with the Lilac `creation` glyph: the one AI door in a header (Home and Activity). */
export function MoniButton({ testID, onPress }: MoniButtonProps) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityLabel="Ask Moni"
      radius={PRESSED_CORNERS}
      pressedClassName="bg-primary-pressed"
      className="h-11 w-11 items-center justify-center bg-primary"
    >
      <View pointerEvents="none">
        <IconSymbol
          name="creation"
          size={22}
          color={tokens.moniGlyph}
        />
      </View>
    </Press>
  );
}
