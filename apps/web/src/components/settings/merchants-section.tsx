'use client';

import {
  combine,
  planForgetMerchantNames,
  planMerchantNames,
  type MerchantAliasRow,
  type MerchantEntry,
  type Planned,
} from '@repo/core';
import { useRef, useState, type FormEvent } from 'react';
import { Cat } from '@/components/brand';
import { Floating } from '@/components/controls/floating';
import { Select } from '@/components/controls/select';
import { Icon } from '@/components/icon';
import { Bubble } from '@/components/ledger/glyph';
import { commit, planContext } from '@/lib/ledger/commit';
import { merchantPage, paymentsOf, type MerchantFilter, type MerchantSort } from '@/lib/merchant-names-view';
import { moniStore } from '@/lib/moni-store';
import { useScreenKeys } from '@/lib/screen-keys';
import { Mdi, SETTINGS_ICONS } from './mdi';
import { useMerchantNames } from './use-merchant-names';

const FILTERS: { key: MerchantFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'toName', label: 'To name' },
  { key: 'named', label: 'Named' },
];

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

/** Every merchant name the store holds, soft-deleted ones too, for a plan to revive rather than add. */
function aliasRows(): MerchantAliasRow[] {
  return Object.values((moniStore().merchantAliases$.peek() ?? {}) as Record<string, MerchantAliasRow | undefined>).filter(
    (row): row is MerchantAliasRow => row != null,
  );
}

/**
 * Settings › Merchant names (W2-Data): each bank code with the name you gave it, edited in its cell,
 * its payments and usual category. Ticks bring the Ink bulk bar: Rename names many codes at once, Use
 * Moni's guess names each by its guess, Forget names soft-deletes them. Every write is a plan with Undo.
 */
export function MerchantsSection() {
  const { toName, named, ledger } = useMerchantNames();
  const [filter, setFilter] = useState<MerchantFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MerchantSort>('payments');
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ key: string; anchor: { readonly current: HTMLElement } } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** The cell Esc just left, whose blur must not save the draft it dropped. */
  const dropped = useRef<string | null>(null);

  const page = merchantPage({ toName, named }, { filter, query, sort, page: pageNumber });
  const all = [...toName, ...named];
  const ticked = all.filter((entry) => selected.has(entry.key));
  const pageKeys = page.rows.map((entry) => entry.key);
  const tickedOnPage = pageKeys.filter((key) => selected.has(key)).length;

  const write = (plan: Planned<null>, done: string) => commit(plan, done) !== null;
  const ctx = () => planContext(ledger.userId);

  const name = (entries: readonly MerchantEntry[], text: string) => {
    const keys = entries.map((entry) => entry.key);
    const done = entries.length === 1 ? `${entries[0]!.raw} is now ${text.trim()}` : `${plural(entries.length, 'code')} are now ${text.trim()}`;
    return write(planMerchantNames(aliasRows(), keys, text, ctx()), done);
  };
  const nameByGuess = (entries: readonly MerchantEntry[]) => {
    const guessed = entries.filter((entry) => !entry.name && entry.guess);
    if (!guessed.length) return false;
    const plan = combine(guessed.map((entry) => planMerchantNames(aliasRows(), [entry.key], entry.guess!, ctx())));
    return write(plan.kind === 'writes' ? { ...plan, result: null } : plan, guessed.length === 1 ? `${guessed[0]!.raw} is now ${guessed[0]!.guess}` : `${plural(guessed.length, 'code')} named by Moni's guess`);
  };
  const forget = (entries: readonly MerchantEntry[]) => {
    const keys = entries.filter((entry) => entry.name).map((entry) => entry.key);
    if (!keys.length) return false;
    return write(planForgetMerchantNames(aliasRows(), keys, ctx()), keys.length === 1 ? 'Name forgotten' : `${plural(keys.length, 'name')} forgotten`);
  };

  const clearDraft = (key: string) =>
    setDrafts((now) => {
      const next = { ...now };
      delete next[key];
      return next;
    });
  const saveCell = (entry: MerchantEntry) => {
    const draft = drafts[entry.key];
    if (draft === undefined) return;
    if (draft.trim() && draft.trim() !== entry.name) name([entry], draft);
    clearDraft(entry.key);
  };
  const toggle = (key: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const clearTicks = () => {
    setSelected(new Set());
    setRenaming(null);
  };
  const applyRename = (event: FormEvent) => {
    event.preventDefault();
    if (renaming === null || !renaming.trim()) return;
    if (name(ticked, renaming)) clearTicks();
  };

  useScreenKeys((key) => {
    if (key !== 'Escape') return false;
    if (menu) setMenu(null);
    else if (renaming !== null) setRenaming(null);
    else if (selected.size) setSelected(new Set());
    else return false;
    return true;
  });

  const go = (patch: () => void) => {
    patch();
    setPageNumber(1);
  };
  const loaded = ledger.loaded;
  const nothing = loaded && all.length === 0;

  return (
    <section className="set-card" aria-labelledby="merchants-title" data-loaded={loaded || undefined} style={{ overflow: 'visible' }}>
      <div>
        <h2 id="merchants-title" className="set-title">
          Merchant names
        </h2>
        <p className="set-lede">Moni shows your name instead of the bank&apos;s code, on past payments and every new one.</p>
      </div>

      {nothing ? (
        <div className="mn-empty">
          <div className="dashed-tile">
            <Mdi path={SETTINGS_ICONS.store} size={28} />
            <b>No codes to name yet</b>
            <p>When a bank alert uses a code like PAYNET*8821 KUL, it shows here so you can give it your name.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mn-tools">
            <div className="mn-seg" role="group" aria-label="Show">
              {FILTERS.map((each) => (
                <button key={each.key} type="button" aria-pressed={filter === each.key} onClick={() => go(() => setFilter(each.key))}>
                  {each.label} <span className="num">{page.counts[each.key]}</span>
                </button>
              ))}
            </div>
            <label className="mn-search">
              <Mdi path={SETTINGS_ICONS.search} size={18} />
              <span className="sr-only">Search</span>
              <input value={query} placeholder="Search codes or names" onChange={(event) => go(() => setQuery(event.target.value))} />
            </label>
            <span className="mn-sort pick">
              <Select
                label="Sort"
                className="pick-trigger"
                align="end"
                value={sort}
                options={[
                  { value: 'payments', label: 'Most payments' },
                  { value: 'name', label: 'Name, A to Z' },
                ]}
                onChange={(next) => go(() => setSort(next))}
              />
            </span>
          </div>

          <p className="desktop-only-note set-small">Tick codes on a computer to rename many at once.</p>

          <div role="table" aria-label="Merchant names" className="mn-table">
            <div role="row" className="mn-row mn-head">
              <span className="mn-tick">
                <button
                  type="button"
                  role="checkbox"
                  className="cbx"
                  aria-label="Select all on this page"
                  aria-checked={tickedOnPage === 0 ? false : tickedOnPage === pageKeys.length ? true : 'mixed'}
                  onClick={() =>
                    setSelected((now) => {
                      const next = new Set(now);
                      if (tickedOnPage === pageKeys.length) pageKeys.forEach((key) => next.delete(key));
                      else pageKeys.forEach((key) => next.add(key));
                      return next;
                    })
                  }
                >
                  {tickedOnPage > 0 && <Icon name="check" size={14} />}
                </button>
              </span>
              <span role="columnheader" className="mn-code">
                Code in the alert
              </span>
              <span role="columnheader" className="mn-name">
                Name you gave
              </span>
              <span role="columnheader" className="mn-count">
                Payments
              </span>
              <span role="columnheader" className="mn-usual">
                Usual category
              </span>
              <span style={{ width: 36, flex: 'none' }} />
            </div>
            {query && page.total === 0 && (
              <div className="mn-empty">
                <div className="dashed-tile">
                  <b>No matches for &ldquo;{query.trim()}&rdquo;</b>
                  <p>Try part of a name, or the code a bank alert shows.</p>
                </div>
              </div>
            )}
            {page.rows.map((entry) => {
              const wallet = entry.walletId ? ledger.projection.walletsById[entry.walletId] : undefined;
              const category = entry.categoryId ? ledger.projection.categoriesById[entry.categoryId] : undefined;
              const draft = drafts[entry.key];
              return (
                <div role="row" key={entry.key} className="mn-row" aria-selected={selected.has(entry.key)} data-key={entry.key}>
                  <span className="mn-tick">
                    <button type="button" role="checkbox" className="cbx" aria-checked={selected.has(entry.key)} aria-label={`Select ${entry.raw}`} onClick={() => toggle(entry.key)}>
                      {selected.has(entry.key) && <Icon name="check" size={14} />}
                    </button>
                  </span>
                  <span role="cell" className="mn-code">
                    {wallet ? <Bubble icon={wallet.icon} color={wallet.color} size={26} glyph={14} label={wallet.name} /> : <Bubble icon="store-outline" color={null} size={26} glyph={14} />}
                    <b>{entry.raw}</b>
                  </span>
                  <span role="cell" className="mn-name">
                    <label className="mn-cell" data-empty={(!entry.name && !draft) || undefined}>
                      <span className="sr-only">Name for {entry.raw}</span>
                      <input
                        value={draft ?? entry.name ?? ''}
                        placeholder="Name it"
                        maxLength={100}
                        data-key={entry.key}
                        onChange={(event) => setDrafts((now) => ({ ...now, [entry.key]: event.target.value }))}
                        onBlur={() => {
                          if (dropped.current === entry.key) dropped.current = null;
                          else saveCell(entry);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          } else if (event.key === 'Escape') {
                            event.stopPropagation();
                            dropped.current = entry.key;
                            clearDraft(entry.key);
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      {entry.name && (
                        <span className="mn-pen" aria-hidden="true">
                          <Mdi path={SETTINGS_ICONS.pen} size={16} />
                        </span>
                      )}
                    </label>
                    {!entry.name && entry.guess && draft === undefined && (
                      <button type="button" className="mn-guess press" title={`Name it ${entry.guess}`} onClick={() => name([entry], entry.guess!)}>
                        <Cat mood="neutral" size={18} id={`guess-${entry.key.replace(/\s/g, '-')}`} />
                        {entry.guess}
                      </button>
                    )}
                  </span>
                  <span role="cell" className="mn-count num">
                    {entry.count}
                  </span>
                  <span role="cell" className="mn-usual">
                    {category && (
                      <>
                        <Bubble icon={category.icon} color={category.color} size={26} glyph={14} />
                        <span>{category.name}</span>
                      </>
                    )}
                  </span>
                  <span>
                    <button type="button" className="mn-more press" aria-label={`More for ${entry.raw}`} aria-haspopup="menu" aria-expanded={menu?.key === entry.key} onClick={(event) => setMenu(menu?.key === entry.key ? null : { key: entry.key, anchor: { current: event.currentTarget } })}>
                      <Mdi path={SETTINGS_ICONS.more} size={20} />
                    </button>
                    {menu?.key === entry.key && (
                      <Floating anchor={menu.anchor} role="menu" label={entry.raw} align="end" className="row-menu" onClose={() => setMenu(null)}>
                        <button
                          type="button"
                          role="menuitem"
                          className="popover-row"
                          onClick={() => {
                            setMenu(null);
                            document.querySelector<HTMLInputElement>(`.mn-row[data-key="${entry.key}"] input`)?.focus();
                          }}
                        >
                          <Mdi path={SETTINGS_ICONS.rename} size={18} />
                          Rename
                        </button>
                        {!entry.name && entry.guess && (
                          <button type="button" role="menuitem" className="popover-row" onClick={() => (setMenu(null), name([entry], entry.guess!))}>
                            <Cat mood="neutral" size={18} id={`menu-guess-${entry.key.replace(/\s/g, '-')}`} />
                            Use Moni&apos;s guess: {entry.guess}
                          </button>
                        )}
                        {entry.name && (
                          <button type="button" role="menuitem" className="popover-row" data-tone="over" onClick={() => (setMenu(null), forget([entry]))}>
                            <Mdi path={SETTINGS_ICONS.forget} size={18} />
                            Forget name
                          </button>
                        )}
                      </Floating>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mn-foot">
            <span className="meta num">
              {page.first}–{page.last} of {page.total}
            </span>
            <nav aria-label="Pages" className="pager">
              <button type="button" className="pg press" aria-label="Previous page" disabled={page.page === 1} onClick={() => setPageNumber(page.page - 1)}>
                <Icon name="chevron-left" size={20} />
              </button>
              {Array.from({ length: page.pages }, (_, index) => index + 1).map((number) => (
                <button type="button" key={number} className="pg num press" aria-current={number === page.page ? 'page' : undefined} onClick={() => setPageNumber(number)}>
                  {number}
                </button>
              ))}
              <button type="button" className="pg press" aria-label="Next page" disabled={page.page === page.pages} onClick={() => setPageNumber(page.page + 1)}>
                <Icon name="chevron-right" size={20} />
              </button>
            </nav>
          </div>
        </>
      )}

      {selected.size > 0 && (
        <div className="mn-bulk desktop-only">
          {renaming !== null && ticked.length > 0 && (
            <form className="rename-pop motion-pop" role="dialog" aria-label={`Name ${plural(ticked.length, 'code')}`} onSubmit={applyRename}>
              <h3>Name {plural(ticked.length, 'code')}</h3>
              <p>{ticked.length === 1 ? 'It shows this name.' : ticked.length === 2 ? 'Both show this name.' : 'All show this name.'} Each keeps its own category.</p>
              <label className="rename-field">
                <span className="sr-only">Name</span>
                <input autoFocus value={renaming} maxLength={100} onChange={(event) => setRenaming(event.target.value)} />
              </label>
              <div className="rename-actions">
                <button type="button" className="btn btn-sand press" onClick={() => setRenaming(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-ink press" disabled={!renaming.trim()}>
                  Apply to {plural(paymentsOf(all, selected), 'payment')}
                  <span className="kbd kbd-on-ink">Enter</span>
                </button>
              </div>
            </form>
          )}
          <div role="toolbar" aria-label="Selected codes" className="bulk-bar motion-rise">
            <button type="button" className="bulk-close press" aria-label="Clear selection" onClick={clearTicks}>
              <Icon name="close" size={20} />
            </button>
            <span className="bulk-count num">{selected.size} selected</span>
            <span className="bulk-rule" aria-hidden="true" />
            <button
              type="button"
              className="bulk-btn press"
              aria-expanded={renaming !== null}
              onClick={() => setRenaming(renaming === null ? (ticked.find((entry) => entry.name)?.name ?? ticked.find((entry) => entry.guess)?.guess ?? '') : null)}
            >
              <Mdi path={SETTINGS_ICONS.rename} size={18} />
              Rename
            </button>
            {ticked.some((entry) => !entry.name && entry.guess) && (
              <button type="button" className="bulk-btn press" onClick={() => nameByGuess(ticked) && clearTicks()}>
                <Cat mood="neutral" size={18} id="bulk-guess" ground="dark" />
                Use Moni&apos;s guess
              </button>
            )}
            {ticked.some((entry) => entry.name) && (
              <button type="button" className="bulk-btn bulk-delete press" onClick={() => forget(ticked) && clearTicks()}>
                <Mdi path={SETTINGS_ICONS.forget} size={18} />
                Forget names
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
