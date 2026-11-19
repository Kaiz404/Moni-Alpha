import type { Lang } from '@/lib/site-facts';
import type { LegalDoc, LegalKind } from './doc';
import { PRIVACY_EN } from './privacy-en';
import { PRIVACY_MS } from './privacy-ms';
import { TERMS_EN } from './terms-en';
import { TERMS_MS } from './terms-ms';

export const LEGAL_DOCS: Record<LegalKind, Record<Lang, LegalDoc>> = {
  privacy: { en: PRIVACY_EN, ms: PRIVACY_MS },
  terms: { en: TERMS_EN, ms: TERMS_MS },
};
