'use client';

import {
  dayHeading,
  firstDayOf,
  formatMoney,
  planTransactionEdit,
  planTransactionsDelete,
  planTransactionsEdit,
} from '@repo/core';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { Page } from '@/components/shell/page';
import { useShellApi } from '@/components/shell/shell-context';
import { setShell, useShell } from '@/components/shell/shell-store';
import { useDraftMarks } from '@/components/chat/draft-marks';
import { activityItems, type ActivityEntry } from '@/lib/activity-items';
import {
  BUILT_IN_VIEWS,
  NO_FILTERS,
  activityCsv,
  activityQueryString,
  checkReason,
  filtersOf,
  nextSort,
  noMatchLine,
  pageOf,
  parseActivityQuery,
  parseSavedViews,
  selectActivity,
  type ActivityFilters,
  type ActivityQuery,
  type SavedView,
  type SortKey,
} from '@/lib/activity-query';
import { commit, planContext } from '@/lib/ledger/commit';
import { SOURCE_ICONS, SOURCE_LABELS, rowAmount } from '@/lib/ledger/format';
import { useLedger } from '@/lib/ledger/use-ledger';
import { reviewHref } from '@/lib/review-view';
import { useScreenKeys } from '@/lib/screen-keys';
import { ResizeHandle } from '@/components/ledger/resize-handle';
import { SidePane } from '@/components/ledger/side-pane';
import { COLUMN_SPANS, parseColumnWidths, type ColumnWidths, type ResizableColumn } from '@/lib/sizes';
import { ConfirmDelete } from './confirm-delete';
import { DetailPane } from './detail-pane';
import { FilterBar } from './filters';
import { RunningCard } from './running-card';
import './activity.css';

const VIEWS_KEY = 'moni-activity-views';
const COLUMNS_KEY = 'moni-activity-columns';
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'category', label: 'Category' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'source', label: 'Source' },
  { key: 'amount', label: 'Amount' },
];
const PHONE_KINDS = [
  { kind: 'all', label: 'All' },
  { kind: 'expense', label: 'Expenses' },
  { kind: 'income', label: 'Income' },
  { kind: 'transfer', label: 'Transfers' },
] as const;

type Shown = ActivityEntry;
type Menu = { id: string; x: number; y: number };
type CellEdit = { id: string; text: string };

function readViews(): SavedView[] {
  try {
    return parseSavedViews(window.localStorage.getItem(VIEWS_KEY));
  } catch {
    return [];
  }
}

function readColumns(): ColumnWidths {
  try {
    return parseColumnWidths(window.localStorage.getItem(COLUMNS_KEY));
  } catch {
    return {};
  }
}

function writeColumns(widths: ColumnWidths) {
  try {
    window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(widths));
  } catch {
    // Without storage the widths last until the tab closes.
  }
}

/** The table's dragged column widths as the CSS its grid reads; an untouched column keeps the board's. */
function columnStyle(widths: ColumnWidths): CSSProperties {
  return Object.fromEntries(Object.entries(widths).map(([key, width]) => [`--col-${key}`, `${width}px`])) as CSSProperties;
}

function writeViews(views: SavedView[]) {
  try {
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Without storage a saved view lasts until the tab closes.
  }
}

/**
 * W2-Activity: the running chart, saved views, filters, the table (or the grouped list) with sortable
 * columns, ticks and the Ink bulk bar, a category edited in its cell, menus on right-click and ⋯, 25 rows
 * a page and the docked detail pane. The view lives in the URL; the open row is the path (/activity/<id>).
 */
export function ActivityScreen() {
  const ledger = useLedger();
  const { pane, run } = useShellApi();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { id: openId } = useParams<{ id?: string }>();
  const query = useMemo(() => parseActivityQuery(new URLSearchParams(params.toString())), [params]);
  const items = useMemo(() => activityItems(ledger), [ledger]);
  const [views, setViews] = useState<SavedView[]>([]);
  const { ticked: tickedIds } = useShell();
  const drafted = useDraftMarks();
  const selected: ReadonlySet<string> = useMemo(() => new Set(tickedIds), [tickedIds]);
  const setSelected = (next: ReadonlySet<string> | ((current: ReadonlySet<string>) => ReadonlySet<string>)) =>
    setShell((shell) => ({ ticked: [...(typeof next === 'function' ? next(new Set(shell.ticked)) : next)] }));
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cell, setCell] = useState<CellEdit | null>(null);
  const [bulkOpen, setBulkOpen] = useState<'category' | 'wallet' | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnWidths>({});
  useEffect(() => setViews(readViews()), []);
  useEffect(() => setColumns(readColumns()), []);
  const resizeColumn = (key: ResizableColumn, width: number | null) =>
    setColumns((current) => {
      const next = { ...current };
      if (width === null) delete next[key];
      else next[key] = width;
      writeColumns(next);
      return next;
    });
  useEffect(() => () => setShell({ ticked: [] }), []);

  const today = ledger.calendar.dayKey(ledger.now);
  const range = { from: firstDayOf(ledger.calendar.monthKey(ledger.now)), to: today };
  const savedView = views.find((view) => view.id === query.saved);
  const base: ActivityFilters = savedView?.filters ?? NO_FILTERS;
  const all = useMemo(() => selectActivity(items, query, range) as Shown[], [items, query, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = pageOf(all, query.page);
  const open = openId ? ledger.projection.transactionsById[openId] : undefined;
  const openIndex = all.findIndex((item) => item.id === openId);

  const go = (next: Partial<ActivityQuery>, path = pathname) => {
    router.replace(`${path}${activityQueryString({ ...query, ...next }, new URLSearchParams(params.toString()))}`, { scroll: false });
  };
  const openRow = (id: string | null) => {
    setMenu(null);
    const path = id ? `/activity/${id}` : '/activity';
    if (path !== pathname) router.replace(`${path}${activityQueryString(query, new URLSearchParams(params.toString()))}`, { scroll: false });
  };
  const move = (step: 1 | -1) => {
    const index = openIndex === -1 ? (step === 1 ? 0 : all.length - 1) : openIndex + step;
    const next = all[Math.max(0, Math.min(all.length - 1, index))];
    if (!next) return;
    const nextPage = Math.floor(all.indexOf(next) / 25) + 1;
    router.replace(`/activity/${next.id}${activityQueryString({ ...query, page: nextPage }, new URLSearchParams(params.toString()))}`, { scroll: false });
    requestAnimationFrame(() => document.querySelector(`[data-row-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }));
  };
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickView = (saved: string) => {
    const view = views.find((each) => each.id === saved);
    setSelected(new Set());
    go({ ...(view?.filters ?? NO_FILTERS), saved, page: 1 });
  };
  const setFilters = (next: Partial<ActivityFilters>) => go({ ...next, page: 1 });
  // W2-Parts: a delete asks first, with what it takes off the month; Undo still comes in the toast.
  const [confirming, setConfirming] = useState<{ ids: readonly string[]; label: string } | null>(null);
  const removeRows = (ids: readonly string[], label: string) => setConfirming({ ids, label });
  const confirmRemove = () => {
    if (!confirming) return;
    const { ids, label } = confirming;
    setConfirming(null);
    if (commit(planTransactionsDelete(ids, { now: new Date().toISOString() }), label) === null) return;
    setSelected(new Set());
    if (openId && ids.includes(openId)) openRow(null);
  };
  const editRows = (ids: readonly string[], data: { categoryId?: string; walletId?: string }, label: string) => {
    setBulkOpen(null);
    commit(planTransactionsEdit(ids, data, ledger.projection, planContext(ledger.userId)), label);
  };
  const saveCell = (item: Shown, categoryId: string) => {
    const name = ledger.projection.categoriesById[categoryId]?.name ?? 'category';
    setCell(null);
    commit(planTransactionEdit(item.id, { categoryId }, ledger.projection, planContext(ledger.userId)), `${item.title} moved to ${name}`);
  };
  const saveView = (name: string) => {
    const view: SavedView = { id: `v${Date.now().toString(36)}`, name: name.trim().slice(0, 40), filters: filtersOf(query) };
    const next = [...views, view];
    setViews(next);
    writeViews(next);
    setNaming(null);
    go({ saved: view.id, page: 1 });
  };

  useScreenKeys((key) => {
    const current = all[openIndex] ?? page.rows[0];
    switch (key) {
      case 'Escape':
        if (menu || bulkOpen || cell || naming !== null) {
          setMenu(null);
          setBulkOpen(null);
          setCell(null);
          setNaming(null);
        } else if (selected.size) setSelected(new Set());
        else if (openId) openRow(null);
        else return false;
        return true;
      case 'j':
        move(1);
        return true;
      case 'k':
        move(-1);
        return true;
      case 'x':
        if (!current) return false;
        toggle(current.id);
        return true;
      case 'Enter':
        if (!current || openId) return false;
        openRow(current.id);
        return true;
      case 'c':
        if (!current || current.kind === 'transfer') return false;
        setCell({ id: current.id, text: '' });
        return true;
      case 'Delete':
        if (selected.size) removeRows([...selected], `${selected.size} deleted`);
        else if (open && current) removeRows([current.id], `${current.title} deleted`);
        else return false;
        return true;
      default:
        return false;
    }
  });

  const selectedRows = items.filter((item) => selected.has(item.id));
  const selectedOut = selectedRows.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amountMinor, 0);
  const counts = {
    all: selectActivity(items, { ...query, ...NO_FILTERS, saved: 'all' }, range).length,
    check: selectActivity(items, { ...query, ...NO_FILTERS, saved: 'check' }, range).length,
    auto: selectActivity(items, { ...query, ...NO_FILTERS, saved: 'auto' }, range).length,
  };
  const spent = all.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amountMinor, 0);
  const moneyIn = all.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amountMinor, 0);
  const totals = [spent ? `Spent ${formatMoney(spent, ledger.currency)}` : '', moneyIn ? `Money in +${formatMoney(moneyIn, ledger.currency)}` : ''].filter(Boolean).join(' · ');
  const pageIds = page.rows.map((item) => item.id);
  const ticked = pageIds.filter((id) => selected.has(id)).length;
  const categories = Object.values(ledger.projection.categoriesById)
    .filter((category) => category.isActive && (category.userId === null || category.userId === ledger.userId) && category.type !== 'income')
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const leftFor = (categoryId: string) => {
    const spend = ledger.month.budgeted.find((each) => each.categoryId === categoryId);
    if (!spend || spend.budgetMinor === null) return null;
    const left = spend.budgetMinor - spend.spentMinor;
    return left >= 0 ? `${formatMoney(left, ledger.currency, { whole: true })} left` : `${formatMoney(-left, ledger.currency, { whole: true })} over`;
  };
  const empty = ledger.loaded && items.length === 0;

  const rowMenu = (event: MouseEvent, item: Shown) => {
    event.preventDefault();
    event.stopPropagation();
    const box = (event.currentTarget as HTMLElement).closest('.activity-list-card')!.getBoundingClientRect();
    setCell(null);
    setMenu({ id: item.id, x: event.clientX - box.left, y: event.clientY - box.top });
  };
  const amountCell = (item: Shown) => {
    const amount = rowAmount(item.row);
    return (
      <span className="num td-amount" data-tone={amount.tone}>
        {amount.text}
      </span>
    );
  };
  const checkbox = (item: Shown) => (
    <button
      type="button"
      role="checkbox"
      className="cbx"
      aria-checked={selected.has(item.id)}
      aria-label={`Select ${item.title}`}
      onClick={(event) => {
        event.stopPropagation();
        toggle(item.id);
      }}
    >
      {selected.has(item.id) && <Icon name="check" size={14} />}
    </button>
  );
  const categoryCell = (item: Shown): ReactNode => {
    const draftTo = drafted.get(item.id);
    const target = draftTo ? ledger.projection.categoriesById[draftTo] : undefined;
    if (target)
      return (
        <span className="draft-to" aria-label={`Moni's draft: ${item.category ?? 'No category'} to ${target.name}`}>
          <Bubble icon={item.row.icon} color={item.row.color} size={22} glyph={12} />
          <Glyph name="arrow-right" size={15} />
          <Bubble icon={target.icon} color={target.color} size={22} glyph={12} />
          <span className="cell-text" title={target.name}>
            {target.name}
          </span>
        </span>
      );
    if (item.kind === 'transfer')
      return (
        <span className="td-plain">
          <Bubble icon="swap-horizontal" color={null} size={22} glyph={12} />
          To {item.row.toWallet}
        </span>
      );
    if (cell?.id === item.id) {
      const matches = categories.filter((category) => category.name.toLowerCase().includes(cell.text.trim().toLowerCase())).slice(0, 6);
      return (
        <span className="cell-edit-anchor" onClick={(event) => event.stopPropagation()}>
          <label className="cell-edit">
            <Bubble icon={item.row.icon} color={item.row.color} size={22} glyph={12} />
            <span className="sr-only">Category for {item.title}</span>
            <input
              id="cell-edit-input"
              autoFocus
              placeholder="Type to search"
              aria-autocomplete="list"
              value={cell.text}
              onChange={(event) => setCell({ id: item.id, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches[0]) {
                  event.preventDefault();
                  saveCell(item, matches[0].id);
                } else if (event.key === 'Tab') {
                  event.preventDefault();
                  if (matches[0] && cell.text.trim()) saveCell(item, matches[0].id);
                  const next = page.rows[page.rows.indexOf(item) + 1];
                  setCell(next && next.kind !== 'transfer' ? { id: next.id, text: '' } : null);
                } else if (event.key === 'Escape') {
                  event.stopPropagation();
                  setCell(null);
                }
              }}
            />
          </label>
          <div role="listbox" aria-label="Categories" className="popover cell-pop motion-pop">
            {matches.map((category, index) => (
              <button type="button" role="option" aria-selected={index === 0} key={category.id} className="popover-row" onClick={() => saveCell(item, category.id)}>
                <Bubble icon={category.icon} color={category.color} size={26} glyph={14} />
                {category.name}
                <span className="popover-side num">{leftFor(category.id)}</span>
              </button>
            ))}
            <div className="popover-foot">
              <span className="kbd">↵</span>Save<span className="kbd">Tab</span>Next cell<span className="kbd">Esc</span>Cancel
            </div>
          </div>
        </span>
      );
    }
    return (
      <button
        type="button"
        className="cell"
        aria-label={`Category ${item.category ?? 'none'}, double-click to edit`}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setMenu(null);
          setCell({ id: item.id, text: '' });
        }}
      >
        <Bubble icon={item.row.icon} color={item.row.color} size={22} glyph={12} />
        <span className="cell-text" title={item.category ?? undefined}>
          {item.category ?? 'No category'}
        </span>
      </button>
    );
  };

  const menuItem = menu && items.find((item) => item.id === menu.id);
  const days = useMemo(() => {
    const groups: { day: string; rows: Shown[]; out: number; in: number }[] = [];
    for (const item of page.rows) {
      let group = groups.at(-1);
      if (group?.day !== item.day) groups.push((group = { day: item.day, rows: [], out: 0, in: 0 }));
      group.rows.push(item);
      if (item.kind === 'expense') group.out += item.amountMinor;
      if (item.kind === 'income') group.in += item.amountMinor;
    }
    return groups;
  }, [page.rows]);

  return (
    <Page
      title="Activity"
      phone="tab-with-moni"
      commandText="Search activity or ask Moni"
      actions={
        <span className="toggle toggle-lg" role="radiogroup" aria-label="Show as" data-only="sidebar rail">
          <span className="toggle-pill" aria-hidden="true" data-at={query.show} />
          <button type="button" role="radio" aria-checked={query.show === 'list'} onClick={() => go({ show: 'list' })}>
            <Glyph name="format-list-bulleted" size={18} />
            List
          </button>
          <button type="button" role="radio" aria-checked={query.show === 'table'} onClick={() => go({ show: 'table' })}>
            <Glyph name="table-large" size={18} />
            Table
          </button>
        </span>
      }
    >
      <div className="activity" data-show={query.show} data-pane-open={(open && !pane) || undefined} data-loaded={ledger.loaded || undefined}>
        <div className="phone-tools" data-only="phone">
          {ledger.waiting.length > 0 && (
            <Link href={reviewHref()} className="to-review press">
              <span className="to-review-n">{ledger.waiting.length}</span>
              <span className="to-review-text">
                To review
                <span className="num">{formatMoney(ledger.waiting.reduce((sum, each) => sum + Number(each.amountMinor ?? 0), 0), ledger.currency)}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </Link>
          )}
          <label className="phone-search">
            <Glyph name="magnify" size={20} />
            <span className="sr-only">Search merchant, note or amount</span>
            <input placeholder="Search merchant, note or amount" value={query.q} onChange={(event) => setFilters({ q: event.target.value })} />
          </label>
          <div className="phone-kinds" role="radiogroup" aria-label="Type">
            {PHONE_KINDS.map(({ kind, label }) => (
              <button type="button" role="radio" key={kind} aria-checked={query.kind === kind} className="kind-chip press" onClick={() => setFilters({ kind })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div role="tablist" aria-label="Saved views" className="view-tabs" data-only="sidebar rail rail-one-column">
          {BUILT_IN_VIEWS.map((view) => (
            <button type="button" role="tab" key={view} aria-selected={query.saved === view} className="view-tab press" onClick={() => pickView(view)}>
              {view === 'all' ? 'All' : view === 'check' ? 'To check' : 'Auto-added'}
              <span className="view-count num">{counts[view]}</span>
            </button>
          ))}
          {views.map((view) => (
            <button type="button" role="tab" key={view.id} aria-selected={query.saved === view.id} className="view-tab press" onClick={() => pickView(view.id)}>
              <Glyph name="bookmark" size={16} />
              {view.name}
              <span className="view-count num">{selectActivity(items, { ...query, ...view.filters, saved: view.id }, range).length}</span>
            </button>
          ))}
          <span className="grow-space" />
          <span className="picker-anchor">
            <button type="button" className="btn btn-out save-view press" aria-expanded={naming !== null} onClick={() => setNaming(naming === null ? '' : null)}>
              <Glyph name="bookmark-outline" size={18} />
              Save view
            </button>
            {naming !== null && (
              <form
                className="popover save-pop motion-pop"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (naming.trim()) saveView(naming);
                }}
              >
                <label className="filter-search">
                  <span className="caps">Name this view</span>
                  <input autoFocus value={naming} maxLength={40} placeholder="Grab and fuel" onChange={(event) => setNaming(event.target.value)} />
                </label>
                <button type="submit" className="btn btn-ink press" disabled={!naming.trim()}>
                  Save view
                </button>
              </form>
            )}
          </span>
        </div>
        <RunningCard ledger={ledger} />
        <div className="activity-body">
          <div data-only="sidebar rail rail-one-column">
            <FilterBar ledger={ledger} filters={filtersOf(query)} base={base} range={range} onChange={setFilters} />
          </div>
          <section aria-label="Transactions" className="card activity-list-card" onClick={() => setMenu(null)}>
            {!ledger.loaded ? (
              <div className="activity-loading" aria-busy="true" aria-label="Loading transactions">
                {Array.from({ length: 8 }, (_, index) => (
                  <span key={index} className="activity-loading-row">
                    <span className="block" />
                    <span className="block" />
                    <span className="block" />
                  </span>
                ))}
              </div>
            ) : empty ? (
              <div className="activity-empty">
                <Cat mood="neutral" size={72} id="activity-empty" />
                <h2 className="card-title">No spending yet</h2>
                <p className="meta">Add your first spend with N, or link an app on a wallet so Moni catches them for you.</p>
                <button type="button" className="btn btn-ink press" onClick={() => run({ kind: 'add' })}>
                  <Icon name="plus" size={20} />
                  Add a transaction
                  <span className="kbd kbd-on-ink" data-only="sidebar rail rail-one-column">
                    N
                  </span>
                </button>
              </div>
            ) : all.length === 0 && ledger.loaded ? (
              <div className="activity-empty">
                <Cat mood="thinking" size={72} id="activity-none" />
                <h2 className="card-title">Nothing matches these filters</h2>
                <p className="meta">
                  {noMatchLine(filtersOf(query), range, {
                    categories: Object.fromEntries(Object.values(ledger.projection.categoriesById).map((category) => [category.id, category.name])),
                    wallets: ledger.walletNames,
                  })}
                </p>
                <button type="button" className="btn btn-sand press" onClick={() => setFilters({ ...base })}>
                  <Glyph name="filter-remove-outline" size={18} />
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div role="grid" aria-label="Transactions" aria-rowcount={page.total} className="activity-table" data-only="sidebar rail" style={columnStyle(columns)}>
                  <div role="row" className="tr th-row">
                    <span role="columnheader">
                      <button
                        type="button"
                        role="checkbox"
                        className="cbx"
                        aria-checked={ticked === 0 ? false : ticked === pageIds.length ? true : 'mixed'}
                        aria-label="Select all on this page"
                        onClick={() => setSelected(ticked === pageIds.length ? new Set() : new Set([...selected, ...pageIds]))}
                      >
                        {ticked > 0 && <Glyph name={ticked === pageIds.length ? 'check' : 'minus'} size={14} />}
                      </button>
                    </span>
                    {COLUMNS.map(({ key: sortKey, label }) => (
                      <span role="columnheader" key={sortKey} aria-sort={query.sort === sortKey ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="th" data-right={sortKey === 'amount' || undefined} onClick={() => go({ ...nextSort(query, sortKey), page: 1 })}>
                          {label}
                          <Glyph name={query.sort === sortKey && query.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={15} className={query.sort === sortKey ? 'sort-on' : 'sort-off'} />
                        </button>
                        {sortKey !== 'merchant' && (
                          <ResizeHandle
                            label={`Resize ${label}`}
                            span={COLUMN_SPANS[sortKey]}
                            value={columns[sortKey] ?? COLUMN_SPANS[sortKey].initial}
                            grows="right"
                            onChange={(width) => resizeColumn(sortKey, width)}
                            className="col-resize"
                          />
                        )}
                      </span>
                    ))}
                    <span />
                  </div>
                  {page.rows.map((item, index) => (
                    <div
                      role="row"
                      key={item.id}
                      data-row-id={item.id}
                      className="tr rise"
                      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                      aria-selected={item.id === openId}
                      data-checked={selected.has(item.id) || undefined}
                      data-draft={drafted.has(item.id) || undefined}
                      data-menu={menu?.id === item.id || undefined}
                      data-edit={cell?.id === item.id || undefined}
                      onClick={() => openRow(item.id)}
                      onContextMenu={(event) => rowMenu(event, item)}
                    >
                      <span role="gridcell">{checkbox(item)}</span>
                      <span role="gridcell" className="td-meta num">
                        {ledger.mounted ? dayHeading(item.day, today).replace(/^(Today|Yesterday) · /, '') : ''}
                      </span>
                      <span role="gridcell" className="td-merchant">
                        <span className="td-title" title={item.title}>
                          {item.title}
                        </span>
                        {item.auto && <span className="auto-pill">Auto</span>}
                        {query.saved === 'check' && checkReason(item) && (
                          <span className="check-pill">
                            <Glyph name="map-marker-off-outline" size={13} />
                            {checkReason(item)}
                          </span>
                        )}
                      </span>
                      <span role="gridcell">{categoryCell(item)}</span>
                      <span role="gridcell" className="td-plain">
                        <Bubble icon={ledger.projection.walletsById[item.walletId]?.icon} color={ledger.projection.walletsById[item.walletId]?.color} size={22} glyph={12} />
                        <span className="cell-text" title={item.wallet}>
                          {item.wallet}
                        </span>
                      </span>
                      <span role="gridcell" className="td-plain td-meta">
                        <Glyph name={SOURCE_ICONS[item.source]} size={16} />
                        {SOURCE_LABELS[item.source]}
                      </span>
                      <span role="gridcell">{amountCell(item)}</span>
                      <span role="gridcell">
                        <button type="button" className="more press" aria-label={`${item.title} menu`} aria-haspopup="menu" onClick={(event) => rowMenu(event, item)}>
                          <Glyph name="dots-horizontal" size={20} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div role="grid" aria-label="Transactions by day" className="activity-days" data-only="rail-one-column phone">
                  {days.map((group) => (
                    <div role="rowgroup" key={group.day}>
                      <div className="day-head caps">
                        <span>{ledger.mounted ? dayHeading(group.day, today) : group.day}</span>
                        <span className="num">
                          {[group.out ? `−${formatMoney(group.out, ledger.currency)}` : '', group.in ? `+${formatMoney(group.in, ledger.currency)}` : ''].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      {group.rows.map((item) => (
                        <div
                          role="row"
                          key={item.id}
                          data-row-id={item.id}
                          className="lrow"
                          aria-selected={item.id === openId}
                          data-checked={selected.has(item.id) || undefined}
                          data-draft={drafted.has(item.id) || undefined}
                          onClick={() => openRow(item.id)}
                          onContextMenu={(event) => rowMenu(event, item)}
                        >
                          <span data-only="sidebar rail rail-one-column">{checkbox(item)}</span>
                          <Bubble icon={item.row.icon} color={item.row.color} size={42} glyph={20} />
                          <span className="row-text">
                            <span className="row-title">{item.title}</span>
                            <span className="row-meta">
                              {item.auto && <span className="auto-pill">Auto</span>}
                              <span className="row-meta-text">{item.kind === 'transfer' ? `${item.wallet} → ${item.row.toWallet}` : `${item.category ?? 'No category'}${drafted.has(item.id) ? ` → ${ledger.projection.categoriesById[drafted.get(item.id)!]?.name ?? ''}` : ''} · ${item.wallet}`}</span>
                            </span>
                          </span>
                          {amountCell(item)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="activity-foot">
                  <span className="meta num">
                    {page.first}–{page.last} of {page.total}
                  </span>
                  <span className="num foot-totals">{totals}</span>
                  <nav aria-label="Pages" className="pager">
                    <button type="button" className="pg press" aria-label="Previous page" disabled={page.page === 1} onClick={() => go({ page: page.page - 1 })}>
                      <Icon name="chevron-left" size={20} />
                    </button>
                    {Array.from({ length: page.pages }, (_, index) => index + 1).map((number) => (
                      <button type="button" key={number} className="pg num press" aria-current={number === page.page ? 'page' : undefined} onClick={() => go({ page: number })}>
                        {number}
                      </button>
                    ))}
                    <button type="button" className="pg press" aria-label="Next page" disabled={page.page === page.pages} onClick={() => go({ page: page.page + 1 })}>
                      <Icon name="chevron-right" size={20} />
                    </button>
                  </nav>
                </div>
              </>
            )}
            {menu && menuItem && (
              <div role="menu" aria-label={menuItem.title} className="popover row-menu motion-pop" style={{ left: menu.x + 8, top: menu.y + 8 }} onClick={(event) => event.stopPropagation()}>
                {menuItem.kind !== 'transfer' && (
                  <button type="button" role="menuitem" className="popover-row" onClick={() => (setMenu(null), setCell({ id: menuItem.id, text: '' }))}>
                    <Glyph name="tag-outline" size={18} />
                    Edit category
                    <span className="kbd menu-key">C</span>
                  </button>
                )}
                <button type="button" role="menuitem" className="popover-row" onClick={() => (setSelected(new Set([menuItem.id])), setMenu(null), setBulkOpen('wallet'))}>
                  <Glyph name="wallet-outline" size={18} />
                  Change wallet
                </button>
                <button type="button" role="menuitem" className="popover-row" onClick={() => (setMenu(null), setFilters({ q: menuItem.title }))}>
                  <Glyph name="magnify" size={18} />
                  Show all from {menuItem.title}
                </button>
                <button type="button" role="menuitem" className="popover-row" onClick={() => openRow(menuItem.id)}>
                  <Glyph name="dock-right" size={18} />
                  Open details
                  <span className="kbd menu-key">Enter</span>
                </button>
                <span className="menu-rule" aria-hidden="true" />
                <button type="button" role="menuitem" className="popover-row" data-tone="over" onClick={() => (setMenu(null), removeRows([menuItem.id], `${menuItem.title} deleted`))}>
                  <Icon name="delete-outline" size={18} />
                  Delete
                  <span className="kbd menu-key">Del</span>
                </button>
              </div>
            )}
          </section>
        </div>
        {selected.size > 0 && (
          <div className="bulk-slot" data-only="sidebar rail rail-one-column">
            <div role="toolbar" aria-label="Selected rows" className="bulk-bar motion-rise">
              <button type="button" className="bulk-close press" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
                <Icon name="close" size={20} />
              </button>
              <span className="bulk-count num">
                {selected.size} selected{selectedOut ? ` · −${formatMoney(selectedOut, ledger.currency)}` : ''}
              </span>
              <span className="bulk-rule" aria-hidden="true" />
              <span className="picker-anchor">
                <button type="button" className="bulk-btn press" aria-expanded={bulkOpen === 'category'} onClick={() => setBulkOpen(bulkOpen === 'category' ? null : 'category')}>
                  <Glyph name="tag-outline" size={18} />
                  Category
                </button>
                {bulkOpen === 'category' && (
                  <div role="listbox" aria-label="Category for selected rows" className="popover bulk-pop motion-pop">
                    {categories.map((category) => (
                      <button type="button" role="option" aria-selected={false} key={category.id} className="popover-row" onClick={() => editRows([...selected], { categoryId: category.id }, `${selected.size} moved to ${category.name}`)}>
                        <Bubble icon={category.icon} color={category.color} size={26} glyph={14} />
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </span>
              <span className="picker-anchor">
                <button type="button" className="bulk-btn press" aria-expanded={bulkOpen === 'wallet'} onClick={() => setBulkOpen(bulkOpen === 'wallet' ? null : 'wallet')}>
                  <Glyph name="wallet-outline" size={18} />
                  Wallet
                </button>
                {bulkOpen === 'wallet' && (
                  <div role="listbox" aria-label="Wallet for selected rows" className="popover bulk-pop motion-pop">
                    {ledger.wallets
                      .filter((wallet) => wallet.currency === ledger.currency)
                      .map((wallet) => (
                        <button type="button" role="option" aria-selected={false} key={wallet.id} className="popover-row" onClick={() => editRows([...selected], { walletId: wallet.id }, `${selected.size} moved to ${ledger.walletNames[wallet.id] ?? wallet.name}`)}>
                          <Bubble icon={wallet.icon} color={wallet.color} size={26} glyph={14} />
                          {wallet.name}
                        </button>
                      ))}
                  </div>
                )}
              </span>
              <a
                className="bulk-btn press"
                download={`moni-activity-${today}.csv`}
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(activityCsv(selectedRows))}`}
              >
                <Glyph name="tray-arrow-down" size={18} />
                Export CSV
              </a>
              <button type="button" className="bulk-btn bulk-delete press" onClick={() => removeRows([...selected], `${selected.size} deleted`)}>
                <Icon name="delete-outline" size={18} />
                Delete
                <span className="kbd kbd-on-ink">Del</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <SidePane label="Transaction" name="transaction" open={Boolean(open) && !pane} onClose={() => openRow(null)}>
        {open && (
          <DetailPane
            ledger={ledger}
            transaction={open}
            position={openIndex === -1 ? '' : `${openIndex + 1} of ${all.length}`}
            onMove={move}
            onClose={() => openRow(null)}
            onDelete={() => removeRows([open.id], `${items.find((item) => item.id === open.id)?.title ?? 'Transaction'} deleted`)}
          />
        )}
      </SidePane>
      {confirming && (
        <ConfirmDelete
          items={confirming.ids.map((id) => items.find((item) => item.id === id)).filter((item): item is Shown => Boolean(item))}
          currency={ledger.currency}
          onCancel={() => setConfirming(null)}
          onDelete={confirmRemove}
        />
      )}
    </Page>
  );
}
