import { Glyph } from '@/components/ledger/glyph';

/** A row of the set-up cards: an icon in a Sand circle, a bold line and a meta line under it. */
export function Item({ icon, title, line, tone }: { icon: string; title: string; line: string; tone?: 'mint' }) {
  return (
    <div className="setup-li" data-tone={tone}>
      <span className="setup-ic">
        <Glyph name={icon} size={20} />
      </span>
      <span className="setup-li-text">
        <b>{title}</b>
        <span>{line}</span>
      </span>
    </div>
  );
}

