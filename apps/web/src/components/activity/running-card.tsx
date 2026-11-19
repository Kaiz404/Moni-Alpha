'use client';

import {
  buildMoneyMonth,
  changePhrase,
  comparisonFor,
  countsAsIncome,
  formatMoney,
  monthName,
  runningChart,
  shiftMonth,
  type ChartBox,
} from '@repo/core';
import { useMemo } from 'react';
import { AxisLabels, Callout, TickRow, useHoverDay, useSize } from '@/components/ledger/chart-parts';
import type { Ledger } from '@/lib/ledger/use-ledger';

/** W2-Activity's chart: this month's running spend against last month's, dashed, with the budget line. */
export function RunningCard({ ledger }: { ledger: Ledger }) {
  const { month, money, currency, now, calendar, transactions } = ledger;
  const previousMonth = shiftMonth(month.month, -1);
  const previous = useMemo(() => buildMoneyMonth(money, { month: previousMonth, currency, now, calendar }), [money, previousMonth, currency, now, calendar]);
  const [ref, size] = useSize<HTMLDivElement>();
  const box: ChartBox = { width: size.width, height: Math.max(size.height - 22, 80), axis: size.width < 480 ? 48 : 64, top: 48, bottom: 2 };
  const chart = useMemo(
    () =>
      runningChart({
        month: month.month,
        daily: month.daily,
        throughDay: month.throughDay,
        previousMonth,
        previousDaily: previous.daily,
        budget: month.budgetMinor,
        currency,
        box: { ...box, width: Math.max(box.width - (box.width < 360 ? 0 : 130), 120) },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- box follows size
    [month, previous, previousMonth, currency, size.width, size.height],
  );
  const [hover, handlers] = useHoverDay(chart.days);
  const comparison = comparisonFor(month.month, now, calendar);
  const before = previous.cumulative[Math.min(month.throughDay, previous.daysInMonth)] ?? 0;
  const phrase = changePhrase(month.spentMinor, before, comparison, currency);
  const incomeMinor = transactions
    .filter((transaction) => transaction.currency === currency && countsAsIncome(transaction) && calendar.monthKey(transaction.transactionDate) === month.month)
    .reduce((sum, transaction) => sum + Number(transaction.amountMinor), 0);
  const name = monthName(month.month);
  const [amount, ...rest] = phrase?.split(' ') ?? [];
  const more = rest[0] === 'more';

  return (
    <section aria-label={`Spent this month against ${monthName(previousMonth)}`} className="card running-card">
      <div className="running-head">
        <div className="running-titles">
          <span className="caps">Spent in {name} so far</span>
          <span className="running-total-line">
            <span className="running-total num" data-spent-minor={month.spentMinor}>
              {formatMoney(month.spentMinor, currency)}
            </span>
            {phrase && (
              <span className="running-change num">
                {phrase.startsWith('Same') ? (
                  phrase
                ) : (
                  <>
                    <b data-tone={more ? 'over' : 'good'}>
                      {amount} {rest[0]}
                    </b>{' '}
                    {rest.slice(1).join(' ')}
                  </>
                )}
              </span>
            )}
          </span>
        </div>
        <div className="running-side">
          <span className="running-in num">
            Money in <b>+{formatMoney(incomeMinor, currency)}</b>
          </span>
          <span className="running-key" data-only="sidebar rail rail-one-column">
            <span>
              <svg width="22" height="4" aria-hidden="true">
                <line x1="1" y1="2" x2="21" y2="2" className="key-solid" />
              </svg>
              {name}
            </span>
            <span>
              <svg width="22" height="4" aria-hidden="true">
                <line x1="1" y1="2" x2="21" y2="2" className="key-dashed" />
              </svg>
              {monthName(previousMonth)}
            </span>
          </span>
        </div>
      </div>
      <div ref={ref} className="running-plot">
        {size.width > 0 && (
          <div
            className="chart-area"
            role="img"
            aria-label={`${name} so far: spent ${formatMoney(month.spentMinor, currency)}${month.budgetMinor === null ? '' : ` against a ${formatMoney(month.budgetMinor, currency, { whole: true })} budget`}. ${monthName(previousMonth)} spent ${formatMoney(previous.spentMinor, currency)} in all.`}
            {...handlers}
          >
            <svg width={box.width} height={box.height} className="chart-svg" aria-hidden="true">
              {chart.rows.map((y, index) => (
                <line key={index} x1={chart.grid.left} x2={chart.grid.right} y1={y} y2={y} className={index === 0 ? 'grid-solid' : 'grid-dashed'} />
              ))}
              {chart.budget && <line x1={chart.grid.left} x2={chart.grid.right} y1={chart.budget.y} y2={chart.budget.y} className="budget-line" />}
              {chart.area && <path d={chart.area} className="area" />}
              {chart.previous.length > 0 && <polyline points={chart.previous.map((point) => `${point.x},${point.y}`).join(' ')} className="previous-line" />}
              {chart.previousEnd && <circle cx={chart.previousEnd.x} cy={chart.previousEnd.y} r={4} className="hollow-dot" />}
              {chart.line.length > 0 && <polyline points={chart.line.map((point) => `${point.x},${point.y}`).join(' ')} pathLength={1} className="spend-line draw" />}
              {chart.line.at(-1) && <circle cx={chart.line.at(-1)!.x} cy={chart.line.at(-1)!.y} r={5} className="hover-dot" />}
              {hover && (
                <>
                  <line x1={hover.x} x2={hover.x} y1={38} y2={hover.y} className="guide" />
                  {hover.previousY !== null && <circle cx={hover.x} cy={hover.previousY} r={5} className="hollow-dot" />}
                  <circle cx={hover.x} cy={hover.y} r={6} className="hover-dot" />
                </>
              )}
            </svg>
            <AxisLabels labels={chart.labels} axis={box.axis} />
            {chart.budget && (
              <span className="budget-label num" style={{ left: chart.grid.left + 8, top: chart.budget.y - 19 }}>
                {chart.budget.text}
              </span>
            )}
            {chart.previousEnd && (
              <span className="previous-tag num" style={{ left: chart.previousEnd.x + 8, top: chart.previousEnd.y - 11 }}>
                <span>{chart.previousEnd.month}</span>
                <b>{chart.previousEnd.value}</b>
              </span>
            )}
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
