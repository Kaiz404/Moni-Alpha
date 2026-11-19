'use client';

import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS, rangePresets, spanLabel, type ActivityKind } from '@repo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { NO_FILTERS, type ActivityFilters, type SourceFilter } from '@/lib/activity-query';
import { SOURCE_LABELS } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';

type Key = 'dates' | 'type' | 'wallets' | 'category' | 'source' | 'amount' | 'search';

const KIND_SHORT: Record<ActivityKind, string> = { all: 'All', expense: 'Expense', income: 'Income', transfer: 'Transfer' };
const SOURCES: { key: SourceFilter; label: string }[] = [
  ...Object.entries(SOURCE_LABELS).map(([key, label]) => ({ key: key as SourceFilter, label })),
  { key: 'auto', label: 'Auto' },
];

function names(ids: readonly string[], lookup: (id: string) => string | undefined): string {
  if (ids.length === 0) return 'All';
  const first = lookup(ids[0]!) ?? '1';
  return ids.length === 1 ? first : `${first} +${ids.length - 1}`;
}

/** Closes on Esc or a click outside, and gives the focus back to the chip. */
function Popover({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', key, true);
    };
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" aria-label={label} className="popover filter-pop motion-pop">
      {children}
    </div>
  );
}

function Check({ on, children, onToggle }: { on: boolean; children: ReactNode; onToggle: () => void }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} className="popover-row" onClick={onToggle}>
      <span className="cbx" aria-hidden="true" data-on={on || undefined}>
        {on && <Icon name="check" size={14} />}
      </span>
      {children}
    </button>
  );
}

/** Dates · Type · Wallets · Category · Source · Amount, each a chip with its popover (W2-Activity). */
export function FilterBar({
  ledger,
  filters,
  base,
  range,
  onChange,
}: {
  ledger: Ledger;
  filters: ActivityFilters;
  /** The view's own filters; a chip that differs from them turns Ink, and Clear goes back to them. */
  base: ActivityFilters;
  range: { from: string; to: string };
  onChange: (next: Partial<ActivityFilters>) => void;
}) {
  const [open, setOpen] = useState<Key | null>(null);
  const close = () => setOpen(null);
  const toggle = <T,>(list: readonly T[], value: T) => (list.includes(value) ? list.filter((each) => each !== value) : [...list, value]);
  const categories = Object.values(ledger.projection.categoriesById)
    .filter((category) => category.isActive && (category.userId === null || category.userId === ledger.userId))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const wallets = ledger.wallets.filter((wallet) => wallet.currency === ledger.currency);
  const span = { from: filters.from ?? range.from, to: filters.to ?? range.to };
  const amount =
    filters.min === null && filters.max === null ? 'Any' : filters.max === null ? `${filters.min}+` : `${filters.min ?? 0}–${filters.max}`;

  const chip = (key: Key, label: string, value: string, changed: boolean, body: ReactNode) => (
    <span className="picker-anchor" key={key}>
      <button
        type="button"
        className="filter-chip press"
        aria-haspopup="dialog"
        aria-expanded={open === key}
        aria-pressed={changed}
        onClick={() => setOpen(open === key ? null : key)}
      >
        {key === 'search' ? <Glyph name="magnify" size={16} /> : <span className="filter-label">{label}</span>}
        <span className="filter-value">{value}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open === key && (
        <Popover label={label} onClose={close}>
          {body}
        </Popover>
      )}
    </span>
  );

  const changed = (key: keyof ActivityFilters) => JSON.stringify(filters[key]) !== JSON.stringify(base[key]);
  const any = JSON.stringify(filters) !== JSON.stringify(base);

  return (
    <div role="group" aria-label="Filters" className="filter-bar">
      {chip(
        'dates',
        'Dates',
        spanLabel(span),
        changed('from') || changed('to'),
        <>
          {rangePresets(ledger.now, ledger.calendar).map((preset) => (
            <button
              type="button"
              key={preset.key}
              className="popover-row"
              aria-selected={preset.range?.from === span.from && preset.range?.to === span.to}
              onClick={() => {
                onChange(preset.key === 'this-month' ? { from: null, to: null } : { from: preset.range?.from ?? '2000-01-01', to: preset.range?.to ?? range.to });
                close();
              }}
            >
              {preset.label}
            </button>
          ))}
          <div className="filter-dates">
            <label>
              From
              <input type="date" value={span.from} max={span.to} onChange={(event) => event.target.value && onChange({ from: event.target.value })} />
            </label>
            <label>
              To
              <input type="date" value={span.to} min={span.from} onChange={(event) => event.target.value && onChange({ to: event.target.value })} />
            </label>
          </div>
        </>,
      )}
      {chip(
        'type',
        'Type',
        KIND_SHORT[filters.kind],
        changed('kind'),
        ACTIVITY_KINDS.map((kind) => (
          <button
            type="button"
            key={kind}
            role="menuitemradio"
            aria-checked={filters.kind === kind}
            className="popover-row"
            aria-selected={filters.kind === kind}
            onClick={() => {
              onChange({ kind });
              close();
            }}
          >
            {ACTIVITY_KIND_LABELS[kind]}
          </button>
        )),
      )}
      {chip(
        'wallets',
        'Wallets',
        names(filters.wallets, (id) => ledger.walletNames[id]),
        changed('wallets'),
        wallets.map((wallet) => (
          <Check key={wallet.id} on={filters.wallets.includes(wallet.id)} onToggle={() => onChange({ wallets: toggle(filters.wallets, wallet.id) })}>
            <Bubble icon={wallet.icon} color={wallet.color} size={26} glyph={14} />
            {wallet.name}
          </Check>
        )),
      )}
      {chip(
        'category',
        'Category',
        names(filters.categories, (id) => ledger.projection.categoriesById[id]?.name),
        changed('categories'),
        <div className="filter-scroll">
          {categories.map((category) => (
            <Check key={category.id} on={filters.categories.includes(category.id)} onToggle={() => onChange({ categories: toggle(filters.categories, category.id) })}>
              <Bubble icon={category.icon} color={category.color} size={26} glyph={14} />
              {category.name}
            </Check>
          ))}
        </div>,
      )}
      {chip(
        'source',
        'Source',
        filters.sources.length === 0 ? 'All' : filters.sources.map((key) => SOURCES.find((source) => source.key === key)?.label).join(', '),
        changed('sources'),
        SOURCES.map((source) => (
          <Check key={source.key} on={filters.sources.includes(source.key)} onToggle={() => onChange({ sources: toggle(filters.sources, source.key) })}>
            {source.label}
          </Check>
        )),
      )}
      {chip(
        'amount',
        'Amount',
        amount,
        changed('min') || changed('max'),
        <div className="filter-dates">
          <label>
            At least
            <input inputMode="decimal" defaultValue={filters.min ?? ''} onChange={(event) => onChange({ min: event.target.value === '' ? null : Number(event.target.value) || 0 })} />
          </label>
          <label>
            At most
            <input inputMode="decimal" defaultValue={filters.max ?? ''} onChange={(event) => onChange({ max: event.target.value === '' ? null : Number(event.target.value) || 0 })} />
          </label>
        </div>,
      )}
      {(filters.q || open === 'search') &&
        chip(
          'search',
          'Search',
          filters.q || 'Search',
          changed('q'),
          <label className="filter-search">
            <span className="sr-only">Merchant, note or amount</span>
            <input autoFocus placeholder="Merchant, note or amount" defaultValue={filters.q} onChange={(event) => onChange({ q: event.target.value })} />
          </label>,
        )}
      {!filters.q && open !== 'search' && (
        <button type="button" className="icon-chip press" aria-label="Search merchant, note or amount" onClick={() => setOpen('search')}>
          <Glyph name="magnify" size={18} />
        </button>
      )}
      {any && (
        <button type="button" className="icon-chip press" aria-label="Clear filters" title="Clear filters" onClick={() => onChange({ ...NO_FILTERS, ...base })}>
          <Glyph name="filter-remove-outline" size={18} />
        </button>
      )}
    </div>
  );
}
