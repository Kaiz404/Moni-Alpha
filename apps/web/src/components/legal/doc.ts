import type { ReactNode } from 'react';
import type { Lang } from '@/lib/site-facts';

export type LegalKind = 'privacy' | 'terms';

export type LegalSection = {
  /** The same in every language, so `#<id>` lands on the same section after the language switch. */
  readonly id: string;
  readonly heading: string;
  readonly body: ReactNode;
};

export type LegalDoc = {
  readonly title: string;
  /** One or two sentences under the title: what the document covers, in plain words. */
  readonly summary: ReactNode;
  readonly sections: readonly LegalSection[];
};

export const LANGS: readonly { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ms', label: 'Bahasa Melayu' },
];

export function legalPath(kind: LegalKind, lang: Lang): string {
  return lang === 'en' ? `/${kind}` : `/${kind}/${lang}`;
}
