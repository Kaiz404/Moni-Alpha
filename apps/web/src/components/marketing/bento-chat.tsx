'use client';

import { mdiArrowRight, mdiCheck, mdiCheckCircle, mdiCloseCircleOutline } from '@mdi/js';
import { useEffect, useRef, useState } from 'react';
import { Cat } from '@/components/brand';
import { MdiIcon } from './parts';

type Decision = 'draft' | 'approved' | 'declined';

const ROWS = [
  { when: 'Yesterday', amount: '−RM45.90' },
  { when: 'Wed 7 Oct', amount: '−RM27.40' },
  { when: 'Sat 3 Oct', amount: '−RM32.80' },
];

const OUTCOME: Record<Exclude<Decision, 'draft'>, { icon: string; text: string }> = {
  approved: { icon: mdiCheckCircle, text: 'Named 3 payments GrabFood. Moni uses the name for new ones too.' },
  declined: { icon: mdiCloseCircleOutline, text: 'Not now. Nothing changed.' },
};

/** Moni chat drafting a rename. Approve and Not now are real buttons; Replay brings the draft back. */
export function BentoChat() {
  const [decision, setDecision] = useState<Decision>('draft');
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const outcome = decision === 'draft' ? null : OUTCOME[decision];

  // The pressed button fades out under the outcome, so focus follows to the outcome line.
  useEffect(() => {
    if (decision !== 'draft') outcomeRef.current?.focus();
  }, [decision]);

  return (
    <div className="bn-chat" data-decision={decision} role="group" aria-label="Sample Moni chat: rename GRAB*FOOD to GrabFood on 3 payments">
      <div className="bn-chat-head" aria-hidden="true">
        <span className="bn-chat-avatar">
          <Cat size={26} ground="dark" id="lp-bento-chat" />
        </span>
        <span className="bn-chat-name">
          Moni chat<span className="bn-ai">AI</span>
        </span>
      </div>
      <span className="bn-cq" aria-hidden="true">
        Call GRAB*FOOD “GrabFood” from now on
      </span>
      <div className="bn-ca">
        <span className="bn-ca-text" aria-hidden="true">
          There are 3 GRAB*FOOD payments this month. This names all of them:
        </span>
        <div className="bn-xf">
          <div className="bn-draft" inert={decision !== 'draft'}>
            <div className="bn-draft-top" aria-hidden="true">
              <span className="bn-draft-caps">
                <span className="caps">Draft merchant name</span>
                <span className="caps bn-draft-count">3 rows</span>
              </span>
              <span className="bn-draft-rename">
                <span className="bn-draft-old">GRAB*FOOD</span>
                <MdiIcon path={mdiArrowRight} size={18} />
                GrabFood
              </span>
            </div>
            {ROWS.map((row) => (
              <div key={row.when} className="bn-drow" aria-hidden="true">
                <b className="bn-drow-name">GRAB*FOOD</b>
                <span className="bn-drow-when">{row.when}</span>
                <b className="num bn-drow-amt">{row.amount}</b>
              </div>
            ))}
            <div className="bn-draft-actions">
              <button type="button" className="btn btn-sand pr" onClick={() => setDecision('declined')}>
                Not now
              </button>
              <button type="button" className="btn btn-ink pr bn-approve" onClick={() => setDecision('approved')}>
                <MdiIcon path={mdiCheck} size={18} />
                Approve
                <span className="kbd kbd-on-ink bn-enter" aria-hidden="true">
                  Enter
                </span>
              </button>
            </div>
          </div>
          <p ref={outcomeRef} className={`bn-outcome bn-outcome-${decision}`} role="status" tabIndex={-1}>
            {outcome && (
              <>
                <MdiIcon path={outcome.icon} size={22} className="bn-outcome-icon" />
                <span>{outcome.text}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
