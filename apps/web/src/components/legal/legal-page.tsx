import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/account/site-frame';
import { Fact } from '@/components/marketing/fact';
import { LEGAL_REVIEWED, type Lang } from '@/lib/site-facts';
import { LANGS, legalPath, type LegalKind } from './doc';
import { LEGAL_DOCS } from './docs';
import './legal.css';

const WORDS: Record<Lang, { draft: string; draftNote: string; effective: string; contents: string; language: string }> = {
  en: {
    draft: 'Draft, not yet reviewed',
    draftNote: 'A lawyer has not reviewed this yet, and the marked items are still being confirmed. It may change before Moni launches.',
    effective: 'Takes effect',
    contents: 'Contents',
    language: 'Language',
  },
  ms: {
    draft: 'Draf, belum disemak',
    draftNote: 'Peguam belum menyemak dokumen ini, dan perkara yang ditanda masih menunggu pengesahan. Ia mungkin berubah sebelum Moni dilancarkan.',
    effective: 'Berkuat kuasa',
    contents: 'Kandungan',
    language: 'Bahasa',
  },
};

export function legalMetadata(kind: LegalKind, lang: Lang): Metadata {
  return {
    title: `${LEGAL_DOCS[kind][lang].title} | Moni`,
    alternates: {
      canonical: legalPath(kind, lang),
      languages: Object.fromEntries(LANGS.map((l) => [l.lang, legalPath(kind, l.lang)])),
    },
  };
}

/** The privacy policy or the terms in one language, with the switch to the other and the draft notice. */
export function LegalPage({ kind, lang }: { kind: LegalKind; lang: Lang }) {
  const doc = LEGAL_DOCS[kind][lang];
  const words = WORDS[lang];
  return (
    <SiteFrame>
      <article className="legal" lang={lang}>
        <header className="legal-head">
          <nav className="legal-langs" aria-label={words.language}>
            {LANGS.map((l) => (
              <Link
                key={l.lang}
                href={legalPath(kind, l.lang)}
                hrefLang={l.lang}
                lang={l.lang}
                aria-current={l.lang === lang ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {LEGAL_REVIEWED ? null : (
            <div className="legal-draft" role="note">
              <strong>{words.draft}</strong>
              <span>{words.draftNote}</span>
            </div>
          )}
          <h1 className="site-title">{doc.title}</h1>
          <p className="site-lede">{doc.summary}</p>
          <p className="site-small">
            {words.effective}: <Fact name="legalEffectiveDate" lang={lang} />
          </p>
        </header>
        <div className="legal-columns">
          <nav className="legal-toc" aria-label={words.contents}>
            <span className="caps">{words.contents}</span>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="legal-body">
            {doc.sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`}>
                <h2 id={`${section.id}-h`}>
                  <span className="legal-num">{index + 1}.</span> {section.heading}
                </h2>
                {section.body}
              </section>
            ))}
          </div>
        </div>
      </article>
    </SiteFrame>
  );
}
