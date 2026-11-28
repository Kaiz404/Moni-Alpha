import privacyEn from '../../../../../docs/legal/privacy.en.md';
import privacyMs from '../../../../../docs/legal/privacy.ms.md';
import termsEn from '../../../../../docs/legal/terms.en.md';
import termsMs from '../../../../../docs/legal/terms.ms.md';
import type { Lang } from '@/lib/site-facts';
import type { LegalDoc, LegalKind } from './doc';
import { parseLegalMarkdown } from './markdown';

/** The legal texts, from `docs/legal`: one source for these pages and the store listings, bundled at build time. */
const LEGAL_DOCS: Record<LegalKind, Record<Lang, LegalDoc>> = {
  privacy: {
    en: parseLegalMarkdown(privacyEn, 'docs/legal/privacy.en.md'),
    ms: parseLegalMarkdown(privacyMs, 'docs/legal/privacy.ms.md'),
  },
  terms: {
    en: parseLegalMarkdown(termsEn, 'docs/legal/terms.en.md'),
    ms: parseLegalMarkdown(termsMs, 'docs/legal/terms.ms.md'),
  },
};

export function legalDoc(kind: LegalKind, lang: Lang): LegalDoc {
  return LEGAL_DOCS[kind][lang];
}
