import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/account/site-frame';
import { Fact, SupportEmail } from '@/components/marketing/fact';
import type { Lang } from '@/lib/site-facts';
import { LANGS, legalPath, legalPathLang, type Block, type Inline, type LegalKind } from './doc';
import { legalDoc } from './docs';
import './legal.css';

const WORDS: Record<Lang, { updated: string; contents: string; language: string; locale: string }> = {
  en: { updated: 'Last updated', contents: 'Contents', language: 'Language', locale: 'en-GB' },
  ms: { updated: 'Kemas kini terakhir', contents: 'Kandungan', language: 'Bahasa', locale: 'ms-MY' },
};

export function legalMetadata(kind: LegalKind, lang: Lang): Metadata {
  return {
    title: `${legalDoc(kind, lang).title} | Moni`,
    alternates: {
      canonical: legalPath(kind, lang),
      languages: Object.fromEntries(LANGS.map((l) => [l.lang, legalPath(kind, l.lang)])),
    },
  };
}

/** `2026-11-28` as "28 November 2026", or the same in Malay. */
export function formatUpdated(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(WORDS[lang].locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

function Runs({ runs, lang }: { runs: readonly Inline[]; lang: Lang }) {
  return runs.map((run, index) => {
    if (run.kind === 'text') return run.text;
    if (run.kind === 'fact') {
      return run.name === 'supportEmail' ? <SupportEmail key={index} lang={lang} /> : <Fact key={index} name={run.name} lang={lang} />;
    }
    if (!run.href.startsWith('/')) {
      return (
        <a key={index} href={run.href}>
          {run.text}
        </a>
      );
    }
    const linkLang = legalPathLang(run.href);
    const other = linkLang && linkLang !== lang ? linkLang : undefined;
    return (
      <Link key={index} href={run.href} hrefLang={other} lang={other}>
        {run.text}
      </Link>
    );
  });
}

function LegalBlock({ block, lang }: { block: Block; lang: Lang }) {
  switch (block.kind) {
    case 'p':
      return (
        <p>
          <Runs runs={block.content} lang={lang} />
        </p>
      );
    case 'h3':
      return (
        <h3>
          <Runs runs={block.content} lang={lang} />
        </h3>
      );
    case 'ul':
      return (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>
              <Runs runs={item} lang={lang} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <table>
          <thead>
            <tr>
              {block.head.map((cell, index) => (
                <th key={index}>
                  <Runs runs={cell} lang={lang} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, index) => (
                  <td key={index}>
                    <Runs runs={cell} lang={lang} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

/** The privacy policy or the terms in one language, from `docs/legal`, with the switch to the other language. */
export function LegalPage({ kind, lang }: { kind: LegalKind; lang: Lang }) {
  const doc = legalDoc(kind, lang);
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
          <h1 className="site-title">{doc.title}</h1>
          <p className="site-lede">
            <Runs runs={doc.summary} lang={lang} />
          </p>
          <p className="site-small">
            {words.updated}: <time dateTime={doc.updated}>{formatUpdated(doc.updated, lang)}</time>
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
                {section.blocks.map((block, blockIndex) => (
                  <LegalBlock key={blockIndex} block={block} lang={lang} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </article>
    </SiteFrame>
  );
}
