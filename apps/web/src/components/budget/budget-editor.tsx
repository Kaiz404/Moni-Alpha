'use client';

/** A budget being typed: which category, where the edit started, and the half-typed text. */
export type BudgetEdit = { categoryId: string; at: 'table' | 'pane'; draft: string };

/**
 * The capsule a budget is typed into, with the system keyboard: Enter saves, Esc cancels. Its keys
 * stop here so the screen's own Esc (close the pane) never runs as well.
 */
export function BudgetEditor({
  name,
  draft,
  at,
  onDraft,
  onSave,
  onCancel,
  wide = false,
}: {
  name: string;
  draft: string;
  at: BudgetEdit['at'];
  onDraft: (draft: string) => void;
  onSave: () => void;
  onCancel: () => void;
  wide?: boolean;
}) {
  return (
    <div className="edit-capsule" style={wide ? { width: 128, height: 40 } : undefined} data-at={at}>
      <span>RM</span>
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        aria-label={`${name} in ringgit, editing`}
        value={draft}
        onChange={(event) => onDraft(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            onSave();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="edit-hint" role="note" style={wide ? { top: 48, right: 0 } : undefined}>
        <span className="kbd">Enter</span>Save<span className="kbd">Esc</span>Cancel
      </div>
    </div>
  );
}
