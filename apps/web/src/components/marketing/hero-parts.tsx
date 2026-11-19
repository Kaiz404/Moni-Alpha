import type { ReactNode } from 'react';
import { MdiIcon } from './parts';

/**
 * A row bubble in the hero's illustrations. `tone` is a bright category colour (Ink glyph in both themes) or a
 * pastel block (its glyph follows the theme's on-pastel colour).
 */
export function HeroBubble({
  size,
  glyph,
  icon,
  tone,
  children,
}: {
  size: number;
  glyph: number;
  icon?: string;
  tone: string;
  children?: ReactNode;
}) {
  return (
    <span className="hx-rb" data-tone={tone} style={{ width: size, height: size }}>
      {icon ? <MdiIcon path={icon} size={glyph} /> : children}
    </span>
  );
}
