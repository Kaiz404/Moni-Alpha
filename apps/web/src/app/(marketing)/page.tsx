import { mdiEmailOutline } from '@mdi/js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Cat, Wordmark } from '@/components/brand';
import { Fact, SupportEmail } from '@/components/marketing/fact';
import { LandingBento } from '@/components/marketing/landing-bento';
import { LandingFaq } from '@/components/marketing/landing-faq';
import { LandingHero } from '@/components/marketing/landing-hero';
import { LandingMap } from '@/components/marketing/landing-map';
import { LandingPrivacy } from '@/components/marketing/landing-privacy';
import { MdiIcon, StorePill, WEB_APP_HREF, WebButton } from '@/components/marketing/parts';
import { SiteHeader } from '@/components/marketing/site-header';
import { SITE_FACTS, TAGLINE, factText } from '@/lib/site-facts';
import '@/components/marketing/landing.css';

export const metadata: Metadata = {
  title: 'Moni | Know what’s safe to spend, every day',
  description:
    'Type it, snap it, say it, or let Moni read your bank alerts. Moni files each payment and tells you what you can spend today. Android and the web.',
};

/** W2-LandingFinal: the public landing page, static, the same for everyone; a signed-in visitor gets Open Moni. */
export default function LandingPage() {
  return (
    <div className="lp" id="top">
      <SiteHeader />
      <main>
        <LandingHero />
        <LandingBento />
        <LandingMap />
        <LandingPrivacy />
        <LandingFaq />
        <section id="get" aria-labelledby="get-h" className="lp-sec lp-get">
          <div className="lp-get-text">
            <h2 id="get-h" className="lp-get-h">
              Start with
              <br />
              one payment.
            </h2>
            <p className="lp-body">Get Moni on Android, or open it in your browser. It’s the same account on both.</p>
            <div className="lp-actions">
              <StorePill />
              <WebButton />
            </div>
          </div>
          <div className="lp-ctile">
            <Cat mood="happy" size={260} ground="deep" id="lp-closing" />
          </div>
        </section>
      </main>
      <footer className="lp-foot">
        <div className="lp-foot-row">
          <span className="lp-foot-line">{TAGLINE} Moni is not a bank and never moves money.</span>
          <div className="lp-foot-cols">
            <nav className="lp-foot-col" aria-label="Moni">
              <a className="lp-flink" href="#how">
                How it works
              </a>
              <a className="lp-flink" href="#map">
                Map
              </a>
              <Link className="lp-flink" href={WEB_APP_HREF}>
                Open the web app
              </Link>
              {SITE_FACTS.googlePlayUrl.confirmed ? (
                <a className="lp-flink" href={factText('googlePlayUrl')}>
                  Google Play
                </a>
              ) : (
                <span className="lp-flink">
                  Google Play <Fact name="googlePlayUrl" />
                </span>
              )}
            </nav>
            <nav className="lp-foot-col" aria-label="Legal">
              <Link className="lp-flink" href="/privacy">
                Privacy policy
              </Link>
              <Link className="lp-flink" href="/terms">
                Terms
              </Link>
              <Link className="lp-flink" href="/delete-account">
                Delete your account
              </Link>
              <a className="lp-flink" href="#faq">
                FAQ
              </a>
            </nav>
            <div className="lp-foot-col">
              <span className="lp-flink">
                <MdiIcon path={mdiEmailOutline} size={18} />
                <SupportEmail />
              </span>
              <span className="lp-foot-small lp-foot-copy">
                © 2026 <Fact name="legalEntity" />
              </span>
              <span className="lp-foot-small">Google Play is a trademark of Google LLC.</span>
            </div>
          </div>
        </div>
        <div className="lp-bigmark" aria-hidden="true">
          <Wordmark size={380} />
        </div>
      </footer>
    </div>
  );
}
