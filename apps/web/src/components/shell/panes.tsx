'use client';

import { AskMoniMark, Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import { useShellApi } from './shell-context';
import { setShell, useShell } from './shell-store';

function PaneHead({ title, children }: { title: string; children?: React.ReactNode }) {
  const { run } = useShellApi();
  return (
    <header className="pane-head">
      {children}
      <h2 className="pane-title">{title}</h2>
      <button type="button" className="pane-close press" onClick={() => run({ kind: 'closePane' })} aria-label="Close">
        <Icon name="close" size={20} />
        <span className="kbd">Esc</span>
      </button>
    </header>
  );
}

/**
 * Moni chat docked on the right (W2-Chat), its first-run look from W2-Empty. Under 700 wide it is the
 * pushed chat page. Answers arrive with phase 7; the draft already survives a resize and a section change.
 */
export function ChatPane() {
  const { user } = useShellApi();
  const { chatDraft } = useShell();
  return (
    <aside className="pane pane-chat motion-slide" aria-label="Moni chat" data-pane="chat">
      <PaneHead title="Moni chat">
        <AskMoniMark size={32} id="chat-head" />
      </PaneHead>
      <div className="pane-body" style={{ justifyContent: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 28, lineHeight: '34px', fontWeight: 700, letterSpacing: '-0.02em' }}>Hi {user.name}.</div>
          <div style={{ fontSize: 28, lineHeight: '34px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-muted)' }}>
            What did you spend?
          </div>
        </div>
      </div>
      <form className="pane-foot" onSubmit={(event) => event.preventDefault()}>
        <div className="composer">
          <textarea
            aria-label="Ask or add a transaction"
            placeholder="Ask or add a transaction"
            rows={2}
            value={chatDraft}
            onChange={(event) => setShell({ chatDraft: event.target.value })}
          />
          <button type="submit" className="composer-send" aria-label="Send" disabled>
            <Icon name="arrow-up" size={20} />
          </button>
        </div>
        <span className="meta" style={{ padding: '0 6px', fontSize: 12, lineHeight: '16px' }}>
          Moni chat uses AI and can get things wrong. Nothing is saved until you approve it.
        </span>
      </form>
    </aside>
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
