import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  className?: string;
  /** @deprecated Prefer className tokens; kept for call-site compatibility. */
  lightColor?: string;
  /** @deprecated Prefer className tokens; kept for call-site compatibility. */
  darkColor?: string;
};

export function ThemedView({
  style,
  className,
  lightColor: _lightColor,
  darkColor: _darkColor,
  ...otherProps
}: ThemedViewProps) {
  return (
    <View className={`bg-background ${className ?? ''}`} style={style} {...otherProps} />
  );
}
