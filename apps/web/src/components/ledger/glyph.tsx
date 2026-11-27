import { legacyColor } from '@repo/types';
import type { CSSProperties } from 'react';
import { glyphPath } from '@/lib/glyph-path';
import './glyph.css';

/** An MDI glyph a row names as data (a category's or a wallet's icon). No name draws the "?" of no category. */
export function Glyph({ name, size = 20, className }: { name: string | null | undefined; size?: number; className?: string }) {
  const path = glyphPath(name);
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className} style={{ flex: 'none' }}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/**
 * A category bubble: the category's colour solid with an Ink glyph (tokens.md Lists and rows). No colour
 * is a transfer's Sand bubble; `dashed` is a capture still to review.
 */
export function Bubble({
  icon,
  color,
  size = 42,
  glyph = Math.round(size * 0.48),
  dashed = false,
  label,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: number;
  glyph?: number;
  dashed?: boolean;
  label?: string;
}) {
  const style: CSSProperties = { width: size, height: size };
  if (!dashed && color) style.background = legacyColor(color);
  return (
    <span className="bubble" data-dashed={dashed || undefined} data-plain={!color || undefined} style={style} aria-label={label} role={label ? 'img' : undefined}>
      <Glyph name={icon} size={glyph} />
    </span>
  );
}

/** A person's rounded-square initial, coloured by who owes whom. */
export function PersonTile({ name, owedToMe, size = 40 }: { name: string; owedToMe: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="person-tile"
      data-side={owedToMe ? 'in' : 'out'}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.36), fontSize: Math.round(size * 0.4) }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
