'use client';

import {
  addDays,
  calendarHeat,
  daysBetween,
  dayOfMonth,
  firstDayOf,
  formatMoney,
  lastDayOf,
  monthName,
  monthShort,
  parseDayKey,
  planCategoryBudgets,
  budgetsFromSpending,
  setAsideLabel,
  shiftMonth,
  weekday,
  type BudgetInput,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { useState, type ReactNode } from 'react';
import { Cat } from '@/components/brand';
import { SidePane } from '@/components/ledger/side-pane';
import { Page } from '@/components/shell/page';
import { showToast } from '@/components/shell/shell-store';
import { useLayout } from '@/components/shell/use-layout';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { useQueryParams } from '@/components/ledger/use-query-param';
import { useScreenKeys } from '@/lib/screen-keys';
import { parseBudgetDraft, type BudgetLine } from '@/lib/budget-view';
import { applyPlan, budgetRowsNow, commit, planContext } from '@/lib/ledger/commit';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { BudgetEditor, type BudgetEdit } from './budget-editor';
import { CategoryPane } from './category-pane';
import { SpendRing } from './spend-ring';
import { useBudget, type BudgetData } from './use-budget';
import '@/components/ledger/ledger.css';
import '@/components/ledger/table-pane.css';
import './budget.css';

export function BudgetScreen() {
  const ledger = useLedger();
  if (!ledger.loaded) {
    return (
      <Page title="Budget" phone="tab">
        <div className="ledger" aria-busy="true">
          <div className="ledger-main">
            <div className="card skeleton" style={{ height: 236 }} />
            <div className="card skeleton" style={{ height: 420 }} />
          </div>
        </div>
      </Page>
    );
  }
  return <BudgetLoaded ledger={ledger} />;
}

function wholeText(minor: number | null): string {
  return minor ? String(Math.floor(minor / 100)) : '';
}

function BudgetLoaded({ ledger }: { ledger: Ledger }) {
  const layout = useLayout();
  const [params, setParams] = useQueryParams();
  const [setup, setSetup] = useState(false);
  const data = useBudget(ledger, params.get('month'), setup);
  const view = params.get('view') === 'calendar' ? 'calendar' : 'month';
  const [edit, setEdit] = useState<BudgetEdit | null>(null);
  const { money, table, month, current, history } = data;
  const currency = ledger.currency;
  const lines = [...table.budgeted, ...table.unbudgeted];
  const selectedId = params.get('category');
  const selected = lines.find((line) => line.categoryId === selectedId) ?? null;
  const index = selected ? lines.indexOf(selected) : -1;
  const editable = month === current;
  const showTable = data.hasBudgets || setup;

  const select = (categoryId: string | null) => {
    if (edit && edit.categoryId !== categoryId) setEdit(null);
    setParams({ category: categoryId });
  };
  const move = (by: 1 | -1) => {
    if (!lines.length) return;
    const next = index < 0 ? (by === 1 ? 0 : lines.length - 1) : Math.min(lines.length - 1, Math.max(0, index + by));
    select(lines[next]!.categoryId);
  };
  const startEdit = (line: BudgetLine, at: BudgetEdit['at']) => {
    if (!editable) return;
    setEdit({ categoryId: line.categoryId, at, draft: wholeText(line.budgetMinor) });
    if (selectedId !== line.categoryId) setParams({ category: line.categoryId });
  };

  const writeBudgets = (inputs: BudgetInput[], text: string) => {
    const before: BudgetInput[] = inputs.map((input) => ({
      ...input,
      amountMinor: lines.find((line) => line.categoryId === input.categoryId)?.budgetMinor ?? null,
    }));
    const saved = commit(planCategoryBudgets(ledger.budgetRows, inputs, planContext(ledger.userId)), text, () =>
      applyPlan(planCategoryBudgets(budgetRowsNow(), before, planContext(ledger.userId))),
    );
    return saved !== null;
  };

  const save = () => {
    if (!edit) return;
    const amountMinor = parseBudgetDraft(edit.draft);
    const line = lines.find((item) => item.categoryId === edit.categoryId);
    if (amountMinor === undefined || !line) {
      showToast({ text: 'Type a whole amount, like 120', tone: 'error' });
      return;
    }
    if (amountMinor === line.budgetMinor) {
      setEdit(null);
      return;
    }
    const text =
      amountMinor === null
        ? `${line.name} budget cleared`
        : `${line.name} budget saved: ${formatMoney(amountMinor, currency, { whole: true })}`;
    if (writeBudgets([{ categoryId: line.categoryId, currency, amountMinor }], text)) setEdit(null);
  };

  const lastMonth = shiftMonth(month, -1);
  const copyLastMonth = () => {
    const spent = new Map<string, MinorAmount>();
    for (const [categoryId, row] of history.byCategory) {
      if (categoryId && data.ledger.categories.some((category) => category.id === categoryId)) {
        spent.set(categoryId, row[row.length - 2] ?? (0 as MinorAmount));
      }
    }
    const inputs = budgetsFromSpending(spent, currency);
    if (!inputs.length) {
      showToast({ text: `Nothing was spent in ${monthName(lastMonth)}`, tone: 'error' });
      return;
    }
    setSetup(false);
    writeBudgets(inputs, `Budgets set from ${monthName(lastMonth)}'s spending`);
  };

  useScreenKeys((key) => {
    switch (key) {
      case 'j':
        move(1);
        return true;
      case 'k':
        move(-1);
        return true;
      case 'e': {
        if (!showTable) {
          setSetup(true);
          return true;
        }
        const line = selected ?? lines[0];
        if (line) startEdit(line, layout === 'phone' ? 'pane' : 'table');
        return true;
      }
      case 'Escape':
        if (edit) setEdit(null);
        else if (selectedId) select(null);
        else return false;
        return true;
      default:
        return false;
    }
  });

  const setMonth = (next: string) => {
    setEdit(null);
    setParams({ month: next === current ? null : next });
  };
  const monthNav = (
    <div className="month-nav">
      <button type="button" className="round-btn" aria-label={monthName(shiftMonth(month, -1))} onClick={() => setMonth(shiftMonth(month, -1))}>
        <Glyph name="chevron-left" />
      </button>
      <label className="chip">
        <span className="sr-only">Month</span>
        <select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Month">
          {[...new Set([month, ...data.months.map((item) => item.month)])]
            .sort((a, b) => b.localeCompare(a))
            .map((key) => (
              <option key={key} value={key}>
                {monthName(key)} {key.slice(0, 4)}
              </option>
            ))}
        </select>
        <Glyph name="chevron-down" size={18} />
      </label>
      <button
        type="button"
        className="round-btn"
        aria-label={monthName(shiftMonth(month, 1))}
        disabled={month >= current}
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <Glyph name="chevron-right" />
      </button>
    </div>
  );
  const viewSwitch = (
    <div className="seg-tabs" role="radiogroup" aria-label="Budget view">
      {(['month', 'calendar'] as const).map((value) => (
        <button key={value} type="button" role="radio" aria-checked={view === value} onClick={() => setParams({ view: value === 'month' ? null : value })}>
          {value === 'month' ? 'Month' : 'Calendar'}
        </button>
      ))}
    </div>
  );

  const paneEditing = Boolean(edit && selected && edit.categoryId === selected.categoryId && (edit.at === 'pane' || layout === 'phone'));
  const payments = selected ? data.monthSpend(selected.categoryId) : [];
  const toReview = selected ? data.toReview.filter((proposal) => proposal.categoryId === selected.categoryId) : [];

  return (
    <Page
      title="Budget"
      phone="tab"
      actions={
        <>
          {monthNav}
          {viewSwitch}
        </>
      }
    >
      <div className="ledger" data-screen="budget">
        <div className="ledger-main">
          <div className="phone-controls" data-only="phone">
            {viewSwitch}
            {monthNav}
          </div>
          <div className="budget-top">
            <RingCard data={data} currency={currency} onPick={(id) => select(id)} />
            {view === 'month' && money.isCurrent && <BillsCard data={data} ledger={ledger} />}
          </div>
          {view === 'calendar' ? (
            <CalendarCard data={data} ledger={ledger} />
          ) : (
            <>
              <BudgetRings lines={lines} currency={currency} selectedId={selectedId} onPick={select} show={showTable} />
              {!showTable && (
                <section className="card budgets-empty-card" aria-label="Budgets" data-only="phone">
                  <NoBudgets data={data} currency={currency} onStart={() => setSetup(true)} />
                </section>
              )}
              <section className="card budgets-card" aria-label="Budgets" data-only="sidebar rail rail-one-column">
                <div className="card-head">
                  <h2 className="card-title">Budgets</h2>
                  {showTable && (
                    <>
                      <span className="hint-keys">
                        <span className="kbd">J</span>
                        <span className="kbd">K</span>
                        move · <span className="kbd">E</span>edit budget
                      </span>
                      {editable && (
                        <button type="button" className="btn btn-out press copy-btn" onClick={copyLastMonth}>
                          <Glyph name="content-copy" size={18} />
                          Copy {monthName(lastMonth)}&apos;s spending
                        </button>
                      )}
                    </>
                  )}
                </div>
                {showTable ? (
                  <BudgetGrid
                    data={data}
                    currency={currency}
                    selectedId={selectedId}
                    edit={edit}
                    editable={editable}
                    onPick={select}
                    onEdit={(line) => startEdit(line, 'table')}
                    onDraft={(draft) => setEdit((current) => current && { ...current, draft })}
                    onSave={save}
                    onCancel={() => setEdit(null)}
                  />
                ) : (
                  <NoBudgets data={data} currency={currency} onStart={() => setSetup(true)} />
                )}
              </section>
            </>
          )}
        </div>
        <SidePane label="Category" open={Boolean(selected)} idle onClose={() => select(null)}>
          {selected ? (
            <CategoryPane
              line={selected}
              index={index}
              count={lines.length}
              month={month}
              months={history.months}
              currency={currency}
              isCurrent={money.isCurrent}
              payments={payments}
              toReview={toReview}
              walletNames={data.walletNames}
              calendar={ledger.calendar}
              today={ledger.calendar.dayKey(ledger.now)}
              edit={edit}
              editing={paneEditing}
              onEdit={() => startEdit(selected, 'pane')}
              onDraft={(draft) => setEdit((current) => current && { ...current, draft })}
              onSave={save}
              onCancel={() => setEdit(null)}
              onMove={move}
              onClose={() => select(null)}
            />
          ) : (
            <div className="detail-empty">
              <Glyph name="gesture-tap" size={32} />
              <span>Pick a category to see its months, its payments and its budget.</span>
            </div>
          )}
        </SidePane>
      </div>
    </Page>
  );
}

function RingCard({ data, currency, onPick }: { data: BudgetData; currency: string; onPick: (categoryId: string) => void }) {
  const { money } = data;
  const left = money.left;
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  let headline: ReactNode;
  let sub: string | null = null;
  let perDay: ReactNode = null;
  if (left) {
    const after = setAsideLabel(left, currency);
    const days = `${left.daysLeft} ${left.daysLeft === 1 ? 'day' : 'days'}`;
    if (left.leftMinor < 0) {
      headline = `${whole(-left.leftMinor)} over`;
      sub = after ? `${after.charAt(0).toUpperCase()}${after.slice(1)}` : null;
    } else {
      headline = `${whole(left.leftMinor)} left`;
      sub = `for ${days}${after ? ` ${after}` : ''}`;
      perDay = (
        <>
          <span className="ring-rule" aria-hidden="true" />
          <span className="num ring-perday">{whole(left.perDayMinor)} a day</span>
          <span className="ring-sub">safe to spend a day</span>
        </>
      );
    }
  } else if (money.budgetMinor !== null) {
    const under = money.budgetMinor - money.spentMinor;
    headline = under >= 0 ? `${whole(under)} under` : `${whole(-under)} over`;
    sub = `the ${whole(money.budgetMinor)} budget`;
  } else {
    headline = formatMoney(money.spentMinor, currency);
    sub = 'spent';
  }
  return (
    <section className="card ring-card" aria-label={`Spent in ${monthName(money.month)}`}>
      <SpendRing slices={data.slices} spentMinor={money.spentMinor} budgetMinor={money.budgetMinor} currency={currency} month={money.month} onPick={onPick} />
      <div className="ring-words">
        <span className="caps">Spent in {monthName(money.month)}</span>
        <span className="num ring-headline" data-testid="budget-left">
          {headline}
        </span>
        {sub && <span className="ring-sub">{sub}</span>}
        {perDay}
      </div>
    </section>
  );
}

function dueLabel(dueDate: string, today: string): { text: string; tone: 'late' | 'soon' | 'plain' } {
  const days = daysBetween(today, parseDayKey(dueDate) ?? today);
  if (days < 0) return { text: 'Overdue', tone: 'late' };
  if (days === 0) return { text: 'Today', tone: 'soon' };
  if (days === 1) return { text: 'Tomorrow', tone: 'soon' };
  return { text: `${days} days left`, tone: 'plain' };
}

function BillsCard({ data, ledger }: { data: BudgetData; ledger: Ledger }) {
  const bills = data.money.billsDue;
  const today = ledger.calendar.dayKey(ledger.now);
  const total = bills.reduce((sum, bill) => sum + Number(bill.amountMinor), 0);
  const end = lastDayOf(data.month);
  return (
    <section className="card bills-card" aria-label="Bills">
      <div className="card-head">
        <h2 className="card-title">Bills</h2>
        {bills.length > 0 && (
          <span className="num meta" data-testid="bills-total">
            {formatMoney(total, ledger.currency)} due by {dayOfMonth(end)} {monthShort(data.month)}
          </span>
        )}
      </div>
      {bills.length === 0 ? (
        <p className="meta bills-none">No bills left to pay this month.</p>
      ) : (
        <ul className="bills-list">
          {bills.map((bill) => {
            const look = data.billLook(bill.seriesKey);
            const due = dueLabel(bill.dueDate, today);
            return (
              <li key={bill.seriesKey} className="bill-row" data-bill={bill.seriesKey}>
                <Bubble icon={look.icon ?? 'repeat'} color={look.color} size={30} glyph={16} />
                <b>{bill.name}</b>
                <span className="bill-meta">
                  <span data-tone={due.tone}>{due.text}</span>
                  {look.wallet ? ` · ${look.wallet}` : ''}
                </span>
                <span className="num bill-amount">{formatMoney(bill.amountMinor, bill.currency)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const GRID_LABEL = ['Category', 'Spent', 'Budget', 'Left', '', 'Last month', '3-month avg', ''];

function BudgetGrid({
  data,
  currency,
  selectedId,
  edit,
  editable,
  onPick,
  onEdit,
  onDraft,
  onSave,
  onCancel,
}: {
  data: BudgetData;
  currency: string;
  selectedId: string | null;
  edit: BudgetEdit | null;
  editable: boolean;
  onPick: (categoryId: string) => void;
  onEdit: (line: BudgetLine) => void;
  onDraft: (draft: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { table } = data;
  const money = (minor: number) => formatMoney(minor, currency);
  const row = (line: BudgetLine) => {
    const editing = edit?.categoryId === line.categoryId && edit.at === 'table';
    return (
      <div
        key={line.categoryId}
        className="grid-row budget-row"
        role="row"
        tabIndex={-1}
        data-category={line.categoryId}
        data-budgeted={line.budgetMinor !== null}
        aria-selected={selectedId === line.categoryId}
        onClick={() => onPick(line.categoryId)}
      >
        <span role="rowheader" className="row-name">
          <Bubble icon={line.icon} color={line.color} size={28} glyph={15} />
          <b>{line.name}</b>
        </span>
        <span role="gridcell" className="num" data-col="spent">
          {money(line.spentMinor)}
        </span>
        <span role="gridcell" className="budget-cell" data-col="budget">
          {editing && edit ? (
            <BudgetEditor name={line.name} edit={edit} onDraft={onDraft} onSave={onSave} onCancel={onCancel} />
          ) : line.budgetMinor !== null ? (
            <button
              type="button"
              className="bcell num"
              disabled={!editable}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(line);
              }}
              aria-label={`${line.name} budget, ${formatMoney(line.budgetMinor, currency, { whole: true })}, edit`}
            >
              {formatMoney(line.budgetMinor, currency, { whole: true })}
            </button>
          ) : editable ? (
            <button
              type="button"
              className="set-btn"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(line);
              }}
              aria-label={`Set a budget for ${line.name}`}
            >
              <Glyph name="plus" size={16} />
              Set
            </button>
          ) : null}
        </span>
        <span role="gridcell" className={`num left-cell tone-${line.note.tone}`} data-col="left">
          {line.budgetMinor !== null ? line.note.label : ''}
        </span>
        <span role="gridcell" className="bar-cell" data-col="bar">
          {line.budgetMinor !== null && (
            <span className="meter" data-tone={line.note.tone === 'over' ? 'over' : undefined}>
              <span style={{ width: `${Math.round((line.note.ratio ?? 0) * 100)}%` }} />
            </span>
          )}
        </span>
        <span role="gridcell" className="num past-cell" data-col="last">
          {money(line.lastMonthMinor)}
        </span>
        <span role="gridcell" className="num past-cell" data-col="avg">
          {line.averageMinor === null ? '' : money(line.averageMinor)}
        </span>
        <button
          type="button"
          className="row-more"
          aria-label={`${line.name}, open`}
          onClick={(event) => {
            event.stopPropagation();
            onPick(line.categoryId);
          }}
        >
          <Glyph name="dots-horizontal" />
        </button>
      </div>
    );
  };
  return (
    <div className="budget-grid" role="grid" aria-label={`Budgets by category, ${monthName(data.month)}`}>
      <div className="grid-head budget-row" role="row">
        {GRID_LABEL.map((label, index) => (
          <span key={index} role="columnheader" className="caps" data-col={['name', 'spent', 'budget', 'left', 'bar', 'last', 'avg', 'more'][index]}>
            {label}
          </span>
        ))}
      </div>
      {table.budgeted.map(row)}
      {table.unbudgeted.length > 0 && (
        <div role="row" className="grid-section">
          <span className="caps">No budget yet</span>
        </div>
      )}
      {table.unbudgeted.map(row)}
      <div className="grid-total budget-row" role="row" data-testid="budget-total">
        <span className="row-text">
          <b>Total</b>
          <span className="num">{formatMoney(table.inCategoriesMinor, currency, { whole: true })} of it in categories</span>
        </span>
        <span className="num" data-col="spent">
          {money(table.spentMinor)}
        </span>
        <span className="num" data-col="budget">
          {table.budgetMinor === null ? '' : formatMoney(table.budgetMinor, currency, { whole: true })}
        </span>
        <span data-col="left" />
        <span data-col="bar" />
        <span className="num past-cell" data-col="last">
          {money(table.lastMonthMinor)}
        </span>
        <span className="num past-cell" data-col="avg">
          {table.averageMinor === null ? '' : money(table.averageMinor)}
        </span>
        <span />
      </div>
    </div>
  );
}

function NoBudgets({ data, currency, onStart }: { data: BudgetData; currency: string; onStart: () => void }) {
  const past = data.months.filter((item) => item.month < data.month).slice(0, 3);
  const line =
    past.length === 3
      ? `You spent about ${formatMoney(past.reduce((sum, item) => sum + item.spentMinor, 0) / 3, currency, { whole: true })} a month from ${monthName(past[2]!.month)} to ${monthName(past[0]!.month)}. Set budgets and Moni starts each category from there.`
      : 'Set budgets and Moni starts each category from what you spend.';
  return (
    <div className="budgets-empty empty">
      <Cat mood="thinking" size={72} id="budget-empty" />
      <h3 className="empty-title">No budgets yet</h3>
      <p className="empty-line">{line}</p>
      <button type="button" className="btn btn-ink press" onClick={onStart}>
        <Glyph name="plus" />
        Set budgets
        <span className="kbd kbd-on-ink" data-only="sidebar rail rail-one-column">
          E
        </span>
      </button>
    </div>
  );
}

/** The phone layout's budget rings (the mobile Budget tab): one ring per category, a tap opens its page. */
function BudgetRings({
  lines,
  currency,
  selectedId,
  onPick,
  show,
}: {
  lines: readonly BudgetLine[];
  currency: string;
  selectedId: string | null;
  onPick: (categoryId: string) => void;
  show: boolean;
}) {
  if (!lines.length) return null;
  return (
    <section className="rings" aria-label="Budgets" data-only="phone">
      <h2 className="card-title">{show ? 'Budgets' : 'By category'}</h2>
      <div className="rings-grid">
        {lines.map((line) => {
          const ratio = line.note.ratio ?? 0;
          const r = 26;
          const length = 2 * Math.PI * r;
          return (
            <button key={line.categoryId} type="button" className="ring-tile press" aria-pressed={selectedId === line.categoryId} onClick={() => onPick(line.categoryId)}>
              <span className="ring-tile-art">
                <svg width={64} height={64} viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx={32} cy={32} r={r} fill="none" stroke="var(--color-sand)" strokeWidth={7} />
                  {line.budgetMinor !== null && ratio > 0 && (
                    <circle
                      cx={32}
                      cy={32}
                      r={r}
                      fill="none"
                      stroke={line.note.tone === 'over' ? 'var(--color-coral)' : (line.color ?? 'var(--color-ink-2)')}
                      strokeWidth={7}
                      strokeLinecap="round"
                      strokeDasharray={`${length * ratio} ${length}`}
                      transform="rotate(-90 32 32)"
                    />
                  )}
                </svg>
                <span className="ring-tile-glyph">
                  <Bubble icon={line.icon} color={line.color} size={34} glyph={19} />
                </span>
              </span>
              <b>{line.name}</b>
              <span className={`num tone-${line.note.tone}`}>{line.budgetMinor !== null ? line.note.label : formatMoney(line.spentMinor, currency)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Calendar view: each day's spending against even pace, with the days a bill is due marked. */
function CalendarCard({ data, ledger }: { data: BudgetData; ledger: Ledger }) {
  const { money } = data;
  const dueDays = new Set(money.billsDue.map((bill) => bill.dueDate));
  const first = firstDayOf(data.month);
  const heat = calendarHeat(
    money.daily.map((spent, index) => ({
      day: index + 1,
      spentMinor: index < money.throughDay ? spent : null,
      billDue: dueDays.has(addDays(first, index)),
    })),
    money.evenPaceMinor,
  );
  const lead = (weekday(first) + 6) % 7;
  return (
    <section className="card calendar-card" aria-label={`${monthName(data.month)} by day`}>
      <div className="card-head">
        <h2 className="card-title">{monthName(data.month)} by day</h2>
        {money.evenPaceMinor !== null && (
          <span className="num meta">Even pace {formatMoney(money.evenPaceMinor, ledger.currency, { whole: true })}</span>
        )}
      </div>
      <div className="calendar-grid" role="grid">
        {WEEK.map((day) => (
          <span key={day} className="caps calendar-dow" role="columnheader">
            {day}
          </span>
        ))}
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} />
        ))}
        {heat.map((day) => (
          <span key={day.day} className="calendar-day" role="gridcell" data-heat={day.bucket} data-bill={day.billDue || undefined}>
            <span className="calendar-date">{day.day}</span>
            {day.spentMinor !== null && day.spentMinor > 0 && (
              <span className="num calendar-spent">{formatMoney(day.spentMinor, ledger.currency, { whole: true })}</span>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}
