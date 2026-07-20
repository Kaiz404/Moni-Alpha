import type { ComponentProps } from 'react';
import { SquircleView, squircleSmoothing } from './squircle-view';

export type SurfaceTone =
  | 'default'
  | 'muted'
  | 'raised'
  | 'tray'
  | 'aqua'
  | 'lilac'
  | 'peach'
  | 'lemon'
  | 'coral';
export type SurfaceSmoothing = 'card' | 'hero';

type SurfaceProps = ComponentProps<typeof SquircleView> & {
  className?: string;
  tone?: SurfaceTone;
  /** Use `hero` only for wallet cards and other feature-sized surfaces. */
  smoothing?: SurfaceSmoothing;
};

const toneClass: Record<SurfaceTone, string> = {
  default: 'bg-card',
  muted: 'bg-surface-2',
  raised: 'bg-surface-raised',
  tray: 'bg-surface-tray',
  aqua: 'bg-accent-aqua/30',
  lilac: 'bg-accent-lilac/30',
  peach: 'bg-accent-peach/30',
  lemon: 'bg-accent-lemon/30',
  coral: 'bg-accent-coral/30',
};

/**
 * Borderless, tonal container for genuine grouped content only.
 *
 * Regular cards use continuous 22pt corners. Opt into the more pronounced
 * `hero` curve for a wallet, large summary, or other feature-sized surface.
 * Accent tones are for standalone feature panels, never dense repeated rows.
 */
export function Surface({
  className,
  tone = 'default',
  smoothing = 'card',
  cornerSmoothing,
  ...props
}: SurfaceProps) {
  return (
    <SquircleView
      className={`rounded-[22px] ${toneClass[tone]} ${className ?? ''}`}
      cornerSmoothing={cornerSmoothing ?? squircleSmoothing[smoothing]}
      {...props}
    />
  );
}
