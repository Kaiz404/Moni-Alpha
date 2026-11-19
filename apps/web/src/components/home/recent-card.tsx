'use client';

import { merchantName, transactionRow } from '@repo/core';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { useShellApi } from '@/components/shell/shell-context';
import { TxnRow } from '@/components/ledger/txn-row';
import { rowDay } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';

const SHOWN = 5;

/** Recent: the newest five in the main currency (three in the phone layout), each opening its detail. */
export function RecentCard({ ledger }: { ledger: Ledger }) {
  const { run } = useShellApi();
  const { transactions, currency, aliases, projection, walletNames, now, calendar } = ledger;
  const rows = transactions
    .filter((transaction) => transaction.currency === currency)
    .slice(0, SHOWN)
    .map((transaction) =>
      transactionRow(
        { ...transaction, merchant: merchantName(transaction.merchant, aliases) },
        { categoriesById: projection.categoriesById, walletNames },
      ),
    );
  return (
    <section aria-label="Recent" className="card recent-card" data-card="recent">
      <div className="section-head">
        <h2 className="card-title">Recent</h2>
        {rows.length > 0 && (
          <Link href="/activity" className="see-all press">
            See all
            <Icon name="chevron-right" size={18} />
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="tile-empty">
          <span className="tile-empty-icon">
            <Icon name="receipt-text" size={20} />
          </span>
          <strong>No transactions yet</strong>
          <span>Type it, scan a receipt or tell Moni. Your newest show here.</span>
          <button type="button" className="btn btn-ink press" onClick={() => run({ kind: 'add' })}>
            <Icon name="plus" size={20} />
            Add a transaction
            <span className="kbd kbd-on-ink" data-only="sidebar rail rail-one-column">
              N
            </span>
          </button>
        </div>
      ) : (
        <div className="recent-rows">
          {rows.map((row, index) => (
            <TxnRow
              key={row.id}
              row={row}
              href={`/activity/${row.id}`}
              meta={row.kind === 'transfer' ? rowDay(row.date, now, calendar) : `${rowDay(row.date, now, calendar)}, ${row.wallet}`}
              style={{ animationDelay: `${index * 30}ms` }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
