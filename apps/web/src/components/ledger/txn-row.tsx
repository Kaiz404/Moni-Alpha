import type { TransactionRow } from '@repo/core';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { rowAmount } from '@/lib/ledger/format';
import { Bubble } from './glyph';

/** The phone's transaction row (tokens.md Lists and rows): bubble, title, meta, amount; no chevron. */
export function TxnRow({
  row,
  meta,
  href,
  style,
  lead,
}: {
  row: TransactionRow;
  meta: ReactNode;
  href: string;
  style?: CSSProperties;
  lead?: ReactNode;
}) {
  const amount = rowAmount(row);
  return (
    <Link href={href} className="txn-row rise" style={style} data-row={row.id}>
      {lead}
      <Bubble icon={row.icon} color={row.color} />
      <span className="row-text">
        <span className="row-title">{row.title}</span>
        <span className="row-meta">
          {row.autoAdded && <span className="auto-pill">Auto</span>}
          <span className="row-meta-text">{meta}</span>
        </span>
      </span>
      <span className="num txn-amount" data-tone={amount.tone}>
        {amount.text}
      </span>
    </Link>
  );
}
