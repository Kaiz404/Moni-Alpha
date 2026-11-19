'use client';

import { currencySymbol, dailyChart, monthName, paceChart, type ChartBox, type ChartLabel, type MoneyMonth } from '@repo/core';
import { useEffect, useMemo } from 'react';
import { AxisLabels, Callout, ChartEmpty, TickRow, useHoverDay, useSize } from '@/components/ledger/chart-parts';

export type SpentMode = 'pace' | 'daily';

/** "Spent in October": Pace or Daily, a tooltip only under the pointer, then what's left (W2-Home). */
export function SpentCard({
  month,
  mode,
  onMode,
  firstRun,
}: {
  month: MoneyMonth;
  mode: SpentMode;
  onMode: (mode: SpentMode) => void;
  firstRun: boolean;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const box: ChartBox = { width: size.width, height: Math.max(size.height - 22, 60), axis: size.width < 480 ? 44 : 56, top: 14, bottom: 8 };
  const name = monthName(month.month);
  const pace = useMemo(
    () =>
      paceChart({ month: month.month, daily: month.daily, throughDay: month.throughDay, budget: month.budgetMinor, currency: month.currency, box }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- box is rebuilt each render from size
    [month, size.width, size.height],
  );
  const daily = useMemo(
    () =>
      dailyChart({
        month: month.month,
        daily: month.daily,
        throughDay: month.throughDay,
        evenPace: month.evenPaceMinor,
        safePerDay: month.left?.perDayMinor ?? null,
        isCurrent: month.isCurrent,
        currency: month.currency,
        box,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- box is rebuilt each render from size
    [month, size.width, size.height],
  );
  const [hover, hoverHandlers] = useHoverDay(mode === 'pace' ? pace.days : daily.days);
  useEffect(() => hoverHandlers.onPointerLeave(), [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const line = month.words.homeLine ?? (month.budgetMinor === null ? `Set ${name}'s budget to see what's safe to spend.` : null);
  const ready = size.width > 0;

  return (
    <section aria-label={`Spent in ${name}`} className="card spent-card" data-card="spent">
      <div className="card-head">
        <span className="caps">Spent in {name}</span>
        <span className="card-head-end">
          <span className="key-hint" data-only="sidebar rail rail-one-column">
            <span className="kbd">P</span> <span className="kbd">D</span>
          </span>
          <span className="toggle" role="radiogroup" aria-label="Chart">
            <span className="toggle-pill" aria-hidden="true" data-at={mode} />
            <button type="button" role="radio" aria-checked={mode === 'pace'} onClick={() => onMode('pace')}>
              Pace
            </button>
            <button type="button" role="radio" aria-checked={mode === 'daily'} onClick={() => onMode('daily')}>
              Daily
            </button>
          </span>
        </span>
      </div>
      <div ref={ref} className="spent-plot">
        {ready && (
          <div
            key={mode}
            className="chart-area fade-swap"
            role="img"
            aria-label={
              mode === 'pace'
                ? `Spent so far in ${name}, ${pace.days.at(-1)?.value ?? 'nothing'}${month.budgetMinor === null ? '' : `, against the ${pace.labels.find((label) => label.tone === 'mint')?.text} budget. Dashed line is an even pace`}.`
                : `Daily spending, 1 to ${month.throughDay} ${name}.`
            }
            {...hoverHandlers}
          >
            {mode === 'pace' ? (
              <svg width={box.width} height={box.height} className="chart-svg" aria-hidden="true">
                <line x1={pace.grid.left} x2={pace.grid.right} y1={pace.grid.top} y2={pace.grid.top} className="grid-solid" />
                {!firstRun && <line x1={pace.grid.left} x2={pace.grid.right} y1={pace.grid.middle} y2={pace.grid.middle} className="grid-dashed" />}
                <line x1={pace.grid.left} x2={pace.grid.right} y1={pace.grid.base} y2={pace.grid.base} className="grid-solid" />
                {!firstRun && <path d={pace.area} className="area" />}
                {pace.evenPace && <line {...pace.evenPace} className="even-pace" />}
                {!firstRun && (
                  <polyline points={pace.line.map((point) => `${point.x},${point.y}`).join(' ')} pathLength={1} className="spend-line draw" />
                )}
                {pace.budget && <circle cx={pace.budget.x} cy={pace.budget.y} r={5} className="budget-dot" />}
                {hover && (
                  <>
                    <line x1={hover.x} x2={hover.x} y1={38} y2={hover.y} className="guide" />
                    <circle cx={hover.x} cy={hover.y} r={5.5} className="hover-dot" />
                  </>
                )}
              </svg>
            ) : (
              <svg width={box.width} height={box.height} className="chart-svg" aria-hidden="true">
                {daily.today && <rect x={daily.today.x} y={daily.grid.top + 20} width={daily.today.width} height={daily.grid.base - daily.grid.top - 20} rx={8} className="today-band" />}
                <line x1={daily.grid.left} x2={daily.grid.right} y1={daily.grid.top} y2={daily.grid.top} className="grid-dashed" />
                <line x1={daily.grid.left} x2={daily.grid.right} y1={daily.grid.base} y2={daily.grid.base} className="grid-solid" />
                {daily.bars.map((bar, index) => (
                  <g key={index} className="grow" style={{ animationDelay: `${index * 14}ms` }} data-hover={hover?.day === index + 1 || undefined}>
                    <rect x={bar.x} y={bar.top} width={bar.width} height={daily.grid.base - bar.top} rx={bar.width / 2} className="bar" />
                    {bar.overTop !== null && daily.evenPaceY !== null && (
                      <rect x={bar.x} y={bar.top} width={bar.width} height={daily.evenPaceY - bar.top} rx={bar.width / 2} className="bar-over" />
                    )}
                  </g>
                ))}
                {daily.safe && <line x1={daily.safe.x} x2={daily.safe.x} y1={daily.safe.top} y2={daily.safe.top + daily.safe.height} className="safe" />}
                {daily.evenPaceY !== null && <line x1={daily.grid.left} x2={daily.grid.right} y1={daily.evenPaceY} y2={daily.evenPaceY} className="pace-line" />}
              </svg>
            )}
            <AxisLabels labels={firstRun ? emptyLabels(mode === 'pace' ? pace.labels : daily.labels, month.currency) : mode === 'pace' ? pace.labels : daily.labels} axis={box.axis} />
            {mode === 'pace' && pace.budget && (
              <span className="chart-caption" style={{ top: pace.grid.top - 26 }}>
                Budget
              </span>
            )}
            {firstRun && <ChartEmpty>Your spending draws a line here, day by day, against an even pace.</ChartEmpty>}
            {hover && <Callout x={hover.x} width={box.width} date={hover.date} value={hover.value} />}
            <div style={{ position: 'absolute', left: 0, right: 0, top: box.height + 6 }}>
              <TickRow ticks={mode === 'pace' ? pace.ticks : daily.ticks} />
            </div>
          </div>
        )}
      </div>
      {line && <p className="spent-line num">{line}</p>}
    </section>
  );
}

/** W2-Empty's empty chart: no scale yet, so the top reads RM– and only the base reads RM0. */
function emptyLabels(labels: readonly ChartLabel[], currency: string): ChartLabel[] {
  const top = labels[0];
  const base = labels.at(-1);
  if (!top || !base || top === base) return [...labels];
  return [{ ...top, text: `${currencySymbol(currency)}–` }, base];
}
