'use client';

import { Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import { useShellApi } from './shell-context';
import { setShell, useShell } from './shell-store';

function PaneHead({ title }: { title: string }) {
  const { run } = useShellApi();
  return (
    <header className="pane-head">
      <button type="button" className="back-button press" data-only="phone" onClick={() => run({ kind: 'closePane' })} aria-label="Back">
        <Icon name="chevron-left" size={22} />
      </button>
      <h2 className="pane-title">{title}</h2>
      <button type="button" className="pane-close press" data-only="sidebar rail rail-one-column" onClick={() => run({ kind: 'closePane' })} aria-label="Close">
        <Icon name="close" size={20} />
        <span className="kbd">Esc</span>
      </button>
    </header>
  );
}

/** Add slides over the page from the right (W2-Motion 3). Under 700 wide it is the + page. */
export function AddPane() {
  const { addDraft } = useShell();
  return (
    <aside className="pane pane-add motion-slide" aria-label="Add a transaction" data-pane="add">
      <PaneHead title="Add a transaction" />
      <div className="pane-body">
        <div className="add-modes" role="group" aria-label="How to add">
          <button type="button" aria-pressed="true">
            Type it
          </button>
        </div>
        <label className="label" htmlFor="add-draft" style={{ marginBottom: -6 }}>
          What did you spend?
        </label>
        <textarea
          id="add-draft"
          className="add-draft"
          placeholder="12.50 lunch at Mamak Ali, cash"
          rows={3}
          value={addDraft}
          onChange={(event) => setShell({ addDraft: event.target.value })}
        />
        <p className="meta" style={{ margin: 0 }}>
          Moni reads it and fills in the amount, category and wallet for you to check.
        </p>
      </div>
      <div className="pane-foot" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Cat size={36} id="add-cat" mood="thinking" />
        <span className="meta" style={{ flex: '1 1 auto' }}>
          Adding from the web comes with Activity.
        </span>
        <button type="button" className="btn btn-ink" disabled>
          Add
        </button>
      </div>
    </aside>
  );
}
