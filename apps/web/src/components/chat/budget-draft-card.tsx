'use client';

import { currencySymbol, formatMoney, suggestTargetName } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { useState } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import { saveSuggestedBudget } from '@/lib/budget-save';
import { parseBudgetDraft } from '@/lib/budget-view';
import type { ChatMessage } from '@/lib/chat-thread';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { updateBudgetDraft } from './budget-ask';

type BudgetDraftMessage = Extract<ChatMessage, { kind: 'budget_draft' }>;

/** Moni's suggested budget (#139): the amount edits in place, and Set budget saves it with Undo. */
export function BudgetDraftCard({ message, ledger }: { message: BudgetDraftMessage; ledger: Ledger }) {
  const [draft, setDraft] = useState(String(Math.floor(message.amountMinor / 100)));
  const [busy, setBusy] = useState(false);
  const name = suggestTargetName(message.target);
  const typed = parseBudgetDraft(draft);

  if (message.done)
    return (
      <div className="chat-card draft-settled motion-rise" data-state="done">
        <Glyph name="check-circle" size={20} className="draft-done-icon" />
        <span className="draft-settled-text">
          {name} set to {formatMoney(message.amountMinor, ledger.currency, { whole: true })}
        </span>
      </div>
    );

  return (
    <form
      className="chat-card budget-draft"
      aria-label={`Moni's suggestion for ${name}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!typed || busy) return;
        setBusy(true);
        void saveSuggestedBudget(message.target, typed as MinorAmount, ledger).then((saved) => {
          setBusy(false);
          if (saved) updateBudgetDraft(message.id, { amountMinor: typed, done: true });
        });
      }}
    >
      <span className="meta">Moni&apos;s suggestion for {name}</span>
      <label className="budget-draft-amount num">
        <span>{currencySymbol(ledger.currency)}</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Suggested budget a month, in whole units"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <span className="meta">a month</span>
      </label>
      {message.average && <span className="meta num">{message.average}</span>}
      <p className="budget-draft-note">{message.note}</p>
      <button type="submit" className="btn btn-ink press" disabled={!typed || busy}>
        Set budget
      </button>
    </form>
  );
}
