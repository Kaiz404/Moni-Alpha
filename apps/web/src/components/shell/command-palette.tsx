'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { AskMoniMark, Cat } from '@/components/brand';
import { Glyph } from '@/components/ledger/glyph';
import { Icon } from '@/components/icon';
import { buildCommands, filterCommands, type Command } from '@/lib/commands';
import { useTheme } from '@/components/use-theme';
import { useShellApi } from './shell-context';
import { setShell } from './shell-store';

type Row = { id: string; command: Command | null; title: string };

/**
 * W2-Parts' Ctrl K bar: one box searches every place and action, and Tab sends the typed words to Moni
 * chat. Results swap as you type with no animation; the arrow keys move the highlight at once.
 */
export function CommandPalette() {
  const { run } = useShellApi();
  const router = useRouter();
  const { resolved } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const groups = useMemo(() => filterCommands(buildCommands({ resolvedTheme: resolved }), query), [resolved, query]);
  const typed = query.trim();
  const rows: Row[] = [
    ...groups.flatMap((group) => group.items.map((command) => ({ id: command.id, command, title: command.title }))),
    ...(typed ? [{ id: 'ask-typed', command: null, title: `Ask Moni: ${typed}` }] : []),
  ];
  const highlighted = Math.min(active, rows.length - 1);

  function choose(row: Row | undefined) {
    if (!row) return;
    if (row.command) return run(row.command.action);
    askMoni();
  }

  function askMoni() {
    setShell({ chatDraft: typed });
    run({ kind: 'ask' });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((highlighted + step + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(rows[highlighted]);
    } else if (event.key === 'Tab' && typed) {
      event.preventDefault();
      askMoni();
    }
  }

  let index = -1;
  const rowView = (row: Row, icon: React.ReactNode, keys?: readonly string[], trailing?: React.ReactNode) => {
    index += 1;
    const mine = index;
    return (
      <li
        key={row.id}
        id={`cmd-${row.id}`}
        role="option"
        aria-selected={mine === highlighted}
        className="cmd-row"
        onMouseMove={() => setActive(mine)}
        onClick={() => choose(row)}
      >
        {icon}
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>{row.title}</span>
        {trailing}
        {keys && (
          <span className="keys">
            {keys.map((key) => (
              <span key={key} className="kbd">
                {key}
              </span>
            ))}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && run({ kind: 'close' })}>
      <div role="dialog" aria-modal="true" aria-label="Search or ask Moni" className="palette motion-grow">
        <div className="palette-input">
          <span className="ask-bubble">
            <AskMoniMark size={22} onInk id="cmd-ask" />
          </span>
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-results"
            aria-activedescendant={rows[highlighted] ? `cmd-${rows[highlighted]!.id}` : undefined}
            placeholder="Search or ask Moni"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">Esc</span>
        </div>
        <ul id="cmd-results" role="listbox" aria-label="Results" className="palette-results">
          {groups.map((group) => (
            <li key={group.group} role="presentation">
              <span className="caps palette-group">{group.group}</span>
              <ul role="group" aria-label={group.group} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {group.items.map((command) =>
                  rowView(
                    { id: command.id, command, title: command.title },
                    <span className="cmd-icon">
                      {command.icon === 'cat' ? <AskMoniMark size={20} id={`cmd-${command.id}`} /> : <Icon name={command.icon} size={18} />}
                    </span>,
                    command.keys,
                  ),
                )}
              </ul>
            </li>
          ))}
          {typed && (
            <li role="presentation">
              <ul role="group" aria-label="Ask Moni" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {rowView(rows[rows.length - 1]!, <AskMoniMark size={28} id="cmd-ask-typed" />, ['Tab'])}
              </ul>
            </li>
          )}
          {typed && groups.length === 0 && (
            <li role="presentation" className="palette-miss">
              <div className="empty">
                <Cat mood="thinking" size={72} id="palette-miss" />
                <h2 className="empty-title">No matches for “{typed}”</h2>
                <p className="empty-line">Try a merchant, a category or an amount like 18.90.</p>
                <button
                  type="button"
                  className="btn btn-sand press"
                  onClick={() => {
                    setShell({ overlay: 'none' });
                    router.push(`/activity?q=${encodeURIComponent(typed)}`);
                  }}
                >
                  <Glyph name="magnify" size={20} />
                  Search Activity for “{typed}”
                </button>
              </div>
            </li>
          )}
        </ul>
        <footer className="palette-foot">
          <span className="keys">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
          </span>
          Move
          <span className="kbd" style={{ marginLeft: 8 }}>
            Enter
          </span>
          Open
          <span style={{ flex: '1 1 auto' }} />
          <span className="kbd">Tab</span>
          <strong style={{ color: 'var(--color-foreground)' }}>Ask Moni</strong>
        </footer>
      </div>
    </div>
  );
}
