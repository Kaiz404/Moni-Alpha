'use client';

import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS, rangePresets, sameRange, spanLabel, type ActivityKind, type RangePreset } from '@repo/core';
import { useRef, useState, type ReactNode } from 'react';
import { RangePicker } from '@/components/controls/date-picker';
import { Floating } from '@/components/controls/floating';
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

/** A filter chip and its popover; the whole chip opens it. */
function FilterChip({
  label,
  value,
  changed,
  open,
  search,
  wide,
  onOpen,
  children,
}: {
  label: string;
  value: string;
  changed: boolean;
  open: boolean;
  search?: boolean;
  wide?: boolean;
  onOpen: (open: boolean) => void;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchor} type="button" className="filter-chip press" aria-haspopup="dialog" aria-expanded={open} aria-pressed={changed} onClick={() => onOpen(!open)}>
        {search ? <Glyph name="magnify" size={16} /> : <span className="filter-label">{label}</span>}
        <span className="filter-value">{value}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <Floating anchor={anchor} role="dialog" label={label} className={wide ? 'range-pop' : 'filter-pop'} onClose={() => onOpen(false)}>
          {children}
        </Floating>
      )}
    </>
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
  const today = ledger.calendar.dayKey(ledger.now);
  const presets = rangePresets(ledger.now, ledger.calendar);
  const presetSpan = (preset: RangePreset) => ({ from: preset.range?.from ?? '2000-01-01', to: preset.range?.to ?? range.to });
  const amount =
    filters.min === null && filters.max === null ? 'Any' : filters.max === null ? `${filters.min}+` : `${filters.min ?? 0}–${filters.max}`;

  const chip = (key: Key, label: string, value: string, changed: boolean, body: ReactNode) => (
    <FilterChip key={key} label={label} value={value} changed={changed} open={open === key} search={key === 'search'} wide={key === 'dates'} onOpen={(next) => setOpen(next ? key : null)}>
      {body}
    </FilterChip>
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
        <RangePicker
          presets={presets.map((preset) => ({ key: preset.key, label: preset.label, selected: filters.from === null && filters.to === null ? preset.key === 'this-month' : sameRange(presetSpan(preset), span) }))}
          value={span}
          today={today}
          onPreset={(key) => {
            onChange(key === 'this-month' ? { from: null, to: null } : presetSpan(presets.find((preset) => preset.key === key)!));
            close();
          }}
          onRange={(next) => {
            onChange(next);
            close();
          }}
        />,
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
            onClick={() => {
              onChange({ kind });
              close();
            }}
          >
            <span className="popover-row-text">{ACTIVITY_KIND_LABELS[kind]}</span>
            {filters.kind === kind && (
              <span className="popover-tick" aria-hidden="true">
                <Icon name="check" size={18} />
              </span>
            )}
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
