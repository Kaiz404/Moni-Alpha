'use client';

import { planCategoryCreate } from '@repo/core';
import { categoryIconNames, categoryNameMaxLength, customCategoryColors, type CategoryIconName, type CustomCategoryColor } from '@repo/types';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { Radio, RadioGroup } from '@ui-sdk/react/radio';
import { useState } from 'react';
import type { SelectAction } from '@/components/controls/select';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { showToast } from '@/components/shell/shell-store';
import { categoriesSeen } from '@/lib/category-pick';
import { applyPlan } from '@/lib/ledger/commit';
import type { Ledger } from '@/lib/ledger/use-ledger';
import './new-category.css';

/** A category pick's last row: it opens New category, and the pick takes the one it makes. */
export function newCategoryAction(run: () => void): SelectAction {
  return { label: 'New category', lead: <Bubble icon="plus" color={null} dashed size={26} glyph={14} />, run };
}

/**
 * The phone's category form as a dialog over the pick that asked (V2A-CategoryPick's New category): name, icon
 * and colour for a category of the pick's type. `onClose` gets the category it made, or null when it closes without one.
 */
export function NewCategoryDialog({
  ledger,
  type,
  name: initialName = '',
  onClose,
}: {
  ledger: Pick<Ledger, 'projection' | 'userId'>;
  type: 'expense' | 'income';
  name?: string;
  onClose: (made: { id: string; name: string } | null) => void;
}) {
  const [name, setName] = useState(initialName.slice(0, categoryNameMaxLength));
  const [icon, setIcon] = useState<CategoryIconName>('package-variant');
  const [color, setColor] = useState<CustomCategoryColor>(customCategoryColors[8]);
  const plan = name.trim() ? planCategoryCreate({ name, icon, color, type }, categoriesSeen(ledger), { userId: ledger.userId, newId: () => crypto.randomUUID() }) : null;
  const refused = plan?.kind === 'error' ? plan.message : null;
  const create = () => {
    if (plan?.kind !== 'writes') return;
    try {
      applyPlan(plan);
    } catch {
      showToast({ text: "Couldn't save. Try again.", tone: 'error' });
      return;
    }
    onClose({ id: plan.result, name: name.trim() });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(null)}>
      <DialogBackdrop className="scrim scrim-center" />
      <DialogContent className="dialog new-category motion-pop" onKeyDown={(event) => event.stopPropagation()}>
        <DialogTitle className="dialog-title">New category</DialogTitle>
        <form
          className="new-category-form"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <label className="new-category-name" data-bad={refused ? true : undefined}>
            <Bubble icon={icon} color={color} size={36} glyph={18} />
            <input aria-label="Name" placeholder="e.g. Pet care" autoFocus maxLength={categoryNameMaxLength} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {refused && <p className="new-category-refused">{refused}</p>}
          <RadioGroup aria-label="Icon" className="new-category-icons" value={icon} onValueChange={(next) => next && setIcon(next as CategoryIconName)}>
            {categoryIconNames.map((each) => (
              <Radio key={each} value={each} aria-label={`Icon ${each.replaceAll('-', ' ')}`} className="new-category-icon press">
                <Glyph name={each} size={20} />
              </Radio>
            ))}
          </RadioGroup>
          <RadioGroup aria-label="Colour" className="new-category-colours" value={color} onValueChange={(next) => next && setColor(next as CustomCategoryColor)}>
            {customCategoryColors.map((each) => (
              <Radio key={each} value={each} aria-label={`Colour ${each}`} className="new-category-swatch press" style={{ background: each }} />
            ))}
          </RadioGroup>
          <div className="confirm-actions">
            <DialogClose className="btn btn-sand press">
              Cancel
              <span className="kbd">Esc</span>
            </DialogClose>
            <button type="submit" className="btn btn-ink press" disabled={plan?.kind !== 'writes'}>
              Create category
              <span className="kbd kbd-on-ink">Enter</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
