import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { legalDoc } from '@/components/legal/docs';
import { parseLegalMarkdown } from '@/components/legal/markdown';
import { LegalPage, formatUpdated } from '@/components/legal/legal-page';
import { factText, unconfirmedFacts } from '../site-facts';

const PRIVACY_IDS = [
  'who',
  'collect',
  'notifications',
  'ai',
  'why',
  'where',
  'transfers',
  'retention',
  'rights',
  'delete',
  'security',
  'age',
  'selling',
  'changes',
  'contact',
];

const TERMS_IDS = [
  'agreement',
  'age',
  'account',
  'service',
  'no-advice',
  'ai',
  'acceptable-use',
  'your-data',
  'price',
  'availability',
  'ending',
  'liability',
  'law',
  'changes',
  'contact',
];

describe('legal documents', () => {
  it.each([
    ['privacy', 'en', PRIVACY_IDS],
    ['privacy', 'ms', PRIVACY_IDS],
    ['terms', 'en', TERMS_IDS],
    ['terms', 'ms', TERMS_IDS],
  ] as const)('%s in %s has its sections in order', (kind, lang, ids) => {
    expect(legalDoc(kind, lang).sections.map((section) => section.id)).toEqual(ids);
  });

  it('the Malay privacy policy shows its last-updated date and links the English one', () => {
    const html = renderToStaticMarkup(<LegalPage kind="privacy" lang="ms" />);
    const updated = legalDoc('privacy', 'ms').updated;
    expect(html).toContain(`Kemas kini terakhir: <time dateTime="${updated}">${formatUpdated(updated, 'ms')}</time>`);
    expect(html).not.toContain('Draf');
    expect(html).toContain('<a hrefLang="en" lang="en" href="/privacy">English</a>');
    expect(html).toContain('<a hrefLang="ms" lang="ms" aria-current="page" href="/privacy/ms">Bahasa Melayu</a>');
    expect(html).toContain('<mark class="confirm" data-confirm="legalEntity">[CONFIRM: legal entity]</mark>');
  });

  it('the English terms link the Malay terms', () => {
    const html = renderToStaticMarkup(<LegalPage kind="terms" lang="en" />);
    expect(html).toContain('Last updated: <time');
    expect(html).not.toContain('Draft');
    expect(html).toContain('<a hrefLang="ms" lang="ms" href="/terms/ms">Bahasa Melayu</a>');
  });
});

describe('legal markdown', () => {
  const doc = (body: string) => `---\nupdated: 2026-11-28\n---\n\n# Title\n\nSummary with {{legalEntity}}.\n\n${body}`;

  it('reads sections, lists, tables, links and facts', () => {
    const parsed = parseLegalMarkdown(
      doc('## First {#first}\n\nA [link](/terms) and\nmore.\n\n- one\n- two\n  continued\n\n| A | B |\n| --- | --- |\n| x | {{dataRegion}} |'),
    );
    expect(parsed.title).toBe('Title');
    expect(parsed.updated).toBe('2026-11-28');
    expect(parsed.summary).toEqual([
      { kind: 'text', text: 'Summary with ' },
      { kind: 'fact', name: 'legalEntity' },
      { kind: 'text', text: '.' },
    ]);
    expect(parsed.sections).toEqual([
      {
        id: 'first',
        heading: 'First',
        blocks: [
          {
            kind: 'p',
            content: [
              { kind: 'text', text: 'A ' },
              { kind: 'link', text: 'link', href: '/terms' },
              { kind: 'text', text: ' and more.' },
            ],
          },
          { kind: 'ul', items: [[{ kind: 'text', text: 'one' }], [{ kind: 'text', text: 'two continued' }]] },
          {
            kind: 'table',
            head: [[{ kind: 'text', text: 'A' }], [{ kind: 'text', text: 'B' }]],
            rows: [[[{ kind: 'text', text: 'x' }], [{ kind: 'fact', name: 'dataRegion' }]]],
          },
        ],
      },
    ]);
  });

  it.each([
    ['an unknown fact', doc('## A {#a}\n\n{{nope}}'), '{{nope}} is not a site fact'],
    ['a section without an id', doc('## A\n\nText'), 'has no {#id}'],
    ['emphasis it cannot show', doc('## A {#a}\n\n**bold**'), 'unsupported markdown'],
    ['a missing date', '---\n---\n\n# T\n\nS', 'front matter has no `updated`'],
  ])('refuses %s', (_name, source, message) => {
    expect(() => parseLegalMarkdown(source)).toThrow(message);
  });
});

describe('site facts', () => {
  it('an unconfirmed fact reads as its placeholder', () => {
    expect(factText('supportEmail', 'ms')).toBe('[CONFIRM: support email]');
  });

  it('lists every fact the owner still has to confirm', () => {
    expect(unconfirmedFacts()).toEqual([
      'price',
      'launchCountries',
      'testedBankingApps',
      'supportEmail',
      'domain',
      'legalEntity',
      'googlePlayUrl',
      'statusPage',
      'postalAddress',
      'aiNoRetention',
      'requestLogRetention',
      'backupRetention',
      'traceRetention',
      'governingLaw',
    ]);
  });
});
