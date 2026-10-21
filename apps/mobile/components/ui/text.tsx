import { FunnelDisplay_400Regular } from '@expo-google-fonts/funnel-display/400Regular';
import { FunnelDisplay_600SemiBold } from '@expo-google-fonts/funnel-display/600SemiBold';
import { FunnelDisplay_700Bold } from '@expo-google-fonts/funnel-display/700Bold';
import { createContext, useContext } from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

/** Font files keyed by family name; the keys match `--font-display*` in global.css. */
export const textFonts = {
  FunnelDisplay_400Regular,
  FunnelDisplay_600SemiBold,
  FunnelDisplay_700Bold,
};

type FontFamily = keyof typeof textFonts;

const variantStyles = {
  hero: {
    fontFamily: 'FunnelDisplay_700Bold',
    fontSize: 64,
    lineHeight: 64,
  },
  amountHero: {
    fontFamily: 'FunnelDisplay_700Bold',
    fontSize: 52,
    lineHeight: 54,
  },
  screenTitle: {
    fontFamily: 'FunnelDisplay_700Bold',
    fontSize: 28,
    lineHeight: 32,
  },
  sectionTitle: {
    fontFamily: 'FunnelDisplay_700Bold',
    fontSize: 22,
    lineHeight: 26,
  },
  cardTitle: {
    fontFamily: 'FunnelDisplay_700Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  rowTitle: {
    fontFamily: 'FunnelDisplay_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'FunnelDisplay_400Regular',
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    fontFamily: 'FunnelDisplay_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  smallest: {
    fontFamily: 'FunnelDisplay_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  caps: {
    fontFamily: 'FunnelDisplay_700Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.48,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle & { fontFamily: FontFamily }>;

export type TextVariant = keyof typeof variantStyles;

export type TextProps = RNTextProps & { variant?: TextVariant };

const familyClass = /(^|\s)font-display(-semibold|-bold)?(\s|$)/;

// A nested Text inherits its parent's family unless it names its own.
const InsideText = createContext(false);

/**
 * Every app text renders in Funnel Display. `variant` sets family, size, and
 * line height from the tokens.md type scale; without one, the `font-display*`
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
