import { Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  className?: string;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  className,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const defaultClasses = [
    type === 'default' ? 'text-base leading-6' : '',
    type === 'title' ? 'text-4xl font-bold leading-10' : '',
    type === 'defaultSemiBold' ? 'text-base leading-6 font-semibold' : '',
    type === 'subtitle' ? 'text-xl font-bold' : '',
    type === 'link' ? 'leading-9 text-base text-cyan-600 dark:text-cyan-400' : '',
  ].filter(Boolean).join(' ');

  const combinedClassName = [defaultClasses, className].filter(Boolean).join(' ');

  return (
    <Text
      className={combinedClassName}
      style={[
        { color },
        style,
      ]}
      {...rest}
    />
  );
}

