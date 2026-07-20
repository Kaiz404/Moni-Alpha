import type { ComponentProps, ComponentType } from 'react';
import FastSquircleView from 'react-native-fast-squircle';
import { withUniwind } from 'uniwind';

type FastSquircleViewProps = ComponentProps<typeof FastSquircleView>;

/**
 * Uniwind-compatible native squircle view.
 *
 * Keep this wrapper at module scope: `withUniwind` then resolves class names
 * without constructing a new HOC for every rendered surface.
 */
export type SquircleViewProps = FastSquircleViewProps & {
  className?: string;
};

export const SquircleView = withUniwind(FastSquircleView) as ComponentType<SquircleViewProps>;

/** Figma-aligned smoothing for regular and feature-sized Moni surfaces. */
export const squircleSmoothing = {
  card: 0.65,
  hero: 0.75,
} as const;
