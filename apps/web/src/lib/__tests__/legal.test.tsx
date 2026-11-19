import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS } from '@/components/legal/docs';
import { LegalPage } from '@/components/legal/legal-page';
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
    expect(LEGAL_DOCS[kind][lang].sections.map((section) => section.id)).toEqual(ids);
  });

  it('the Malay privacy policy says it is a draft and links the English one', () => {
    const html = renderToStaticMarkup(<LegalPage kind="privacy" lang="ms" />);
    expect(html).toContain('Draf, belum disemak');
    expect(html).toContain('<a hrefLang="en" lang="en" href="/privacy">English</a>');
    expect(html).toContain('<a hrefLang="ms" lang="ms" aria-current="page" href="/privacy/ms">Bahasa Melayu</a>');
    expect(html).toContain('<mark class="confirm" data-confirm="legalEffectiveDate">[CONFIRM: effective date]</mark>');
  });

  it('the English terms link the Malay terms', () => {
    const html = renderToStaticMarkup(<LegalPage kind="terms" lang="en" />);
    expect(html).toContain('Draft, not yet reviewed');
    expect(html).toContain('<a hrefLang="ms" lang="ms" href="/terms/ms">Bahasa Melayu</a>');
  });
});

describe('site facts', () => {
  it('an unconfirmed fact reads as its placeholder', () => {
    expect(factText('supportEmail', 'ms')).toBe('[CONFIRM: support email]');
  });

  it('lists every fact the owner still has to confirm', () => {
    expect(unconfirmedFacts()).toEqual([
      'dataRegion',
      'price',
      'launchCountries',
      'testedBankingApps',
      'supportEmail',
      'domain',
      'legalEntity',
      'googlePlayUrl',
      'postalAddress',
      'aiNoRetention',
      'legalEffectiveDate',
      'governingLaw',
    ]);
  });
});
