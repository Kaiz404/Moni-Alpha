import { FunnelDisplay_400Regular } from '@expo-google-fonts/funnel-display/400Regular';
import { FunnelDisplay_600SemiBold } from '@expo-google-fonts/funnel-display/600SemiBold';
import { FunnelDisplay_700Bold } from '@expo-google-fonts/funnel-display/700Bold';
import {
  fontFaces,
  typeScale,
  type TypeStyle,
  type TypeVariant,
} from '@repo/design';
import { createContext, useContext } from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

export const textFonts = {
  FunnelDisplay_400Regular,
  FunnelDisplay_600SemiBold,
  FunnelDisplay_700Bold,
} satisfies Record<
  (typeof fontFaces)[keyof typeof fontFaces]['expo'],
  unknown
>;

function variantStyle({
  face,
  size,
  line,
  tracking,
  uppercase,
}: TypeStyle): TextStyle {
  return {
    fontFamily: fontFaces[face].expo,
    fontSize: size,
    lineHeight: line,
    ...(tracking ? { letterSpacing: size * tracking } : {}),
    ...(uppercase ? { textTransform: 'uppercase' } : {}),
  };
}

const variantStyles = Object.fromEntries(
  Object.entries(typeScale).map(([variant, style]) => [
    variant,
    variantStyle(style),
  ]),
) as Record<TypeVariant, TextStyle>;

export type TextVariant = TypeVariant;

export type TextProps = RNTextProps & { variant?: TextVariant };

const familyClass = /(^|\s)font-display(-semibold|-bold)?(\s|$)/;

// React Native nested Text inherits its parent's style, so a default family here would override a bold parent.
const InsideText = createContext(false);

/**
 * Every app text renders in Funnel Display. `variant` sets family, size, line
 * height and tracking from the V2F-Bible type scale (−0.02em from 18 up,
 * −0.03em on the hero, +0.04em on caps); without one, the `font-display*`
 * class in `className` picks the weight and Regular is the default.
 */
export function Text({
  variant,
  className,
  style,
  children,
  ...props
}: TextProps) {
  const nested = useContext(InsideText);
  const needsDefaultFamily =
    !variant && !nested && !familyClass.test(className ?? '');
  return (
    <RNText
      className={
        needsDefaultFamily
          ? `font-display ${className ?? ''}`
          : className
      }
      style={variant ? [variantStyles[variant], style] : style}
      {...props}
    >
      {typeof children === 'string' ||
      typeof children === 'number' ? (
        children
      ) : (
        <InsideText.Provider value>{children}</InsideText.Provider>
      )}
    </RNText>
  );
}
