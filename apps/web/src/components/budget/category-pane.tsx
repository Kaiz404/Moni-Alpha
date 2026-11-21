'use client';

import {
  dayLabel,
  formatMoney,
  formatSignedMoney,
  monthName,
  monthShort,
  type FinanceProposal,
  type FinanceTransaction,
} from '@repo/core';
import Link from 'next/link';
import { useState, type PointerEvent } from 'react';
import { chartTop, type BudgetLine } from '@/lib/budget-view';
import type { Calendar } from '@repo/core';
import { Callout } from '@/components/ledger/chart-parts';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { reviewHref } from '@/lib/review-view';
import { BudgetEditor, type BudgetEdit } from './budget-editor';

const CHART_W = 340;
const CHART_H = 150;
const AXIS = 44;
const PLOT_H = CHART_H - 4;
const PAGE = 6;

/** Six months of one category against its budget line; the month on show is the bold one, and a month's spending shows under the pointer. */
function HistoryChart({ line, months, currency }: { line: BudgetLine; months: readonly string[]; currency: string }) {
  const top = chartTop(line.months, line.budgetMinor);
  const x0 = AXIS + 8;
  const slot = (CHART_W - x0) / months.length;
  const barW = 30;
  const y = (minor: number) => PLOT_H - (PLOT_H * minor) / top;
  const over = line.note.tone === 'over';
  const lineY = line.budgetMinor ? Math.max(22, Math.min(PLOT_H, y(line.budgetMinor))) : null;
  const last = months.length - 1;
  const [tip, setTip] = useState<number | null>(null);
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    setTip(x < x0 ? null : Math.min(last, Math.floor((x - x0) / slot)));
  };
  return (
    <div className="history">
      <div
        className="history-plot"
        role="img"
        aria-label={`${line.name} spending by month: ${months.map((month, index) => `${monthShort(month)} ${formatMoney(line.months[index] ?? 0, currency)}`).join(', ')}`}
        style={{ width: CHART_W, height: CHART_H }}
        onPointerMove={point}
        onPointerLeave={() => setTip(null)}
      >
        <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden="true">
          <line x1={x0} y1={PLOT_H} x2={CHART_W} y2={PLOT_H} stroke="var(--color-hairline)" strokeWidth={1.5} />
          {months.map((month, index) => {
            const value = line.months[index] ?? 0;
            const height = Math.max(value > 0 ? 6 : 4, PLOT_H - y(value));
            return (
              <rect
                key={month}
                className="history-bar"
                x={x0 + slot * index + (slot - barW) / 2}
                y={PLOT_H - height}
                width={barW}
                height={height}
                rx={value > 0 ? 8 : 2}
                fill={index === last ? (over ? 'var(--color-coral)' : 'var(--color-ink-2)') : value > 0 ? 'var(--color-hairline)' : 'var(--color-sand)'}
              />
            );
          })}
        </svg>
        <span className="num history-axis" style={{ top: -8 }}>
          {formatMoney(top, currency, { whole: true })}
        </span>
        <span className="num history-axis" style={{ top: PLOT_H - 8 }}>
          {formatMoney(0, currency, { whole: true })}
        </span>
        {lineY !== null && (
          <>
            <span className="history-budget" style={{ left: x0, top: lineY }} />
            <span className="num history-budget-label" style={{ left: x0, top: lineY - 18 }}>
              {formatMoney(line.budgetMinor!, currency, { whole: true })} budget
            </span>
          </>
        )}
        {tip !== null && <Callout x={x0 + slot * tip + slot / 2} width={CHART_W} date={monthName(months[tip]!)} value={formatMoney(line.months[tip] ?? 0, currency)} />}
      </div>
      <div className="history-ticks" style={{ width: CHART_W, paddingLeft: x0 }}>
        {months.map((month, index) => (
          <span key={month} data-current={index === last || undefined}>
            {monthShort(month)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CategoryPane({
  line,
  index,
  count,
  month,
  months,
  currency,
  isCurrent,
  payments,
  toReview,
  walletNames,
  calendar,
  today,
  edit,
  editing,
  onEdit,
  onDraft,
  onSave,
  onCancel,
  onMove,
  onClose,
}: {
  line: BudgetLine;
  index: number;
  count: number;
  month: string;
  months: readonly string[];
  currency: string;
  isCurrent: boolean;
  payments: readonly FinanceTransaction[];
  toReview: readonly FinanceProposal[];
  walletNames: Record<string, string>;
  calendar: Calendar;
  today: string;
  edit: BudgetEdit | null;
  /** The pane shows the editor: the edit started here, or the table that started it is hidden. */
  editing: boolean;
  onEdit: () => void;
  onDraft: (draft: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onMove: (by: 1 | -1) => void;
  onClose: () => void;
}) {
  const reviewRows = isCurrent ? toReview : [];
  const meta = payments.length
    ? `${payments.length} ${payments.length === 1 ? 'payment' : 'payments'}${reviewRows.length ? ` · ${reviewRows.length} to review` : ''}`
    : 'No payments yet';
  return (
    <div className="detail-body" key={line.categoryId} data-category={line.categoryId}>
      <div className="detail-top">
        <Link href="/budget" className="round-btn small phone-back" aria-label="Back" onClick={(event) => { event.preventDefault(); onClose(); }}>
          <Glyph name="chevron-left" />
        </Link>
        <span className="desk-nav desk-nav-group">
          <button type="button" className="round-btn small round-btn-key" onClick={() => onMove(-1)} aria-label="Previous category (K)" disabled={index === 0}>
            <Glyph name="chevron-up" />
            <span className="kbd kbd-inline">K</span>
          </button>
          <button type="button" className="round-btn small round-btn-key" onClick={() => onMove(1)} aria-label="Next category (J)" disabled={index === count - 1}>
            <Glyph name="chevron-down" />
            <span className="kbd kbd-inline">J</span>
          </button>
        </span>
        <span className="count num">
          <span className="desk-nav">
            {index + 1} of {count}
          </span>
        </span>
        <button type="button" className="round-btn small desk-nav" onClick={onClose} aria-label="Close (Esc)">
          <Glyph name="close" />
        </button>
      </div>
      <div className="detail-head">
        <Bubble icon={line.icon} color={line.color} size={48} glyph={26} />
        <div className="row-text">
          <h2 className="detail-name">{line.name}</h2>
          <span>{meta}</span>
        </div>
      </div>
      <div className="pane-money">
        <div className="pane-money-row">
          <span className="num hero-amount">{formatMoney(line.spentMinor, currency)}</span>
          {line.budgetMinor !== null && (
            <span className={`num pane-left tone-${line.note.tone}`}>{line.note.label}</span>
          )}
        </div>
        {line.budgetMinor !== null && (
          <span className="meter" data-tone={line.note.tone === 'over' ? 'over' : undefined} style={{ height: 8 }}>
            <span style={{ width: `${Math.round((line.note.ratio ?? 0) * 100)}%` }} />
          </span>
        )}
        <div className="field-row">
          <span className="label-text">Monthly budget · every month</span>
          {editing && edit ? (
            <BudgetEditor name={`${line.name} budget`} draft={edit.draft} at={edit.at} onDraft={onDraft} onSave={onSave} onCancel={onCancel} wide />
          ) : line.budgetMinor !== null ? (
            <button type="button" className="pill-field num" onClick={onEdit} aria-label={`${line.name} monthly budget, ${formatMoney(line.budgetMinor, currency, { whole: true })}, edit (E)`}>
              {formatMoney(line.budgetMinor, currency, { whole: true })}
              <Glyph name="pencil-outline" size={16} />
              <span className="kbd kbd-inline desk-nav">E</span>
            </button>
          ) : (
            <button type="button" className="set-btn" onClick={onEdit}>
              <Glyph name="plus" size={16} />
              Set a budget
              <span className="kbd kbd-inline desk-nav">E</span>
            </button>
          )}
        </div>
      </div>
      <div className="detail-rule">
        <span className="caps">Last {months.length} months</span>
        <HistoryChart line={line} months={months} currency={currency} />
      </div>
      <PaneRows key={month} line={line} heading={isCurrent ? 'This month' : `In ${monthShort(month)}`} reviewRows={reviewRows} payments={payments} currency={currency} walletNames={walletNames} calendar={calendar} today={today} />
    </div>
  );
}

/** The category's captures to review, then its payments, six to a page so the pane never leaves Budget. */
function PaneRows({
  line,
  heading,
  reviewRows,
  payments,
  currency,
  walletNames,
  calendar,
  today,
}: {
  line: BudgetLine;
  heading: string;
  reviewRows: readonly FinanceProposal[];
  payments: readonly FinanceTransaction[];
  currency: string;
  walletNames: Record<string, string>;
  calendar: Calendar;
  today: string;
}) {
  const [page, setPage] = useState(1);
  const rows = [...reviewRows.map((proposal) => ({ kind: 'review' as const, proposal })), ...payments.map((payment) => ({ kind: 'payment' as const, payment }))];
  const pages = Math.ceil(rows.length / PAGE);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  return (
    <>
      <div className="detail-rule pane-list-head">
        <span className="caps">{heading}</span>
        {pages > 1 && (
          <nav aria-label="Pages" className="pager">
            <button type="button" className="pg press" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <Glyph name="chevron-left" size={20} />
            </button>
            <span className="meta num" aria-current="page">
              {page} of {pages}
            </span>
            <button type="button" className="pg press" aria-label="Next page" disabled={page === pages} onClick={() => setPage(page + 1)}>
              <Glyph name="chevron-right" size={20} />
            </button>
          </nav>
        )}
      </div>
      <div className="pane-list">
        {shown.map((row) =>
          row.kind === 'review' ? (
            <Link key={row.proposal.id} href={reviewHref(row.proposal.id)} className="pane-row">
              <Bubble icon={line.icon} color={line.color} size={30} glyph={16} />
              <span className="row-text">
                <b>{row.proposal.merchant ?? row.proposal.description ?? line.name}</b>
                <span className="pane-row-meta">
                  <span className="review-count">To review</span>
                  {dayLabel(calendar.dayKey(row.proposal.transactionDate ?? row.proposal.createdAt), today)} · {row.proposal.walletId ? (walletNames[row.proposal.walletId] ?? 'no wallet') : 'no wallet'}
                </span>
              </span>
              <span className="num pane-row-amount tone-plain">{formatMoney(row.proposal.amountMinor ?? 0, currency)}</span>
            </Link>
          ) : (
            <Link key={row.payment.id} href={`/activity/${row.payment.id}`} className="pane-row">
              <Bubble icon={line.icon} color={line.color} size={30} glyph={16} />
              <span className="row-text">
                <b>{row.payment.merchant ?? row.payment.description ?? line.name}</b>
                <span>
                  {dayLabel(calendar.dayKey(row.payment.transactionDate), today)} · {walletNames[row.payment.walletId] ?? 'Wallet'}
                </span>
              </span>
              <span className="num pane-row-amount">{formatSignedMoney('expense', row.payment.amountMinor, currency)}</span>
            </Link>
          ),
        )}
        {rows.length === 0 && (
          <div className="dashed-tile">
            <Glyph name="receipt-text-outline" size={22} />
            <span>
              <b>Nothing spent on {line.name} yet</b>
              <br />
              Payments you file under {line.name} show here.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
