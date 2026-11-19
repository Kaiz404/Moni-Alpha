'use client';

import { syncState, when } from '@legendapp/state';
import { combine, formatMoney, planWalletCreate, turnOnFor, UNASKED } from '@repo/core';
import { applyWrites, updateProfilePreferences } from '@repo/data';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Cat, Wordmark } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { signOut } from '@/components/shell/shell-store';
import { changeAiConsent, useAiConsent } from '@/lib/ai';
import { useNow } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import {
  currencyChoices,
  parseBalance,
  searchCurrencies,
  suggestedCurrency,
  walletsReady,
  walletsToCreate,
  WALLET_KINDS,
  type CurrencyChoice,
  type SetupStep,
  type WalletDraft,
  type WalletKind,
} from '@/lib/setup';
import { PhoneStep } from './phone-step';
import { Item } from './setup-item';
import './setup.css';

const STEPS: readonly { title: string; icon: string }[] = [
  { title: 'Main currency', icon: 'currency-usd' },
  { title: "Moni's AI", icon: 'robot-happy-outline' },
  { title: 'Wallets', icon: 'wallet-outline' },
  { title: 'Phone app', icon: 'cellphone-arrow-down' },
];

type State = {
  step: SetupStep;
  currency: string;
  ai: boolean | null;
  wallets: WalletDraft[];
  query: string;
  /** Wallet ids already written, so Finish after a failed save never writes them twice. */
  created: string[] | null;
  busy: boolean;
  error: string | null;
};

type Action =
  | { kind: 'step'; step: SetupStep }
  | { kind: 'currency'; code: string }
  | { kind: 'query'; query: string }
  | { kind: 'ai'; on: boolean }
  | { kind: 'wallet'; key: string; patch: Partial<WalletDraft> }
  | { kind: 'addWallet' }
  | { kind: 'removeWallet'; key: string }
  | { kind: 'busy'; busy: boolean; error?: string | null }
  | { kind: 'created'; ids: string[] };

let nextKey = 1;
const blankWallet = (currency: string, kind: WalletKind = 'bank'): WalletDraft => ({ key: `w${nextKey++}`, name: '', kind, currency, balance: '' });

function reduce(state: State, action: Action): State {
  switch (action.kind) {
    case 'step':
      return { ...state, step: action.step, error: null };
    case 'currency':
      // Wallets still in the old main currency follow it; one set to another currency on purpose stays.
      return {
        ...state,
        currency: action.code,
        wallets: state.wallets.map((wallet) => (wallet.currency === state.currency ? { ...wallet, currency: action.code } : wallet)),
      };
    case 'query':
      return { ...state, query: action.query };
    case 'ai':
      return { ...state, ai: action.on, step: 3, error: null };
    case 'wallet':
      return { ...state, wallets: state.wallets.map((wallet) => (wallet.key === action.key ? { ...wallet, ...action.patch } : wallet)) };
    case 'addWallet':
      return { ...state, wallets: [...state.wallets, blankWallet(state.currency)] };
    case 'removeWallet': {
      const left = state.wallets.filter((wallet) => wallet.key !== action.key);
      return { ...state, wallets: left.length ? left : [blankWallet(state.currency)] };
    }
    case 'busy':
      return { ...state, busy: action.busy, error: action.error ?? null };
    case 'created':
      return { ...state, created: action.ids };
  }
}

/** "Wednesday, 14 Oct" and "October" in the browser's zone, once the page has hydrated. */
function useToday() {
  const now = useNow();
  return useMemo(() => {
    if (!now) return { date: '', month: '' };
    const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', options).format(now);
    return { date: `${part({ weekday: 'long' })}, ${part({ day: 'numeric' })} ${part({ month: 'short' })}`, month: part({ month: 'long' }) };
  }, [now]);
}

/**
 * W2-Onboarding: four steps with the stepper on the left, the step in the middle and a live preview of
 * Home on the right. Nothing but Moni's AI is saved before Finish, which writes the wallets, then the
 * main currency and the end of set-up, and lands on Home.
 */
export function SetupFlow({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const consent = useAiConsent();
  const today = useToday();
  const [state, dispatch] = useReducer(reduce, undefined, () => ({
    step: 1 as SetupStep,
    currency: 'MYR',
    ai: null,
    wallets: [blankWallet('MYR'), blankWallet('MYR', 'cash')],
    query: '',
    created: null,
    busy: false,
    error: null,
  }));
  // The browser's own list and region, read after hydration so the server's HTML always matches.
  const [{ choices, suggested }, setIntl] = useState<{ choices: CurrencyChoice[]; suggested: string | null }>({ choices: [], suggested: null });
  const picked = useRef(false);
  useEffect(() => {
    const codes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : ['MYR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD'];
    const browser = suggestedCurrency(navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone);
    setIntl({ choices: currencyChoices(codes), suggested: browser });
    if (!picked.current && browser) dispatch({ kind: 'currency', code: browser });
  }, []);

  const main = choices.find((choice) => choice.code === state.currency) ?? { code: state.currency, name: state.currency, symbol: state.currency };
  const canContinue = state.step === 1 || (state.step === 3 && walletsReady(state.wallets));

  const chooseAi = async (on: boolean) => {
    dispatch({ kind: 'busy', busy: true });
    const before = consent ?? UNASKED;
    try {
      await changeAiConsent(on ? turnOnFor(before, 'chat') : { all: false });
      dispatch({ kind: 'busy', busy: false });
      dispatch({ kind: 'ai', on });
    } catch {
      dispatch({ kind: 'busy', busy: false, error: "Couldn't save your choice. Check your connection and try again." });
    }
  };

  const finish = async () => {
    dispatch({ kind: 'busy', busy: true });
    const store = moniStore();
    try {
      if (!state.created) {
        const { data } = await store.supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) throw new Error('signed out');
        const ctx = { userId, now: new Date().toISOString(), newId: () => crypto.randomUUID() };
        const plan = combine(walletsToCreate(state.wallets).map((wallet, index) => planWalletCreate(wallet, ctx, index)));
        if (plan.kind !== 'writes') throw new Error('no wallets');
        applyWrites(store, plan.writes);
        dispatch({ kind: 'created', ids: plan.result });
        const wallets$ = syncState(store.wallets$);
        await Promise.race([when(() => !wallets$.numPendingSets.get()), new Promise((resolve) => setTimeout(resolve, 8000))]);
      }
      store.profilePreferences$.set(
        await updateProfilePreferences(store.supabase, { currency: state.currency, setup_finished_at: new Date().toISOString() }),
      );
      router.replace('/home');
      router.refresh();
    } catch (error) {
      console.error('set-up could not finish', error);
      dispatch({ kind: 'busy', busy: false, error: "Couldn't finish set-up. Your wallets are kept; check your connection and try again." });
    }
  };

  const next = () => {
    if (state.busy) return;
    if (state.step === 1) dispatch({ kind: 'step', step: 2 });
    else if (state.step === 3 && canContinue) dispatch({ kind: 'step', step: 4 });
    else if (state.step === 4) void finish();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && state.step === 1 && target?.tagName !== 'INPUT') {
        event.preventDefault();
        document.getElementById('setup-currency-search')?.focus();
      }
      const control = (target?.tagName === 'BUTTON' && target.getAttribute('role') !== 'option') || target?.tagName === 'SELECT' || target?.tagName === 'A';
      if (event.key !== 'Enter' || event.isComposing || control) return;
      if (state.step === 2) return;
      event.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const back = state.step > 1 && (
    <button type="button" className="btn btn-out press" onClick={() => dispatch({ kind: 'step', step: (state.step - 1) as SetupStep })}>
      <Icon name="chevron-left" size={20} />
      Back
    </button>
  );
  const cont = (label: string) => (
    <button type="button" className="btn btn-ink setup-next press" disabled={!canContinue && state.step !== 4} aria-busy={state.busy || undefined} onClick={next}>
      {label}
      <span className="kbd kbd-on-ink">Enter</span>
    </button>
  );

  return (
    <div className="setup">
      <header className="setup-top">
        <span className="setup-logo" aria-label="Moni">
          <Cat size={32} ground="deep" tile id="setup-logo" />
          <Wordmark size={26} />
        </span>
        <span className="setup-who">Signed in as {email}</span>
        <button
          type="button"
          className="btn btn-out setup-signout press"
          onClick={() => void signOut().then(() => (router.replace('/login'), router.refresh()))}
        >
          Sign out
        </button>
      </header>
      <div className="setup-grid">
        <Stepper step={state.step} currency={main} ai={state.ai} wallets={walletsToCreate(state.wallets).length} />
        <section className="setup-mid" key={state.step} aria-labelledby="setup-title">
          <span className="caps">Step {state.step} of 4</span>
          {state.step === 1 && (
            <>
              <h1 className="setup-h" id="setup-title">
                Your main currency
              </h1>
              <p className="setup-lead">Moni adds up everything in one currency. Pick the one you spend in most.</p>
              <CurrencyList
                choices={choices}
                suggested={suggested}
                current={state.currency}
                query={state.query}
                onQuery={(query) => dispatch({ kind: 'query', query })}
                onPick={(code) => {
                  picked.current = true;
                  dispatch({ kind: 'currency', code });
                }}
              />
              <p className="setup-note">
                <Glyph name="information-outline" size={18} />
                Totals, budgets and charts use this one. Wallets in other currencies keep their own and are never added in.
              </p>
              <footer className="setup-foot">
                <span className="setup-fill" />
                {cont('Continue')}
              </footer>
            </>
          )}
          {state.step === 2 && (
            <>
              <h1 className="setup-h" id="setup-title">
                Moni&apos;s AI, your choice <span className="setup-ai">AI</span>
              </h1>
              <p className="setup-lead">
                Moni&apos;s AI turns a bank alert or a receipt into a transaction, and answers you in Moni chat. Nothing goes to it until you say yes.
              </p>
              <AiExplainer />
              <div className="setup-choice" role="group" aria-label="Moni's AI">
                <button type="button" className="setup-pick press" aria-pressed={state.ai === true} disabled={state.busy} onClick={() => void chooseAi(true)}>
                  <Glyph name="check-circle" size={20} />
                  Turn on Moni&apos;s AI
                </button>
                <button type="button" className="setup-pick press" aria-pressed={state.ai === false} disabled={state.busy} onClick={() => void chooseAi(false)}>
                  <Glyph name="check-circle" size={20} />
                  Not now
                </button>
              </div>
              <p className="setup-note">
                <Glyph name="cloud-outline" size={18} />
                <span>
                  Either way, your alerts and transactions are stored in Moni&apos;s cloud database.{' '}
                  <a href="/privacy" className="link" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </a>
                </span>
              </p>
              <footer className="setup-foot">
                {back}
                <span className="setup-fill" />
              </footer>
            </>
          )}
          {state.step === 3 && (
            <>
              <h1 className="setup-h" id="setup-title">
                Add your wallets
              </h1>
              <p className="setup-lead">Where your money sits: a bank account, an e-wallet, cash or a card. Add at least one now.</p>
              <WalletRows
                wallets={state.wallets}
                choices={choices}
                onChange={(key, patch) => dispatch({ kind: 'wallet', key, patch })}
                onRemove={(key) => dispatch({ kind: 'removeWallet', key })}
                onAdd={() => dispatch({ kind: 'addWallet' })}
              />
              <p className="setup-note">
                <Glyph name="information-outline" size={18} />
                Use what&apos;s in each one today. If a balance drifts, Moni asks you to check it now and then.
              </p>
              <footer className="setup-foot">
                {back}
                <span className="setup-fill" />
                {cont('Continue')}
              </footer>
            </>
          )}
          {state.step === 4 && (
            <PhoneStep
              email={email}
              footer={
                <footer className="setup-foot">
                  {back}
                  <span className="setup-fill" />
                  <button type="button" className="btn btn-sand press" disabled={state.busy} onClick={() => void finish()}>
                    I&apos;ll do it later
                  </button>
                  {cont('Finish set-up')}
                </footer>
              }
            />
          )}
          {state.error && (
            <p className="setup-error" role="alert">
              <Glyph name="alert-circle" size={18} />
              {state.error}
            </p>
          )}
        </section>
        <aside className="setup-preview" aria-label="Preview">
          <span className="caps setup-preview-cap">
            <Glyph name="eye-outline" size={16} />
            {state.step === 2 ? 'Preview · one bank alert' : state.step === 4 ? 'Preview · on your phone' : 'Preview · your Home'}
          </span>
          <Preview step={state.step} name={name} today={today} main={main} wallets={state.wallets} ai={state.ai} />
        </aside>
      </div>
    </div>
  );
}

function Stepper({ step, currency, ai, wallets }: { step: SetupStep; currency: CurrencyChoice; ai: boolean | null; wallets: number }) {
  const done = [`${currency.code} · ${currency.name}`, ai === null ? '' : ai ? 'On' : 'Off', wallets === 1 ? '1 wallet' : `${wallets} wallets`, 'Later'];
  return (
    <nav className="setup-steps" aria-label="Set-up steps">
      <div className="setup-steps-card">
        <span className="caps">Set up Moni · step {step} of 4</span>
        <span className="setup-bar" aria-hidden="true">
          <span style={{ width: `${(step / 4) * 100}%` }} />
        </span>
        <ol>
          {STEPS.map((each, index) => {
            const n = index + 1;
            const state = n < step ? 'done' : n === step ? 'now' : 'next';
            return (
              <li key={each.title} className="setup-srow" aria-current={n === step ? 'step' : undefined}>
                <span className="setup-dot" data-s={state}>
                  {state === 'done' ? <Glyph name="check-bold" size={16} /> : n}
                </span>
                <span className="setup-stext">
                  <b>{each.title}</b>
                  <span>{state === 'done' ? done[index] : state === 'now' ? (n === 1 ? done[0] : 'Now') : ''}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="setup-cat">
        <Cat mood={step === 4 ? 'happy' : 'neutral'} size={88} id={`setup-cat-${step === 4 ? 'happy' : 'neutral'}`} />
        <span>About two minutes. Every choice can change later in Settings.</span>
      </div>
    </nav>
  );
}

function CurrencyList({
  choices,
  suggested,
  current,
  query,
  onQuery,
  onPick,
}: {
  choices: readonly CurrencyChoice[];
  suggested: string | null;
  current: string;
  query: string;
  onQuery: (query: string) => void;
  onPick: (code: string) => void;
}) {
  const found = searchCurrencies(choices, query);
  const top = !query.trim() && suggested ? found.find((choice) => choice.code === suggested) : undefined;
  const rest = top ? found.filter((choice) => choice !== top) : found;
  const row = (choice: CurrencyChoice) => (
    <button key={choice.code} type="button" role="option" className="setup-cur" aria-selected={choice.code === current} onClick={() => onPick(choice.code)}>
      <span className="setup-code">{choice.code}</span>
      <span className="setup-cur-name">{choice.name}</span>
      <span className="setup-sym">{choice.symbol}</span>
      <span className="setup-radio">
        <Glyph name="check-bold" size={14} />
      </span>
    </button>
  );
  return (
    <div className="setup-card setup-list-card">
      <label className="setup-search">
        <Glyph name="magnify" size={20} />
        <span className="sr-only">Search currencies</span>
        <input id="setup-currency-search" placeholder="Search by currency or country" value={query} onChange={(event) => onQuery(event.target.value)} />
        <span className="kbd">/</span>
      </label>
      <div role="listbox" aria-label="Main currency" className="setup-list">
        {top && (
          <>
            <span className="setup-grp">Suggested from your browser</span>
            {row(top)}
          </>
        )}
        <span className="setup-grp">{query.trim() ? `${rest.length} found` : `All currencies · ${choices.length}`}</span>
        {rest.map(row)}
        {!found.length && <p className="setup-none">No currency matches “{query.trim()}”. Try its code, like USD.</p>}
      </div>
    </div>
  );
}

function AiExplainer() {
  const sent = [
    ['message-text-outline', 'The text of a bank alert', 'When your bank tells you about a payment'],
    ['receipt-text-outline', 'A receipt photo', 'Only one you snap and send to Moni'],
    ['microphone', 'What you type or say to Moni', 'A line in Moni chat, or Say it'],
  ] as const;
  const still = [
    ['keyboard-outline', 'Typing a transaction'],
    ['file-delimited-outline', 'CSV import'],
    ['chart-box', 'Budgets'],
    ['handshake-outline', 'Debts'],
  ] as const;
  return (
    <>
      <div className="setup-card setup-sent">
        <span className="caps">What gets sent, only when it&apos;s on</span>
        {sent.map(([icon, title, line]) => (
          <Item key={title} icon={icon} title={title} line={line} />
        ))}
        <Item icon="shield-lock-outline" title="Sent to AI providers that don't keep it or train on it" line="They read it, send back the transaction, and it's gone." tone="mint" />
      </div>
      <div className="setup-still">
        <b>Without it, these still work</b>
        <div>
          {still.map(([icon, label]) => (
            <span key={label} className="setup-chip">
              <Glyph name={icon} size={16} />
              {label}
            </span>
          ))}
        </div>
        <span className="meta">Bank alerts and receipts need it to become transactions.</span>
      </div>
    </>
  );
}

function WalletRows({
  wallets,
  choices,
  onChange,
  onRemove,
  onAdd,
}: {
  wallets: readonly WalletDraft[];
  choices: readonly CurrencyChoice[];
  onChange: (key: string, patch: Partial<WalletDraft>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="setup-card setup-wallets">
      <div className="setup-wrow setup-whead" aria-hidden="true">
        <span className="setup-wbubble" />
        <span>Name</span>
        <span>Type</span>
        <span className="setup-wbal-head">Starting balance</span>
        <span className="setup-wx" />
      </div>
      {wallets.map((wallet, index) => {
        const kind = WALLET_KINDS[wallet.kind];
        const bad = wallet.name.trim() !== '' && parseBalance(wallet.balance) === null;
        return (
          <div key={wallet.key} className="setup-wrow" data-wallet={index}>
            <span className="setup-wbubble">
              <Bubble icon={kind.icon} color={kind.color} size={36} glyph={18} />
            </span>
            <label className="setup-in">
              <span className="sr-only">Wallet {index + 1} name</span>
              <input value={wallet.name} placeholder={index === 0 ? 'Maybank Savings' : 'Name'} maxLength={100} onChange={(event) => onChange(wallet.key, { name: event.target.value })} />
            </label>
            <label className="setup-in setup-sel">
              <span className="sr-only">Wallet {index + 1} type</span>
              <select value={wallet.kind} onChange={(event) => onChange(wallet.key, { kind: event.target.value as WalletKind })}>
                {(Object.keys(WALLET_KINDS) as WalletKind[]).map((key) => (
                  <option key={key} value={key}>
                    {WALLET_KINDS[key].label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" size={18} />
            </label>
            <label className="setup-in setup-wbal num" data-bad={bad || undefined}>
              <span className="setup-sym">{choices.find((choice) => choice.code === wallet.currency)?.symbol ?? wallet.currency}</span>
              <span className="sr-only">Wallet {index + 1} starting balance</span>
              <input value={wallet.balance} inputMode="decimal" placeholder="0.00" onChange={(event) => onChange(wallet.key, { balance: event.target.value })} />
              <select className="setup-wcur" aria-label={`Wallet ${index + 1} currency`} value={wallet.currency} onChange={(event) => onChange(wallet.key, { currency: event.target.value })}>
                {choices.map((choice) => (
                  <option key={choice.code} value={choice.code}>
                    {choice.code}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="setup-wx press" aria-label={`Remove ${wallet.name.trim() || `wallet ${index + 1}`}`} onClick={() => onRemove(wallet.key)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        );
      })}
      <button type="button" className="setup-add press" onClick={onAdd}>
        <Icon name="plus" size={20} />
        Add another wallet
      </button>
    </div>
  );
}

function Preview({
  step,
  name,
  today,
  main,
  wallets,
  ai,
}: {
  step: SetupStep;
  name: string;
  today: { date: string; month: string };
  main: CurrencyChoice;
  wallets: readonly WalletDraft[];
  ai: boolean | null;
}): ReactNode {
  const money = (minor: number, currency = main.code) => formatMoney(minor, currency);
  if (step === 1)
    return (
      <>
        <div className="setup-pcard">
          <span className="meta">{today.date}</span>
          <b className="setup-pwelcome">Welcome to Moni, {name}</b>
          <span className="caps setup-pcap">Net worth</span>
          <span className="setup-zero num">{money(0)}</span>
          <span className="setup-chip setup-chip-sand">
            <Glyph name="currency-usd" size={16} />
            Main currency · {main.code}
          </span>
        </div>
        <div className="setup-pcard">
          <span className="caps">Spent in {today.month}</span>
          <svg width="100%" height="96" viewBox="0 0 360 96" preserveAspectRatio="none" aria-hidden="true" className="setup-pace">
            <line x1="0" y1="88" x2="360" y2="8" />
            <line x1="0" y1="88" x2="360" y2="88" />
          </svg>
          <span className="num setup-pline">
            <b>{money(0)}</b> spent · budgets and bills in {main.code}
          </span>
        </div>
        <div className="setup-pcard setup-pdash">
          <span className="setup-ic">
            <Glyph name="wallet-outline" size={20} />
          </span>
          <span className="setup-li-text">
            <b>Wallets</b>
            <span>You add them in step 3</span>
          </span>
        </div>
      </>
    );
  if (step === 2)
    return (
      <>
        <div className="setup-pcard">
          <span className="meta setup-alert-from">
            <Bubble icon="bank" color={WALLET_KINDS.bank.color} size={28} glyph={16} />
            Bank alert · 12:41 pm
          </span>
          <blockquote className="setup-quote">You&apos;ve spent {money(2340)} at GRAB*FOOD.</blockquote>
          <span className="setup-tag" data-off={ai === false || undefined}>
            <Glyph name="arrow-down" size={16} />
            {ai === false ? 'Nothing goes to an AI provider' : 'This text goes to the AI provider'}
          </span>
        </div>
        {ai === false ? (
          <p className="setup-note">
            <Glyph name="information-outline" size={18} />
            With it off, you type this one in yourself. Moni keeps the alert in your Capture log.
          </p>
        ) : (
          <div className="setup-pcard setup-plilac">
            <span className="caps">Back in Review</span>
            <div className="setup-review-row">
              <Bubble icon="silverware-fork-knife" color="var(--color-coral)" size={42} glyph={20} />
              <span className="setup-li-text">
                <b>GRAB*FOOD</b>
                <span>Food &amp; Dining · Bank · 12:41 pm</span>
              </span>
              <b className="num">{formatMoney(-2340, main.code)}</b>
            </div>
            <div className="setup-review-actions" aria-hidden="true">
              <span className="btn btn-out">Not mine</span>
              <span className="btn btn-key">
                <Icon name="check" size={18} />
                Approve
              </span>
            </div>
          </div>
        )}
      </>
    );
  if (step === 3) {
    const named = walletsToCreate(wallets);
    const inMain = named.filter((wallet) => wallet.currency === main.code);
    const other = named.find((wallet) => wallet.currency !== main.code);
    const net = inMain.reduce((sum, wallet) => sum + Number(wallet.initialBalanceMinor), 0);
    return (
      <>
        <div className="setup-pcard">
          <span className="caps">Net worth</span>
          <span className="setup-net num">{money(net)}</span>
          <span className="meta">
            {inMain.length === 1 ? '1 wallet' : `${inMain.length} wallets`} in {main.code}
          </span>
        </div>
        <div className="setup-pcard setup-pwallets">
          <b className="setup-ptitle">Wallets</b>
          {inMain.length === 0 && <span className="meta">Name a wallet and it shows here.</span>}
          {inMain.map((wallet, index) => (
            <div key={`${wallet.name}-${index}`} className="setup-pwallet">
              <Bubble icon={wallet.icon} color={wallet.color} size={32} glyph={16} />
              <span>{wallet.name}</span>
              <b className="num">{money(Number(wallet.initialBalanceMinor))}</b>
            </div>
          ))}
          {other && (
            <span className="meta">
              {other.name} keeps its own currency, on All wallets
            </span>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="setup-phone" aria-hidden="true">
        <span className="setup-phone-time">12:41</span>
        <div className="setup-notif">
          <span className="setup-notif-from">
            <Bubble icon="bank" color={WALLET_KINDS.bank.color} size={20} glyph={12} />
            Your bank · now
          </span>
          <span>You&apos;ve spent {money(2340)} at GRAB*FOOD.</span>
        </div>
        <div className="setup-notif setup-notif-moni">
          <span className="setup-notif-from">
            <Cat size={20} ground="deep" tile id="setup-notif" />
            Moni · now
          </span>
          <b>New transaction to review</b>
          <span>
            GRAB*FOOD {formatMoney(-2340, main.code)} · Food &amp; Dining
          </span>
        </div>
      </div>
      <p className="setup-note">
        <Glyph name="monitor" size={18} />
        A moment later it waits in Review here on the web too.
      </p>
    </>
  );
}
