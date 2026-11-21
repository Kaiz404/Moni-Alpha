import { Glyph } from './glyph';
import './ledger.css';

/** Where something moves from and to, with the arrow glyph between: "Maybank", arrow, "Touch 'n Go", read as "Maybank to Touch 'n Go". */
export function FromTo({ from, to }: { from: string; to: string }) {
  return (
    <span className="from-to">
      <span className="sr-only">{`${from} to ${to}`}</span>
      <span aria-hidden="true">{from}</span>
      <Glyph name="arrow-right" size={14} />
      <span aria-hidden="true">{to}</span>
    </span>
  );
}
