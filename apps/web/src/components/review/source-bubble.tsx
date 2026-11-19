import type { FinanceProposal } from '@repo/core';
import { AskMoniMark } from '@/components/brand';
import { Glyph } from '@/components/ledger/glyph';

/** Where a capture came from, as W2-Review draws it: the Lemon bell for a bank alert, the cat for Moni chat, a receipt. */
export function SourceBubble({ capture, size }: { capture: Pick<FinanceProposal, 'id' | 'sourceType'>; size: number }) {
  if (capture.sourceType === 'text') {
    return (
      <span className="source-bubble" data-source="chat" style={{ width: size, height: size }} aria-hidden="true">
        <AskMoniMark size={Math.round(size * 0.62)} onInk id={`src-${capture.id}-${size}`} />
      </span>
    );
  }
  return (
    <span className="source-bubble" data-source={capture.sourceType} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} aria-hidden="true">
      <Glyph name={capture.sourceType === 'notification' ? 'bell' : 'receipt-text-outline'} size={Math.round(size * 0.5)} />
    </span>
  );
}
