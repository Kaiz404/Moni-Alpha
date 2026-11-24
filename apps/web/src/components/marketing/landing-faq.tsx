import { mdiChevronDown } from '@mdi/js';
import type { ReactNode } from 'react';
import { Fact, SupportEmail } from './fact';
import { LandingH2, MdiIcon } from './parts';
import './faq.css';

/** `hidden` questions wait for an answer the owner hasn't confirmed; they stay in the page, unrendered. */
const QUESTIONS: readonly { q: string; a: ReactNode; open?: boolean; hidden?: boolean }[] = [
  {
    q: 'Which banks does Moni work with?',
    a: (
      <>
        Any bank, card or e-wallet, because you can type, snap or say any payment. On Android, Moni can also read the payment alerts from
        the banking and wallet apps you pick.<span hidden> Tested so far with <Fact name="testedBankingApps" />.</span>
      </>
    ),
  },
  { q: 'What does it cost?', a: <Fact name="price" />, hidden: true },
  {
    q: 'What does the AI see?',
    a: (
      <>
        Only what it needs for what you asked: the words of a payment alert, a receipt photo, what you said, or your question in Moni chat
        with a summary of your spending to answer it. Moni asks before the first time. The AI providers keep none of it and never train on it.
      </>
    ),
    open: true,
  },
  {
    q: 'Where can I get Moni?',
    a: (
      <>
        On the web in any browser, today. The Android app is coming soon, with the same account on both. Reading bank alerts will need
        the Android app.
      </>
    ),
  },
];

export function LandingFaq() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="lp-sec fq-sec">
      <div className="fq-side">
        <LandingH2 id="faq-h">Questions</LandingH2>
        <p className="lp-body fq-write" hidden>
          Something else? Write to <SupportEmail className="fq-mail" />
        </p>
      </div>
      <div className="fq-list">
        {QUESTIONS.map(({ q, a, open, hidden }) => (
          <details key={q} className="fq-item" open={open} hidden={hidden}>
            <summary className="fq-q">
              <span>{q}</span>
              <span className="fq-chev" aria-hidden="true">
                <MdiIcon path={mdiChevronDown} size={24} />
              </span>
            </summary>
            <p className="lp-body fq-a">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
