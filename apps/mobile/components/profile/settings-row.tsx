import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

type SettingsRowProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBgClassName: string;
  iconBgColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  right?: ReactNode;
  disabled?: boolean;
};

export function SettingsRow({
  icon,
  iconBgClassName,
  iconBgColor,
  title,
  subtitle,
  onPress,
  right,
  disabled,
}: SettingsRowProps) {
  const tokens = useThemeTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`mb-2 flex-row items-center rounded-2xl border border-border bg-card p-3.5 active:opacity-90 ${disabled ? 'opacity-50' : ''}`}>
      <View
        className={`h-11 w-11 items-center justify-center rounded-2xl ${iconBgClassName}`}
        style={iconBgColor ? { backgroundColor: iconBgColor } : undefined}>
        <MaterialIcons name={icon} size={22} color="#fff" />
      </View>
      <View className="ml-3 flex-1 min-w-0">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <MaterialIcons name="chevron-right" size={22} color={tokens.muted} />}
    </Pressable>
  );
}
