import {
  Image,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { WalletCardStyle } from '@/constants/wallet-card-styles';

const GRAIN_OPACITY: Record<WalletCardStyle['grain'], number> = {
  subtle: 0.05,
  medium: 0.09,
};

/** Converts a CSS-style gradient angle (0deg = up, clockwise) to unit-square start/end points. */
function angleToPoints(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  return {
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}

type GradientCardProps = ViewProps & {
  cardStyle: WalletCardStyle;
  /** Tailwind radius/height/etc utilities for the outer card — colors come from `cardStyle`. */
  className?: string;
  /** Adds a faint top-left sheen for extra depth. Default: true. */
  sheen?: boolean;
};

/**
 * Grainy gradient surface used for wallet cards and select hero panels.
 * Grain is a pre-rendered noise asset (RN has no native blend-mode/noise support),
 * layered at low opacity on top of the LinearGradient.
 */
export function GradientCard({
  cardStyle,
  className,
  sheen = true,
  children,
  style,
  ...props
}: GradientCardProps) {
  const { start, end } = angleToPoints(cardStyle.angle);

  return (
    <View
      className={`overflow-hidden ${className ?? ''}`}
      style={style}
      {...props}
    >
      <LinearGradient
        colors={cardStyle.colors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFill}
      />
      {sheen ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Image
        source={require('@/assets/images/grain.png')}
        resizeMode="cover"
        style={[
          StyleSheet.absoluteFill,
          { opacity: GRAIN_OPACITY[cardStyle.grain] },
        ]}
      />
      {children}
    </View>
  );
}
