'use client';

import {
  dayLabel,
  formatMoney,
  formatSignedMoney,
  monthShort,
  spendingParams,
  type FinanceProposal,
  type FinanceTransaction,
} from '@repo/core';
import Link from 'next/link';
import { chartTop, type BudgetLine } from '@/lib/budget-view';
import type { Calendar } from '@repo/core';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { BudgetEditor, type BudgetEdit } from './budget-editor';

const CHART_W = 340;
const CHART_H = 150;
const AXIS = 44;
const PLOT_H = CHART_H - 4;

/** Six months of one category against its budget line; the month on show is the bold one. */
function HistoryChart({ line, months, currency }: { line: BudgetLine; months: readonly string[]; currency: string }) {
  const top = chartTop(line.months, line.budgetMinor);
  const x0 = AXIS + 8;
  const slot = (CHART_W - x0) / months.length;
  const barW = 30;
  const y = (minor: number) => PLOT_H - (PLOT_H * minor) / top;
  const over = line.note.tone === 'over';
  const lineY = line.budgetMinor ? Math.max(22, Math.min(PLOT_H, y(line.budgetMinor))) : null;
  const last = months.length - 1;
  const spent = line.months[last] ?? 0;
  return (
    <div className="history">
      <div
        className="history-plot"
        role="img"
        aria-label={`${line.name} spending by month: ${months.map((month, index) => `${monthShort(month)} ${formatMoney(line.months[index] ?? 0, currency)}`).join(', ')}`}
        style={{ width: CHART_W, height: CHART_H }}
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
        {spent > 0 && (
          <span className="num history-value" style={{ left: x0 + slot * last + slot / 2 - 40, top: y(spent) - 20 }}>
            <span>{formatMoney(spent, currency)}</span>
          </span>
        )}
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
  const shown = 6;
  const reviewRows = isCurrent ? toReview.slice(0, shown) : [];
  const paymentRows = payments.slice(0, Math.max(0, shown - reviewRows.length));
  const meta = payments.length
    ? `${payments.length} ${payments.length === 1 ? 'payment' : 'payments'}${reviewRows.length ? ` · ${reviewRows.length} to review` : ''}`
    : 'No payments yet';
  const activityHref = `/activity?${new URLSearchParams(spendingParams({ kind: 'category', categoryId: line.categoryId }, month) as Record<string, string>)}`;
  return (
    <div className="detail-body" key={line.categoryId} data-category={line.categoryId}>
      <div className="detail-top">
        <Link href="/budget" className="round-btn small phone-back" aria-label="Back" onClick={(event) => { event.preventDefault(); onClose(); }}>
          <Glyph name="chevron-left" />
        </Link>
        <span className="desk-nav desk-nav-group">
          <button type="button" className="round-btn small" onClick={() => onMove(-1)} aria-label="Previous category (K)" disabled={index === 0}>
            <Glyph name="chevron-up" />
          </button>
          <button type="button" className="round-btn small" onClick={() => onMove(1)} aria-label="Next category (J)" disabled={index === count - 1}>
            <Glyph name="chevron-down" />
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
            <button type="button" className="pill-field num" onClick={onEdit} aria-label={`${line.name} monthly budget, ${formatMoney(line.budgetMinor, currency, { whole: true })}, edit`}>
              {formatMoney(line.budgetMinor, currency, { whole: true })}
              <Glyph name="pencil-outline" size={16} />
            </button>
          ) : (
            <button type="button" className="set-btn" onClick={onEdit}>
              <Glyph name="plus" size={16} />
              Set a budget
            </button>
          )}
        </div>
      </div>
      <div className="detail-rule">
        <span className="caps">Last {months.length} months</span>
        <HistoryChart line={line} months={months} currency={currency} />
      </div>
      <div className="detail-rule pane-list-head">
        <span className="caps">{isCurrent ? 'This month' : `In ${monthShort(month)}`}</span>
        {payments.length > 0 && (
          <Link href={activityHref} className="link see-all">
            See all {payments.length} in Activity
            <Glyph name="chevron-right" size={18} />
          </Link>
        )}
      </div>
      <div className="pane-list">
        {reviewRows.map((proposal) => (
          <Link key={proposal.id} href="/review" className="pane-row">
            <Bubble icon={line.icon} color={line.color} size={30} glyph={16} />
            <span className="row-text">
              <b>{proposal.merchant ?? proposal.description ?? line.name}</b>
              <span className="pane-row-meta">
                <span className="review-count">To review</span>
                {dayLabel(calendar.dayKey(proposal.transactionDate ?? proposal.createdAt), today)} · {proposal.walletId ? (walletNames[proposal.walletId] ?? 'no wallet') : 'no wallet'}
              </span>
            </span>
            <span className="num pane-row-amount tone-plain">{formatMoney(proposal.amountMinor ?? 0, currency)}</span>
          </Link>
        ))}
        {paymentRows.map((payment) => (
          <Link key={payment.id} href={activityHref} className="pane-row">
            <Bubble icon={line.icon} color={line.color} size={30} glyph={16} />
            <span className="row-text">
              <b>{payment.merchant ?? payment.description ?? line.name}</b>
              <span>
                {dayLabel(calendar.dayKey(payment.transactionDate), today)} · {walletNames[payment.walletId] ?? 'Wallet'}
              </span>
            </span>
            <span className="num pane-row-amount">{formatSignedMoney('expense', payment.amountMinor, currency)}</span>
          </Link>
        ))}
        {payments.length === 0 && reviewRows.length === 0 && (
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
    </div>
  );
}
