'use client';

import { aiUseAllowed, dateLabel, draftFromExtraction, extractDateContext, notNow, turnOnFor, type FinanceWallet } from '@repo/core';
import { useEffect, useState, type ReactNode } from 'react';
import { AskMoniMark, Cat } from '@/components/brand';
import { ConsentDialog } from '@/components/chat/consent-dialog';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { useOnline } from '@/components/states/connection';
import { ADD_COPY, editForm, formFromDraft, planAdd, readAmount, type AddForm, type AddKind, type AddMode } from '@/lib/add-entry';
import { changeAiConsent, currentAiConsent, webAiClient } from '@/lib/ai';
import { commit, planContext } from '@/lib/ledger/commit';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { useScreenKeys } from '@/lib/screen-keys';
import { useShellApi } from './shell-context';
import { getShell, setShell, showToast, useShell } from './shell-store';

function PaneHead({ title, onBack }: { title: string; onBack?: () => void }) {
  const { run } = useShellApi();
  return (
    <header className="pane-head">
      <button type="button" className="back-button press" data-only="phone" onClick={() => run({ kind: 'closePane' })} aria-label="Back">
        <Icon name="chevron-left" size={22} />
      </button>
      {onBack && (
        <button type="button" className="back-button press" data-only="sidebar rail rail-one-column" onClick={onBack} aria-label="Back to the choice">
          <Icon name="chevron-left" size={22} />
        </button>
      )}
      <h2 className="pane-title">{title}</h2>
      <button type="button" className="pane-close press" data-only="sidebar rail rail-one-column" onClick={() => run({ kind: 'closePane' })} aria-label="Close">
        <Icon name="close" size={20} />
        <span className="kbd">Esc</span>
      </button>
    </header>
  );
}

const CHOICES: { mode: Exclude<AddMode, 'choose'>; label: string; key: string }[] = [
  { mode: 'type', label: 'Type it', key: 'T' },
  { mode: 'ask', label: 'Ask Moni', key: 'A' },
];

const setMode = (addMode: AddMode) => setShell({ addMode });
const setForm = (patch: Partial<AddForm>) => setShell((shell) => ({ addForm: editForm(shell.addForm, patch) }));

/**
 * Add slides over the page from the right (W2-Motion 3); under 700 wide it is the + page. It opens on
 * the phone's chooser with two of its four ways, Type it and Ask Moni, each with its key.
 */
export function AddPane() {
  const { addMode } = useShell();
  const ledger = useLedger();
  useScreenKeys((key) => {
    if (addMode !== 'choose') return false;
    const choice = CHOICES.find((each) => each.key.toLowerCase() === key);
    if (!choice) return false;
    setMode(choice.mode);
    return true;
  }, 'add');
  return (
    <aside className="pane pane-add motion-slide" aria-label="Add a transaction" data-pane="add">
      <PaneHead title="Add a transaction" onBack={addMode === 'choose' ? undefined : () => setMode('choose')} />
      {addMode === 'choose' ? (
        <div className="pane-body">
          <div className="add-choices">
            {CHOICES.map((choice) => (
              <button key={choice.mode} type="button" className="add-choice press" autoFocus={choice.mode === 'type'} onClick={() => setMode(choice.mode)}>
                {choice.mode === 'type' ? (
                  <span className="add-choice-bubble">
                    <Icon name="dialpad" size={24} />
                  </span>
                ) : (
                  <span className="add-choice-bubble add-choice-moni">
                    <AskMoniMark size={30} onInk id="add-choice-ask" />
                  </span>
                )}
                <span className="add-choice-label">{choice.label}</span>
                <span className="kbd" data-only="sidebar rail rail-one-column">
                  {choice.key}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="pane-body">
            <div className="add-modes" role="radiogroup" aria-label="How to add">
              {CHOICES.map((choice) => (
                <button key={choice.mode} type="button" role="radio" aria-checked={addMode === choice.mode} onClick={() => setMode(choice.mode)}>
                  {choice.label}
                </button>
              ))}
            </div>
            {addMode === 'type' ? <TypeIt ledger={ledger} /> : <AskMoni ledger={ledger} />}
          </div>
        </>
      )}
    </aside>
  );
}

function mainWallets(ledger: Ledger): FinanceWallet[] {
  return ledger.wallets.filter((wallet) => wallet.currency === ledger.currency);
}

type Picker = 'wallet' | 'to' | 'category' | null;

/** The phone's Type it (V2A-CaptureType): Expense, Income or Transfer, the amount, then the details. */
function TypeIt({ ledger }: { ledger: Ledger }) {
  const { run } = useShellApi();
  const { addForm: form } = useShell();
  const [open, setOpen] = useState<Picker>(null);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(null);
    };
    const away = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.add-anchor')) setOpen(null);
    };
    window.addEventListener('keydown', key, true);
    document.addEventListener('mousedown', away);
    return () => {
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('mousedown', away);
    };
  }, [open]);
  const wallets = mainWallets(ledger);
  const walletId = form.walletId ?? (wallets.find((wallet) => wallet.id === ledger.defaultWalletId) ?? wallets[0])?.id ?? null;
  const wallet = wallets.find((each) => each.id === walletId) ?? null;
  const toWallet = wallets.find((each) => each.id === form.toWalletId && each.id !== walletId) ?? null;
  const categories = Object.values(ledger.projection.categoriesById)
    .filter((category) => category.isActive && (category.userId === null || category.userId === ledger.userId) && category.type === form.kind)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const category = categories.find((each) => each.id === form.categoryId) ?? null;
  const today = ledger.calendar.dayKey(ledger.now);
  const day = form.day ?? today;
  const copy = ADD_COPY[form.kind];
  const ready = readAmount(form.amount) !== null && wallet !== null && (form.kind !== 'transfer' || toWallet !== null);

  const save = () => {
    if (!ready) return;
    const plan = planAdd({ ...form, walletId }, ledger.projection, ledger.calendar, planContext(ledger.userId), new Date());
    if (!commit(plan, copy.added)) return;
    run({ kind: 'closePane' });
  };

  const pick = (which: Exclude<Picker, null>, lead: ReactNode, text: string, options: ReactNode) => (
    <span className="add-anchor">
      <button type="button" className="add-pick press" aria-haspopup="listbox" aria-expanded={open === which} onClick={() => setOpen(open === which ? null : which)}>
        {lead}
        <span>{text}</span>
        <Icon name="chevron-down" size={18} />
      </button>
      {open === which && (
        <ul role="listbox" aria-label={which === 'category' ? 'Category' : which === 'to' ? 'To' : copy.wallet} className="add-menu motion-pop">
          {options}
        </ul>
      )}
    </span>
  );
  const walletRows = (list: FinanceWallet[], selected: string | null, onPick: (id: string) => void) =>
    list.map((each) => (
      <li key={each.id} role="option" aria-selected={each.id === selected} tabIndex={0} className="add-menu-row" onClick={() => (onPick(each.id), setOpen(null))} onKeyDown={(event) => event.key === 'Enter' && (onPick(each.id), setOpen(null))}>
        <Bubble icon={each.icon} color={each.color} size={26} glyph={14} />
        {ledger.walletNames[each.id] ?? each.name}
      </li>
    ));

  return (
    <div
      className="add-form"
      role="form"
      aria-label={copy.tab}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'date') {
          event.preventDefault();
          save();
        }
      }}
    >
      <div className="add-kinds" role="radiogroup" aria-label="Kind">
        {(['expense', 'income', 'transfer'] as const satisfies readonly AddKind[]).map((kind) => (
          <button key={kind} type="button" role="radio" aria-checked={form.kind === kind} onClick={() => setForm({ kind, categoryId: kind === form.kind ? form.categoryId : null })}>
            {ADD_COPY[kind].tab}
          </button>
        ))}
      </div>
      <label className="add-amount">
        <span className="add-currency">{ledger.currency}</span>
        <input
          aria-label="Amount"
          className="num"
          inputMode="decimal"
          placeholder="0.00"
          autoFocus
          value={form.amount}
          onChange={(event) => setForm({ amount: event.target.value })}
        />
      </label>
      {form.evidence && (
        <p className="add-evidence">
          <Cat size={28} id="add-evidence" mood="happy" />
          <span>{form.evidence}</span>
        </p>
      )}
      <dl className="add-fields">
        <div className="add-field">
          <dt>{copy.wallet}</dt>
          <dd>
            {pick(
              'wallet',
              <Bubble icon={wallet?.icon} color={wallet?.color} size={26} glyph={15} />,
              wallet ? (ledger.walletNames[wallet.id] ?? wallet.name) : 'Pick a wallet',
              walletRows(wallets, walletId, (id) => setForm({ walletId: id })),
            )}
          </dd>
        </div>
        {form.kind === 'transfer' ? (
          <div className="add-field">
            <dt>To</dt>
            <dd>
              {pick(
                'to',
                <Bubble icon={toWallet?.icon} color={toWallet?.color} size={26} glyph={15} />,
                toWallet ? (ledger.walletNames[toWallet.id] ?? toWallet.name) : 'Pick a wallet',
                walletRows(
                  wallets.filter((each) => each.id !== walletId),
                  form.toWalletId,
                  (id) => setForm({ toWalletId: id }),
                ),
              )}
            </dd>
          </div>
        ) : (
          <div className="add-field">
            <dt>Category</dt>
            <dd>
              {pick(
                'category',
                <Bubble icon={category?.icon} color={category?.color} size={26} glyph={15} />,
                category?.name ?? 'Pick a category',
                categories.map((each) => (
                  <li
                    key={each.id}
                    role="option"
                    aria-selected={each.id === form.categoryId}
                    tabIndex={0}
                    className="add-menu-row"
                    onClick={() => (setForm({ categoryId: each.id }), setOpen(null))}
                    onKeyDown={(event) => event.key === 'Enter' && (setForm({ categoryId: each.id }), setOpen(null))}
                  >
                    <Bubble icon={each.icon} color={each.color} size={26} glyph={14} />
                    {each.name}
                  </li>
                )),
              )}
            </dd>
          </div>
        )}
        <div className="add-field">
          <dt>Date</dt>
          <dd>
            <label className="add-pick add-pick-date press">
              <span className="add-mini">
                <Glyph name="calendar-blank-outline" size={15} />
              </span>
              <span>{day === today ? 'Today' : dateLabel(day, today)}</span>
              <input type="date" aria-label="Date" max={today} value={day} onChange={(event) => event.target.value && setForm({ day: event.target.value })} />
            </label>
          </dd>
        </div>
        {form.kind !== 'transfer' && (
          <div className="add-field">
            <dt>
              <label htmlFor="add-location">Location</label>
            </dt>
            <dd>
              <input id="add-location" className="add-text" placeholder="Where was it?" value={form.location} onChange={(event) => setForm({ location: event.target.value })} />
            </dd>
          </div>
        )}
        <div className="add-field">
          <dt>
            <label htmlFor="add-note">Shop or note</label>
          </dt>
          <dd>
            <input id="add-note" className="add-text" placeholder={form.kind === 'transfer' ? 'What it was for' : 'Mamak Ali'} value={form.note} onChange={(event) => setForm({ note: event.target.value })} />
          </dd>
        </div>
      </dl>
      <span className="add-grow" />
      <button type="button" className="btn btn-ink add-save press" disabled={!ready} onClick={save}>
        {copy.save}
        <span className="kbd kbd-on-ink" data-only="sidebar rail rail-one-column">
          Enter
        </span>
      </button>
    </div>
  );
}

/**
 * Ask Moni: a sentence Moni reads into the Type it form, for the user to check before adding. It asks
 * for Moni's AI first, as the phone's Say it does, and sends nothing while the user has it off.
 */
function AskMoni({ ledger }: { ledger: Ledger }) {
  const { addDraft, addAsk } = useShell();
  const online = useOnline();
  const [reading, setReading] = useState(false);
  const text = addDraft.trim();

  const read = async (sentence: string) => {
    setReading(true);
    const at = new Date();
    const wallets = mainWallets(ledger);
    const result = await webAiClient('add').extractFromText({
      text: sentence,
      wallets: wallets.map((wallet) => ({ id: wallet.id, name: wallet.name, type: wallet.type, currency: wallet.currency })),
      ...extractDateContext(at),
    });
    setReading(false);
    if (result.status === 'unavailable' && result.reason === 'consent') return setShell({ addAsk: true });
    const draft = draftFromExtraction(
      result,
      { wallets, categories: Object.values(ledger.projection.categoriesById), history: ledger.transactions, defaultWalletId: ledger.defaultWalletId },
      at,
    );
    if (draft.status === 'ok') return setShell({ addForm: formFromDraft(draft.draft, ledger.calendar), addMode: 'type' });
    showToast({
      text: draft.status === 'unreadable' ? "Moni couldn't find an amount. Add one, or type it." : "Moni couldn't read it. Try again.",
      tone: 'error',
      retry: draft.status === 'unavailable' ? () => void read(sentence) : undefined,
    });
  };

  const ask = async () => {
    if (!text || reading || !online) return;
    if (!aiUseAllowed(await currentAiConsent(), 'add')) return setShell({ addAsk: true });
    await read(text);
  };

  const turnOn = async () => {
    setShell({ addAsk: false });
    try {
      await changeAiConsent(turnOnFor(await currentAiConsent(), 'add'));
    } catch {
      showToast({ text: "Moni couldn't save your choice. Try again.", tone: 'error' });
      return;
    }
    const sentence = getShell().addDraft.trim();
    if (sentence) await read(sentence);
  };

  const notNowForAdd = async () => {
    setShell({ addAsk: false });
    showToast({ text: "Moni's AI is off, so type it instead.", tone: 'info' });
    await changeAiConsent(notNow(await currentAiConsent())).catch(() => {});
  };

  return (
    <div className="add-form" role="form" aria-label="Ask Moni">
      <label className="label" htmlFor="add-draft" style={{ marginBottom: -6 }}>
        What did you spend?
        <span className="ai-tag">AI</span>
      </label>
      <textarea
        id="add-draft"
        className="add-draft"
        placeholder="12.50 lunch at Mamak Ali, cash"
        rows={3}
        autoFocus
        value={addDraft}
        onChange={(event) => setShell({ addDraft: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          void ask();
        }}
      />
      <p className="meta" style={{ margin: 0 }}>
        {online ? 'Moni fills in the entry for you to check.' : 'Ask Moni needs a connection. Type it works offline.'}
      </p>
      <span className="add-grow" />
      <button type="button" className="btn btn-ink add-save press" disabled={!text || !online} aria-busy={reading || undefined} onClick={() => void ask()}>
        {reading ? 'Reading' : 'Fill it in'}
        <span className="kbd kbd-on-ink" data-only="sidebar rail rail-one-column">
          Enter
        </span>
      </button>
      {addAsk && <ConsentDialog use="add" onTurnOn={() => void turnOn()} onNotNow={() => void notNowForAdd()} />}
    </div>
  );
}
