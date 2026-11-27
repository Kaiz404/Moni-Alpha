'use client';

import { dayHeading, suggestTargetName } from '@repo/core';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { AskMoniMark, Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Glyph } from '@/components/ledger/glyph';
import { ResizeHandle, useRootWidth, useStoredSize } from '@/components/ledger/resize-handle';
import { useShellApi } from '@/components/shell/shell-context';
import { setShell, useShell } from '@/components/shell/shell-store';
import { activityItems } from '@/lib/activity-items';
import { parseActivityQuery } from '@/lib/activity-query';
import { lookingAt, type ChatMessage } from '@/lib/chat-thread';
import { destinationOf } from '@/lib/nav';
import { PANE_SPANS } from '@/lib/sizes';
import { useLedger } from '@/lib/ledger/use-ledger';
import { AnswerCardView } from './answer-card';
import { ask, notNowForChat, turnOnAndAnswer, type AskFrom } from './ask';
import { answerBudgetStep } from './budget-ask';
import { BudgetDraftCard } from './budget-draft-card';
import { ConsentDialog } from './consent-dialog';
import { DraftCard } from './draft-card';
import './chat.css';

/** W2-Empty's three starters: each fills the box and waits for Enter. */
const STARTERS = [
  { icon: 'silverware-fork-knife', title: 'Log a lunch', words: '12.50 at Mamak Ali' },
  { icon: 'calendar-blank', title: 'Set a budget', words: 'RM450 for food' },
  { icon: 'chat-question-outline', title: 'Ask Moni', words: 'What can you do?' },
] as const;

function Typing() {
  return (
    <span role="img" aria-label="Moni is writing" className="chat-typing">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="chat-coin" style={{ animationDelay: `${dot * 120}ms` }} />
      ))}
    </span>
  );
}

function MoniTurn({ id, mood = 'neutral', children }: { id: string; mood?: 'neutral' | 'thinking'; children: React.ReactNode }) {
  return (
    <div className="chat-moni">
      <Cat size={30} ground="ink" tile mood={mood} id={`turn-${id}`} />
      <div className="chat-moni-body">{children}</div>
    </div>
  );
}

/** `open`: the thread's last message, so a budget question still takes its choices. */
function Message({ message, from, open }: { message: ChatMessage; from: AskFrom; open: boolean }) {
  const { run } = useShellApi();
  if (message.role === 'user')
    return (
      <div className="chat-me">
        <p className="chat-bubble chat-bubble-me">{message.text}</p>
      </div>
    );
  switch (message.kind) {
    case 'thinking':
      return (
        <MoniTurn id={message.id} mood="thinking">
          <div className="chat-bubble chat-bubble-moni">
            <Typing />
          </div>
          <span className="meta">Looking at your month</span>
        </MoniTurn>
      );
    case 'text':
      return (
        <MoniTurn id={message.id}>
          <p className="chat-bubble chat-bubble-moni" data-tone={message.tone}>
            {message.text}
          </p>
        </MoniTurn>
      );
    case 'card':
      return (
        <MoniTurn id={message.id}>
          <AnswerCardView message={message} ledger={from.ledger} />
        </MoniTurn>
      );
    case 'draft':
      return (
        <MoniTurn id={message.id}>
          <p className="chat-bubble chat-bubble-moni">{message.intro}</p>
          <DraftCard message={message} ledger={from.ledger} />
        </MoniTurn>
      );
    case 'add':
      return (
        <MoniTurn id={message.id}>
          <div className="chat-bubble chat-bubble-moni">
            <p style={{ margin: 0 }}>Moni chat on the web answers questions and changes rows. To add a spend, use Add.</p>
            <button
              type="button"
              className="btn btn-sand press chat-add"
              onClick={() => {
                setShell({ addDraft: message.text });
                run({ kind: 'add', mode: 'ask' });
              }}
            >
              Open Add with this
              <span className="kbd">N</span>
            </button>
          </div>
        </MoniTurn>
      );
    case 'budget_pick':
    case 'budget_question': {
      const choices = message.kind === 'budget_pick' ? message.targets.map(suggestTargetName) : message.choices;
      return (
        <MoniTurn id={message.id}>
          <p className="chat-bubble chat-bubble-moni">{message.text}</p>
          {open && choices.length > 0 && (
            <div className="chat-choices" role="group" aria-label="Answers">
              {choices.map((choice) => (
                <button key={choice} type="button" className="chat-choice press" onClick={() => void answerBudgetStep(message, choice, from.ledger)}>
                  {choice}
                </button>
              ))}
            </div>
          )}
        </MoniTurn>
      );
    }
    case 'budget_draft':
      return (
        <MoniTurn id={message.id}>
          <BudgetDraftCard message={message} ledger={from.ledger} />
        </MoniTurn>
      );
  }
}

/**
 * W2-Chat: Moni chat docked beside the current view, knowing what it shows. The thread and the
 * half-typed message live in the shell store, so crossing 700 wide (the pushed chat page) keeps both.
 */
export function ChatPane() {
  const { user, run } = useShellApi();
  const { chat, chatDraft, chatAsk, ticked } = useShell();
  const ledger = useLedger();
  const pathname = usePathname();
  const params = useSearchParams();
  const thread = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const onActivity = destinationOf(pathname) === 'activity';
  const query = useMemo(() => (onActivity ? parseActivityQuery(new URLSearchParams(params.toString())) : null), [onActivity, params]);
  const items = useMemo(() => activityItems(ledger), [ledger]);
  const context = lookingAt(pathname, new URLSearchParams(params.toString()), onActivity ? ticked.length : 0, {
    category: (id) => ledger.projection.categoriesById[id]?.name,
    row: (id) => items.find((item) => item.id === id)?.title,
  });
  const from: AskFrom = {
    ledger,
    query,
    ticked: onActivity ? ticked : [],
    viewCategoryId: query?.categories.length === 1 ? query.categories[0]! : null,
  };

  useEffect(() => {
    const body = thread.current;
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  }, [chat.length]);

  const send = () => {
    if (!chatDraft.trim() || !ledger.loaded) return;
    setShell({ chatDraft: '' });
    void ask(chatDraft, from);
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };
  const fill = (words: string) => {
    setShell({ chatDraft: words });
    box.current?.focus();
  };
  const first = chat.length === 0;
  const waitingOnBudget = chat.some((message) => message.id === chatAsk && message.role === 'user' && message.budget);
  const [width, setWidth] = useStoredSize('pane-chat', PANE_SPANS.chat);
  useRootWidth('--chat-pane-width', width, true);
  const today = ledger.mounted ? ledger.calendar.dayKey(ledger.now) : null;

  return (
    <>
    <aside className="pane pane-chat motion-slide" aria-label="Moni chat" data-pane="chat">
      <header className="pane-head chat-head">
        <button type="button" className="back-button press" data-only="phone" onClick={() => run({ kind: 'closePane' })} aria-label="Back">
          <Icon name="chevron-left" size={22} />
        </button>
        <Cat size={40} ground="ink" tile id="chat-head" />
        <div className="chat-title">
          <h2 className="pane-title">
            Moni chat <span className="ai-tag">AI</span>
          </h2>
          <span className="chat-context" data-testid="chat-context">
            <Icon name="eye-outline" size={14} />
            <span>Looking at {context}</span>
          </span>
        </div>
        <button
          type="button"
          className="pane-close press"
          data-only="sidebar rail rail-one-column"
          onClick={() => run({ kind: 'closePane' })}
          aria-label="Close Moni chat"
        >
          <Icon name="close" size={20} />
          <span className="kbd">Esc</span>
        </button>
      </header>
      <div className="pane-body chat-thread" ref={thread} aria-live="polite">
        {first ? (
          <div className="chat-hello">
            <span>Hi {user.name}.</span>
            <span className="chat-hello-ask">What did you spend?</span>
          </div>
        ) : (
          <>
            {today && <span className="caps chat-day">{dayHeading(today, today)}</span>}
            {chat.map((message, index) => (
              <Message key={message.id} message={message} from={from} open={index === chat.length - 1} />
            ))}
          </>
        )}
      </div>
      <form
        className="pane-foot chat-foot"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        {first && (
          <div className="chat-starters">
            {STARTERS.map((starter) => (
              <button type="button" key={starter.title} className="chat-starter press" onClick={() => fill(starter.words)}>
                <span className="chat-starter-icon">
                  <Glyph name={starter.icon} size={17} />
                </span>
                <span className="chat-starter-title">{starter.title}</span>
                <span className="chat-starter-words">{starter.words}</span>
              </button>
            ))}
          </div>
        )}
        <div className="composer chat-composer">
          <AskMoniMark size={22} id="chat-box" />
          <textarea
            ref={box}
            aria-label="Ask or add a transaction"
            placeholder={onActivity ? 'Ask about these rows' : 'Ask or add a transaction'}
            rows={1}
            value={chatDraft}
            onChange={(event) => setShell({ chatDraft: event.target.value })}
            onKeyDown={onKey}
          />
          <button type="submit" className="composer-send press" aria-label="Send" disabled={!chatDraft.trim()}>
            <Icon name="arrow-up" size={20} />
          </button>
        </div>
        {first && <span className="meta chat-note">Moni chat uses AI and can get things wrong. Nothing is saved until you approve it.</span>}
      </form>
      {chatAsk && <ConsentDialog use={waitingOnBudget ? 'budget' : 'chat'} onTurnOn={() => void turnOnAndAnswer(from)} onNotNow={() => void notNowForChat()} />}
    </aside>
    <ResizeHandle label="Resize Moni chat" span={PANE_SPANS.chat} value={width} grows="left" sizes="previous" onChange={setWidth} className="pane-resize" />
    </>
  );
}
