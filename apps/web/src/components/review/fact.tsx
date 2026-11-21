import type { ReactNode } from 'react';
import { Bubble } from '@/components/ledger/glyph';

/** One fact on a review row with its own mark, a category's or a wallet's small bubble, so facts sit side by side with no separator (#119). */
export function Fact({ icon, color, children }: { icon: string | null | undefined; color: string | null | undefined; children: ReactNode }) {
  return (
    <span className="fact">
      <Bubble icon={icon} color={color} size={18} glyph={11} />
      <span className="fact-text">{children}</span>
    </span>
  );
}
