import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';

type SettingsRowProps = {
  icon: IconSymbolName;
  iconBgClassName: string;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  onPress: () => void;
  right?: ReactNode;
  disabled?: boolean;
  showDivider?: boolean;
};

export function SettingsRow({
  icon,
  iconBgClassName,
  iconBgColor,
  iconColor,
  title,
  onPress,
  right,
  disabled,
  showDivider = true,
}: SettingsRowProps) {
  const tokens = useThemeTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`min-h-18 flex-row items-center px-4 py-3.5 active:bg-surface-2 ${
        showDivider ? 'border-b border-border-subtle' : ''
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <View
        className={`h-11 w-11 items-center justify-center rounded-2xl ${iconBgClassName}`}
        style={
          iconBgColor ? { backgroundColor: iconBgColor } : undefined
        }
      >
        <IconSymbol
          name={icon}
          size={22}
          color={iconColor ?? tokens.primaryForeground}
        />
      </View>
      <View className="ml-3 flex-1 min-w-0">
        <Text
          className="text-[17px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {right ?? (
        <IconSymbol
          name="chevron-right"
          size={22}
          color={tokens.muted}
        />
      )}
    </Pressable>
  );
}
