'use client';

import { dateLabel, dueWhen, formatMoney, spendByWeek, type AnswerCard } from '@repo/core';
import { legacyColor } from '@repo/types';
import Link from 'next/link';
import { useState, type PointerEvent } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import type { ChatMessage } from '@/lib/chat-thread';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { reviewHref } from '@/lib/review-view';

type CardMessage = Extract<ChatMessage, { kind: 'card' }>;
type LedgerCard = Exclude<AnswerCard, { kind: 'captures' }>;

/** The phone's card title, shown when the model gave no caption. */
function titleFor(card: LedgerCard, categoryName: string, currency: string, today: string): string {
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  switch (card.kind) {
    case 'category_spend':
      if (card.budget === null) return `${whole(card.spent)} on ${categoryName} this month`;
      return card.spent > card.budget
        ? `${whole(card.spent)} on ${categoryName}, ${whole(card.spent - card.budget)} over`
        : `${whole(card.spent)} on ${categoryName}, ${whole(card.budget - card.spent)} left`;
    case 'budget_progress':
      return card.left < 0
        ? `${whole(-card.left)} over this month`
        : `${whole(card.left)} left for ${card.daysLeft} ${card.daysLeft === 1 ? 'day' : 'days'}`;
    case 'bill_due':
      return `${card.name} takes ${formatMoney(card.amount, currency)} ${dueWhen(card.dueDate, today)}`;
  }
}

/**
 * The month so far by week, against a week of even pace (W2-Chat's "FOOD & DINING BY WEEK"): the bars
 * grow in, and a tooltip follows the pointer.
 */
function WeekChart({ card, ledger, today }: { card: Extract<LedgerCard, { kind: 'category_spend' | 'budget_progress' }>; ledger: Ledger; today: string }) {
  const categoryId = card.kind === 'category_spend' ? card.categoryId : null;
  const category = categoryId ? ledger.projection.categoriesById[categoryId] : undefined;
  const { weeks, paceMinor } = spendByWeek({
    transactions: ledger.transactions,
    currency: ledger.currency,
    categoryId,
    budgetMinor: card.budget,
    today,
    calendar: ledger.calendar,
  });
  const [tip, setTip] = useState<{ x: number; y: number; index: number } | null>(null);
  const top = Math.max(paceMinor ?? 0, ...weeks.map((week) => week.spentMinor), 1) * 1.15;
  const pct = (minor: number) => `${(minor / top) * 100}%`;
  const fill = category?.color ? legacyColor(category.color) : undefined;
  const name = category?.name ?? 'This month';
  const point = (event: PointerEvent<HTMLDivElement>, index: number) => {
    const box = event.currentTarget.closest('.week-plot')!.getBoundingClientRect();
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, index });
  };
  const shown = tip ? weeks[tip.index] : undefined;
  return (
    <div className="week-card">
      <span className="caps">{category ? `${name} by week` : 'This month by week'}</span>
      <div
        className="week-plot"
        role="img"
        aria-label={`${name} by week: ${weeks.map((week) => `${week.label} ${formatMoney(week.spentMinor, ledger.currency)}`).join(', ')}${
          paceMinor === null ? '' : `, against an even pace of ${formatMoney(paceMinor, ledger.currency, { whole: true })} a week`
        }.`}
        onPointerLeave={() => setTip(null)}
      >
        <div className="week-area">
          {weeks.map((week, index) => (
            <div key={week.from} className="week-col" onPointerMove={(event) => point(event, index)} onPointerEnter={(event) => point(event, index)}>
              <span className="week-value num" style={{ bottom: `calc(${pct(week.spentMinor)} + 4px)` }}>
                {formatMoney(week.spentMinor, ledger.currency)}
              </span>
              <span className="week-bar" data-week={week.label} style={{ height: pct(week.spentMinor), background: fill, animationDelay: `${index * 60}ms` }} />
            </div>
          ))}
          {paceMinor !== null && (
            <span className="week-pace" style={{ bottom: pct(paceMinor) }}>
              <span className="week-pace-label num">Even pace {formatMoney(paceMinor, ledger.currency, { whole: true })}</span>
            </span>
          )}
        </div>
        <div className="week-labels">
          {weeks.map((week) => (
            <span key={week.from}>{week.label}</span>
          ))}
        </div>
        {tip && shown && (
          <span className="chart-tip week-tip num" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
            <b>{shown.label}</b> {formatMoney(shown.spentMinor, ledger.currency)}
          </span>
        )}
      </div>
    </div>
  );
}

/** The bills still due this month from the asked one on, soonest first, the asked one marked. */
function BillList({ card, ledger, today }: { card: Extract<LedgerCard, { kind: 'bill_due' }>; ledger: Ledger; today: string }) {
  const ahead = card.ahead?.length ? card.ahead : [{ name: card.name, amount: card.amount, dueDate: card.dueDate }];
  return (
    <div className="week-card">
      <span className="caps">Bills left this month</span>
      <ul className="bill-lines">
        {ahead.map((bill) => (
          <li key={`${bill.name}-${bill.dueDate}`} className="bill-line" data-asked={(bill.name === card.name && bill.dueDate === card.dueDate) || undefined}>
            <span className="bill-name">{bill.name}</span>
            <span className="meta">{dateLabel(bill.dueDate, today)}</span>
            <span className="num bill-amount">{formatMoney(bill.amount, ledger.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A Moni answer: the ledger's numbers, the model's reply as its caption (the phone's `answer`). */
export function AnswerCardView({ message, ledger }: { message: CardMessage; ledger: Ledger }) {
  const { card } = message;
  const today = ledger.calendar.dayKey(message.at);
  if (card.kind === 'captures') {
    const count = card.proposalIds.length;
    return (
      <div className="chat-card answer-card">
        <p className="answer-caption">
          {count ? `${count} ${count === 1 ? 'capture is' : 'captures are'} waiting for review.` : 'Nothing is waiting for review.'}
        </p>
        {count > 0 && (
          <Link href={reviewHref()} className="answer-link press">
            <Glyph name="tray-full" size={18} />
            Open Review
          </Link>
        )}
      </div>
    );
  }
  const category = card.kind === 'category_spend' ? ledger.projection.categoriesById[card.categoryId] : undefined;
  const caption = message.caption || titleFor(card, category?.name ?? 'this category', ledger.currency, today);
  return (
    <div className="chat-card answer-card" aria-label={`Moni's answer. ${caption}`}>
      {card.kind === 'bill_due' ? <BillList card={card} ledger={ledger} today={today} /> : <WeekChart card={card} ledger={ledger} today={today} />}
      <p className="answer-caption">{caption}</p>
      <Link href={card.kind === 'category_spend' ? `/budget?category=${card.categoryId}&pane=chat` : '/budget?pane=chat'} className="answer-link press">
        <Glyph name="chart-box" size={18} />
        {category ? `${category.name} in Budget` : 'Open Budget'}
      </Link>
    </div>
  );
}
