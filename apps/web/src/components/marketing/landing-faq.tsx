import { mdiChevronDown } from '@mdi/js';
import type { ReactNode } from 'react';
import { Fact, SupportEmail } from './fact';
import { LandingH2, MdiIcon } from './parts';
import './faq.css';

const QUESTIONS: readonly { q: string; a: ReactNode; open?: boolean }[] = [
  {
    q: 'Which banks does Moni work with?',
    a: (
      <>
        Any bank, card or e-wallet, because you can type, snap or say any payment. On Android, Moni can also read the payment alerts from
        the banking and wallet apps you pick. Tested so far with <Fact name="testedBankingApps" />.
      </>
    ),
  },
  { q: 'What does it cost?', a: <Fact name="price" /> },
  {
    q: 'What does the AI see?',
    a: (
      <>
        Only what it needs for what you asked: the words of a payment alert, a receipt photo, what you said, or your question in Moni chat
        with a summary of your spending to answer it. Moni asks before the first time. <Fact name="aiNoRetention" />
      </>
    ),
    open: true,
  },
  {
    q: 'Where can I get Moni?',
    a: (
      <>
        On Google Play in <Fact name="launchCountries" />, and on the web in any browser. It’s the same account on both. Reading bank
        alerts needs the Android app.
      </>
    ),
  },
];

export function LandingFaq() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="lp-sec fq-sec">
      <div className="fq-side">
        <LandingH2 id="faq-h">Questions</LandingH2>
        <p className="lp-body fq-write">
          Something else? Write to <SupportEmail className="fq-mail" />
        </p>
      </div>
      <div className="fq-list">
        {QUESTIONS.map(({ q, a, open }) => (
          <details key={q} className="fq-item" open={open}>
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
