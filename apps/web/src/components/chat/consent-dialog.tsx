'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Cat } from '@/components/brand';

const WORDS = {
  chat: {
    title: 'Moni chat uses AI',
    lead: "To answer, Moni sends your question and the figures it needs to OpenRouter, an AI service in the US, and the AI model it picks. They don't keep it or train on it.",
    meta: 'Answers can be wrong. Anything Moni drafts waits for your Approve.',
  },
  add: {
    title: 'Ask Moni uses AI',
    lead: "To fill it in, Moni sends what you wrote and your wallet names to OpenRouter, an AI service in the US, and the AI model it picks. They don't keep it or train on it.",
    meta: 'Moni can be wrong. Check what it fills in before you add it.',
  },
} as const;

/**
 * W2-Parts "The first time": before Moni chat's first question, or Ask Moni's first sentence in Add,
 * reaches Moni's AI. Not now keeps that use's AI off, and closing the dialog (Esc, a click outside, or
 * leaving for What Moni sends) counts as Not now.
 */
export function ConsentDialog({ use, onTurnOn, onNotNow }: { use: keyof typeof WORDS; onTurnOn: () => void; onNotNow: () => void }) {
  const words = WORDS[use];
  return createPortal(
    <div
      className="scrim scrim-center chat-consent-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onNotNow()}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onNotNow();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="chat-consent-title" className="dialog motion-grow chat-consent">
        <div className="chat-consent-head">
          <Cat size={44} ground="ink" tile id="chat-consent" />
          <h2 id="chat-consent-title" className="dialog-title">
            {words.title}
          </h2>
          <span className="ai-tag">AI</span>
        </div>
        <p className="chat-consent-lead">{words.lead}</p>
        <p className="meta" style={{ margin: 0 }}>
          {words.meta}
        </p>
        <div className="chat-consent-foot">
          <Link href="/settings/ai" className="link" onClick={onNotNow}>
            What Moni sends
          </Link>
          <span className="chat-consent-actions">
            <button type="button" className="btn btn-sand press" onClick={onNotNow}>
              Not now
            </button>
            <button type="button" className="btn btn-ink press" autoFocus onClick={onTurnOn}>
              Turn on AI
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
