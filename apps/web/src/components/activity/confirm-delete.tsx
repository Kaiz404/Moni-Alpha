'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Bubble } from '@/components/ledger/glyph';
import { deleteWords } from '@/lib/activity-query';
import type { ActivityEntry } from '@/lib/activity-items';
import { rowAmount } from '@/lib/ledger/format';

const SHOWN = 3;

/** The confirm before a delete lists the rows that go and what it does to the month. */
export function ConfirmDelete({ items, currency, onCancel, onDelete }: { items: readonly ActivityEntry[]; currency: string; onCancel: () => void; onDelete: () => void }) {
  const words = deleteWords(items, currency);
  return (
    <ConfirmDialog title={words.title} line={words.line} action={words.action} icon="delete-outline" onCancel={onCancel} onConfirm={onDelete}>
      <ul className="confirm-rows">
        {items.slice(0, SHOWN).map((item) => {
          const amount = rowAmount(item.row);
          return (
            <li key={item.id} className="confirm-row">
              <Bubble icon={item.row.icon} color={item.row.color} size={items.length > 1 ? 26 : 36} glyph={items.length > 1 ? 14 : 18} />
              <span className="confirm-name">{item.title}</span>
              <span className="meta">{[item.category, item.wallet].filter(Boolean).join(', ')}</span>
              <span className="num confirm-amount" data-tone={amount.tone}>
                {amount.text}
              </span>
            </li>
          );
        })}
        {items.length > SHOWN && <li className="meta confirm-more">and {items.length - SHOWN} more</li>}
      </ul>
    </ConfirmDialog>
  );
}
