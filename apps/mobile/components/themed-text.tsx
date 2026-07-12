import { Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  className?: string;
  /** @deprecated Prefer className tokens; kept for call-site compatibility. */
  lightColor?: string;
  /** @deprecated Prefer className tokens; kept for call-site compatibility. */
  darkColor?: string;
};

export function ThemedText({
  style,
  type = 'default',
  className,
  lightColor: _lightColor,
  darkColor: _darkColor,
  ...rest
}: ThemedTextProps) {
  const defaultClasses = [
    type === 'default' ? 'text-base leading-6 text-foreground' : '',
    type === 'title' ? 'text-4xl font-bold leading-10 text-foreground' : '',
    type === 'defaultSemiBold' ? 'text-base leading-6 font-semibold text-foreground' : '',
    type === 'subtitle' ? 'text-xl font-bold text-foreground' : '',
    type === 'link' ? 'leading-9 text-base text-primary' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClassName = [defaultClasses, className].filter(Boolean).join(' ');

  return <Text className={combinedClassName} style={style} {...rest} />;
}
