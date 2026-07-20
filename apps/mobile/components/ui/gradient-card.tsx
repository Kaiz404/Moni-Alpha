import { StyleSheet, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { WalletCardStyle } from '@/constants/wallet-card-styles';
import { SquircleView, squircleSmoothing } from './squircle-view';

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
 * Soft squircle surface used for wallet cards and select hero panels.
 * Texture is intentionally omitted so pastel wallet identities remain clean.
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
    <SquircleView
      className={`overflow-hidden rounded-[28px] ${className ?? ''}`}
      cornerSmoothing={squircleSmoothing.hero}
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
      {children}
    </SquircleView>
  );
}
