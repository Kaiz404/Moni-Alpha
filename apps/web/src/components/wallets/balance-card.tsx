'use client';

import { balanceChart, CHART_RANGES, formatMoney, type BalanceIndex, type ChartRange } from '@repo/core';
import { useMemo, useState, type ReactNode } from 'react';
import { AxisLabels, Callout, TickRow, useHoverDay, useSize } from '@/components/ledger/chart-parts';
import type { Ledger } from '@/lib/ledger/use-ledger';

/**
 * The balance over a range ending today, as a line: net worth on All wallets, one wallet's balance on
 * its page. `head` is the card's title block; the range sits beside it.
 */
export function BalanceCard({
  ledger,
  index,
  series,
  currency,
  label,
  head,
}: {
  ledger: Ledger;
  index: BalanceIndex;
  series: 'total' | string;
  currency: string;
  label: string;
  head: ReactNode;
}) {
  const [range, setRange] = useState<ChartRange>('30d');
  const [ref, size] = useSize<HTMLDivElement>();
  const box = { width: size.width, height: Math.max(size.height - 22, 80), axis: size.width < 480 ? 56 : 72, top: 12, bottom: 2 };
  const chart = useMemo(
    () => balanceChart({ index, series, now: ledger.now, range, calendar: ledger.calendar, currency, box }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- box follows size
    [index, series, ledger.now, range, ledger.calendar, currency, size.width, size.height],
  );
  const [hover, handlers] = useHoverDay(chart.days);
  const rangeLabel = CHART_RANGES.find((option) => option.value === range)!.label;
  const change = chart.changeMinor;

  return (
    <section className="card balance-card" aria-label={label}>
      <div className="balance-head">
        {head}
        <div className="balance-side">
          <div className="seg-tabs" role="radiogroup" aria-label="Time range">
            {CHART_RANGES.map((option) => (
              <button key={option.value} type="button" role="radio" aria-checked={option.value === range} onClick={() => setRange(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          <span className="meta num balance-change" data-tone={change > 0 ? 'good' : change < 0 ? 'over' : undefined}>
            {change === 0 ? `No change over ${rangeLabel}` : `${change > 0 ? '+' : ''}${formatMoney(change, currency)} over ${rangeLabel}`}
          </span>
        </div>
      </div>
      <div ref={ref} className="balance-plot">
        {size.width > 0 && (
          <div className="chart-area" role="img" aria-label={`${label} over ${rangeLabel}, ${chart.days[0]?.value ?? ''} to ${chart.days.at(-1)?.value ?? ''}`} {...handlers}>
            <svg width={box.width} height={box.height} className="chart-svg" aria-hidden="true">
              {chart.rows.map((y, row) => (
                <line key={row} x1={chart.grid.left} x2={chart.grid.right} y1={y} y2={y} className={row === 0 ? 'grid-solid' : 'grid-dashed'} />
              ))}
              {chart.area && <path d={chart.area} className="area" />}
              {chart.line.length > 0 && <polyline points={chart.line.map((point) => `${point.x},${point.y}`).join(' ')} pathLength={1} className="spend-line draw" />}
              {chart.line.at(-1) && <circle cx={chart.line.at(-1)!.x} cy={chart.line.at(-1)!.y} r={5} className="hover-dot" />}
              {hover && (
                <>
                  <line x1={hover.x} x2={hover.x} y1={chart.grid.top} y2={hover.y} className="guide" />
                  <circle cx={hover.x} cy={hover.y} r={6} className="hover-dot" />
                </>
              )}
            </svg>
            <AxisLabels labels={chart.labels} axis={box.axis} />
            {hover && <Callout x={hover.x} width={box.width} date={hover.date} value={hover.value} />}
            <div style={{ position: 'absolute', left: 0, right: 0, top: box.height + 6 }}>
              <TickRow ticks={chart.ticks} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
