'use client';

import { formatMoney, monthName, ringSegments, type RingOptions, type SpendSlice } from '@repo/core';
import { Bubble } from '@/components/ledger/glyph';

const SIZE = 200;
/** The phone's ring (284 wide) scaled to 200, so both draw the same arcs and gaps. */
const RING = { radius: 87, strokeWidth: 24, gap: 7, minSweep: 2, maxSegments: 8 } as const satisfies RingOptions;

function point(angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [SIZE / 2 + RING.radius * Math.sin(rad), SIZE / 2 - RING.radius * Math.cos(rad)];
}

/**
 * W2-Budget's ring, laid out as the phone's: the month's spending by category, biggest first, as
 * round-capped arcs a fixed gap apart, the smallest folded into one Other arc past eight, and each
 * arc's glyph on it. An arc opens its category.
 */
export function SpendRing({
  slices,
  spentMinor,
  budgetMinor,
  currency,
  month,
  onPick,
}: {
  slices: readonly SpendSlice[];
  spentMinor: number;
  budgetMinor: number | null;
  currency: string;
  month: string;
  onPick: (categoryId: string) => void;
}) {
  const arcs = ringSegments(
    slices.map((slice) => Number(slice.spentMinor)),
    RING,
  ).map((segment) => {
    const slice = segment.indexes.length === 1 ? slices[segment.indexes[0]!]! : null;
    return {
      ...segment,
      key: slice ? (slice.categoryId ?? 'none') : 'other',
      color: slice?.color ?? null,
      icon: slice ? (slice.categoryId ? slice.icon : 'help-circle-outline') : 'dots-horizontal',
      categoryId: slice?.categoryId ?? null,
    };
  });
  const [whole, cents] = formatMoney(spentMinor, currency).split('.');
  const symbolEnd = whole!.search(/\d/);
  const label = `Spent in ${monthName(month)}, ${formatMoney(spentMinor, currency)}${
    budgetMinor ? ` of ${formatMoney(budgetMinor, currency, { whole: true })}` : ''
  }, by category. Pick a slice to open its category.`;
  return (
    <div className="spend-ring" role="img" aria-label={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {arcs.length === 0 && (
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RING.radius} fill="none" stroke="var(--color-sand)" strokeWidth={RING.strokeWidth} />
        )}
        {arcs.map((arc) => {
          const [x1, y1] = point(arc.start);
          const [x2, y2] = point(arc.start + arc.sweep);
          const { categoryId } = arc;
          return (
            <path
              key={arc.key}
              d={`M${x1.toFixed(2)},${y1.toFixed(2)} A${RING.radius},${RING.radius} 0 ${arc.sweep > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`}
              fill="none"
              stroke={arc.color ?? undefined}
              strokeWidth={RING.strokeWidth}
              strokeLinecap="round"
              onClick={categoryId ? () => onPick(categoryId) : undefined}
              className="ring-slice"
              data-plain={arc.color ? undefined : true}
            />
          );
        })}
      </svg>
      {arcs.map((arc) => {
        const [x, y] = point(arc.start + arc.sweep / 2);
        return (
          <span key={arc.key} className="ring-glyph" style={{ left: x - 9, top: y - 9 }}>
            <Bubble icon={arc.icon} color="transparent" size={18} glyph={10} />
          </span>
        );
      })}
      <div className="ring-centre">
        <span className="num ring-total">
          <small>{whole!.slice(0, symbolEnd)}</small>
          {whole!.slice(symbolEnd)}
          <small>.{cents}</small>
        </span>
        {budgetMinor ? <span className="num ring-of">of {formatMoney(budgetMinor, currency, { whole: true })}</span> : null}
      </div>
    </div>
  );
}
