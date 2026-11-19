'use client';

import { formatMoney, monthName, type SpendSlice } from '@repo/core';
import { ringSegments } from '@/lib/budget-view';
import { Bubble } from '@/components/ledger/glyph';

const SIZE = 200;
const RADIUS = 84;
const STROKE = 22;
const GAP = 5;

function point(angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [SIZE / 2 + RADIUS * Math.sin(rad), SIZE / 2 - RADIUS * Math.cos(rad)];
}

/**
 * W2-Budget's ring: the month's spending by category, a gap and a round cap between slices and
 * each slice's glyph on it. A slice opens its category. The ring lives only on Budget.
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
  const cap = ((STROKE / 2 / RADIUS) * 180) / Math.PI;
  const segments = ringSegments(slices.map((slice) => ({ key: slice.categoryId ?? 'none', spentMinor: slice.spentMinor })));
  const byKey = new Map(slices.map((slice) => [slice.categoryId ?? 'none', slice]));
  const [whole, cents] = formatMoney(spentMinor, currency).split('.');
  const symbolEnd = whole!.search(/\d/);
  const label = `Spent in ${monthName(month)}, ${formatMoney(spentMinor, currency)}${
    budgetMinor ? ` of ${formatMoney(budgetMinor, currency, { whole: true })}` : ''
  }, by category. Pick a slice to open its category.`;
  return (
    <div className="spend-ring" role="img" aria-label={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {segments.length === 0 && (
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-sand)" strokeWidth={STROKE} />
        )}
        {segments.map((segment) => {
          const slice = byKey.get(segment.key)!;
          const color = slice.color ?? 'var(--color-sand)';
          const draw = segment.span - GAP - 2 * cap;
          const pick = slice.categoryId ? () => onPick(slice.categoryId!) : undefined;
          if (draw <= 0.5 || segments.length === 1) {
            if (segments.length === 1) {
              return <circle key={segment.key} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={color} strokeWidth={STROKE} onClick={pick} className="ring-slice" />;
            }
            const [x, y] = point(segment.start + segment.span / 2);
            return <circle key={segment.key} cx={x} cy={y} r={STROKE / 2 - 1} fill={color} onClick={pick} className="ring-slice" />;
          }
          const [x1, y1] = point(segment.start + GAP / 2 + cap);
          const [x2, y2] = point(segment.start + segment.span - GAP / 2 - cap);
          return (
            <path
              key={segment.key}
              d={`M${x1.toFixed(1)},${y1.toFixed(1)} A${RADIUS},${RADIUS} 0 ${draw > 180 ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              onClick={pick}
              className="ring-slice"
            />
          );
        })}
      </svg>
      {segments.map((segment) => {
        const slice = byKey.get(segment.key)!;
        const [x, y] = point(segment.start + segment.span / 2);
        return (
          <span key={segment.key} className="ring-glyph" style={{ left: x - 9, top: y - 9 }}>
            <Bubble icon={slice.icon} color="transparent" size={18} glyph={10} />
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
