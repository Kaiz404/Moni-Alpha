import type { Lang, SiteFactName } from '@/lib/site-facts';

export type LegalKind = 'privacy' | 'terms';

/** A run of text inside a paragraph, list item or table cell. A fact is a `{{name}}` in the markdown. */
export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'fact'; readonly name: SiteFactName }
  | { readonly kind: 'link'; readonly href: string; readonly text: string };

export type Block =
  | { readonly kind: 'p'; readonly content: readonly Inline[] }
  | { readonly kind: 'h3'; readonly content: readonly Inline[] }
  | { readonly kind: 'ul'; readonly items: readonly (readonly Inline[])[] }
  | { readonly kind: 'table'; readonly head: readonly (readonly Inline[])[]; readonly rows: readonly (readonly (readonly Inline[])[])[] };

export type LegalSection = {
  /** The same in every language, so `#<id>` lands on the same section after the language switch. */
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly Block[];
};

export type LegalDoc = {
  readonly title: string;
  /** One or two sentences under the title: what the document covers, in plain words. */
  readonly summary: readonly Inline[];
  /** The day the text last changed, `YYYY-MM-DD`. */
  readonly updated: string;
  readonly sections: readonly LegalSection[];
};

export const LANGS: readonly { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ms', label: 'Bahasa Melayu' },
];

export function legalPath(kind: LegalKind, lang: Lang): string {
  return lang === 'en' ? `/${kind}` : `/${kind}/${lang}`;
}

/** The language of a legal page's path, so a link to the other language carries `hrefLang`. */
export function legalPathLang(href: string): Lang | null {
  const match = /^\/(?:privacy|terms)(\/ms)?(?:#.*)?$/.exec(href);
  if (!match) return null;
  return match[1] ? 'ms' : 'en';
}
