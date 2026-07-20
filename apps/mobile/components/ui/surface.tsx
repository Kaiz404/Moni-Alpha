import type { ComponentProps } from 'react';
import { SquircleView, squircleSmoothing } from './squircle-view';

export type SurfaceTone = 'default' | 'muted' | 'raised' | 'tray';
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
};

/**
 * Borderless, tonal container for genuine grouped content only.
 *
 * Regular cards use continuous 22pt corners. Opt into the more pronounced
 * `hero` curve for a wallet, large summary, or other feature-sized surface.
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
