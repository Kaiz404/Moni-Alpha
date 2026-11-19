'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/icon';
import { Bubble } from '@/components/ledger/glyph';
import { deleteWords } from '@/lib/activity-query';
import type { ActivityEntry } from '@/lib/activity-items';
import { rowAmount } from '@/lib/ledger/format';

const SHOWN = 3;

/**
 * W2-Parts' confirm before a delete: the rows that go, what it does to the month, Cancel (focused, Esc)
 * and the red Delete. Undo still comes in the toast after.
 */
export function ConfirmDelete({ items, currency, onCancel, onDelete }: { items: readonly ActivityEntry[]; currency: string; onCancel: () => void; onDelete: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  const words = deleteWords(items, currency);
  return (
    <div className="scrim scrim-center" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="dialog confirm-dialog motion-pop"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          onCancel();
        }}
      >
        <h2 id="confirm-delete-title" className="dialog-title">
          {words.title}
        </h2>
        <ul className="confirm-rows">
          {items.slice(0, SHOWN).map((item) => {
            const amount = rowAmount(item.row);
            return (
              <li key={item.id} className="confirm-row">
                <Bubble icon={item.row.icon} color={item.row.color} size={items.length > 1 ? 26 : 36} glyph={items.length > 1 ? 14 : 18} />
                <span className="confirm-name">{item.title}</span>
                <span className="meta">{[item.category, item.wallet].filter(Boolean).join(' · ')}</span>
                <span className="num confirm-amount" data-tone={amount.tone}>
                  {amount.text}
                </span>
              </li>
            );
          })}
          {items.length > SHOWN && <li className="meta confirm-more">and {items.length - SHOWN} more</li>}
        </ul>
        <p className="confirm-line">{words.line}</p>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="btn btn-sand press" onClick={onCancel}>
            Cancel
            <span className="kbd">Esc</span>
          </button>
          <button type="button" className="btn confirm-danger press" onClick={onDelete}>
            <Icon name="delete-outline" size={18} />
            {words.action}
          </button>
        </div>
      </div>
    </div>
  );
}
