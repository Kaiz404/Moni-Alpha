import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { IconSymbol, type IconSymbolName } from './icon-symbol';
import { TactilePressable } from './tactile-pressable';

type IconActionProps = {
  accessibilityLabel: string;
  icon: IconSymbolName;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'danger';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Minimum-44pt icon action with a visible semantic surface. */
export function IconAction({
  accessibilityLabel,
  icon,
  onPress,
  disabled,
  tone = 'default',
  size = 20,
  style,
}: IconActionProps) {
  const tokens = useThemeTokens();
  const appearance = {
    default: {
      color: tokens.foreground,
    },
    accent: {
      color: tokens.primary,
    },
    danger: {
      color: tokens.danger,
    },
  }[tone];

  return (
    <TactilePressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className={`h-11 w-11 items-center justify-center rounded-full ${
        disabled ? 'opacity-50' : ''
      }`}
      style={style}
    >
      <View pointerEvents="none">
        <IconSymbol
          name={icon}
          size={size}
          color={appearance.color}
        />
      </View>
    </TactilePressable>
  );
}
