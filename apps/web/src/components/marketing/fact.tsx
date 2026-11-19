import './fact.css';
import { SITE_FACTS, factText, type Lang, type SiteFactName } from '@/lib/site-facts';

/** A fact from site-facts: its words once confirmed, a marked "[CONFIRM: …]" placeholder until then. */
export function Fact({ name, lang = 'en' }: { name: SiteFactName; lang?: Lang }) {
  if (SITE_FACTS[name].confirmed) return <>{factText(name, lang)}</>;
  return (
    <mark className="confirm" data-confirm={name}>
      {factText(name, lang)}
    </mark>
  );
}

/** The support address, a mailto link once confirmed. */
export function SupportEmail({ lang = 'en', className }: { lang?: Lang; className?: string }) {
  if (!SITE_FACTS.supportEmail.confirmed) return <Fact name="supportEmail" lang={lang} />;
  const email = factText('supportEmail', lang);
  return (
    <a className={className} href={`mailto:${email}`}>
      {email}
    </a>
  );
}
