import { planned, type LedgerView, type PlanContext, type Planned } from './types';

/** A wallet goes with every transaction it holds; a transfer into it from another wallet stays. */
export function planWalletDelete(
  walletId: string,
  view: Pick<LedgerView, 'transactionsById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  const transactions = Object.values(view.transactionsById).filter((row) => row.walletId === walletId);
  return planned(
    {
      softDelete: [
        ...transactions.map((row) => ({ table: 'transactions' as const, id: row.id, at: ctx.now })),
        { table: 'wallets', id: walletId, at: ctx.now },
      ],
    },
    null,
  );
}
