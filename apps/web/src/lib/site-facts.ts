/**
 * Every fact on the public site that the owner still has to confirm, in one place. The landing page, the
 * privacy policy and the terms read them from here, so confirming one is one edit: replace its `confirm(…)`
 * with `fact('…')` (or `fact('English', 'Malay')` when the words differ by language).
 */

export type Lang = 'en' | 'ms';

export type SiteFact =
  | { readonly confirmed: true; readonly text: Readonly<Record<Lang, string>> }
  /** Shown on the page as a marked "[CONFIRM: …]" placeholder until the owner fills it in. */
  | { readonly confirmed: false; readonly label: string };

export function fact(en: string, ms: string = en): SiteFact {
  return { confirmed: true, text: { en, ms } };
}

function confirm(label: string): SiteFact {
  return { confirmed: false, label };
}

export const SITE_FACTS = {
  /** The Supabase project's region, where the database and receipt photos live. */
  dataRegion: confirm('data region'),
  price: confirm('price'),
  launchCountries: confirm('launch countries'),
  /** The banking apps whose alerts Moni has been tested on. */
  testedBankingApps: confirm('tested banking apps'),
  supportEmail: confirm('support email'),
  /** The public site's origin, for example https://moni.example. */
  domain: confirm('domain'),
  /** The company or person that runs Moni and is the data controller. */
  legalEntity: confirm('legal entity'),
  /** The Play Store listing, https://play.google.com/store/apps/details?id=<package>; the package is still a placeholder. */
  googlePlayUrl: confirm('Google Play link'),
  /** The public status page the 404, 500 and maintenance pages link to as Moni status. */
  statusPage: confirm('Moni status page'),
  /** The legal entity's postal address, for the privacy policy's contact section. */
  postalAddress: confirm('postal address'),
  /** The AI providers' retention terms, as OpenRouter's zero-data-retention routing promises them. */
  aiNoRetention: confirm('AI providers keep nothing and never train on it'),
  /** The date the privacy policy and terms take effect. */
  legalEffectiveDate: confirm('effective date'),
  /** Whose courts and law the terms name. */
  governingLaw: confirm('governing law'),
} as const satisfies Record<string, SiteFact>;

export type SiteFactName = keyof typeof SITE_FACTS;

/** The footer's line. An open owner decision: it was flagged as a soft phrase (docs/WEB.md). */
export const TAGLINE = 'Money, sorted kindly.';

/** False until a lawyer has reviewed the privacy policy and terms; the pages say "Draft, not yet reviewed". */
export const LEGAL_REVIEWED = false;

/** The words a fact reads as, or its "[CONFIRM: …]" placeholder. */
export function factText(name: SiteFactName, lang: Lang = 'en'): string {
  const value: SiteFact = SITE_FACTS[name];
  return value.confirmed ? value.text[lang] : `[CONFIRM: ${value.label}]`;
}

/** Every fact still waiting for the owner. */
export function unconfirmedFacts(): SiteFactName[] {
  return (Object.keys(SITE_FACTS) as SiteFactName[]).filter((name) => !SITE_FACTS[name].confirmed);
}
