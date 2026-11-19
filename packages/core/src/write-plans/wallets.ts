import { minorToDecimal, type CreateWallet } from '@repo/types';

import { planned, type LedgerView, type PlanContext, type Planned } from './types';

/**
 * A new wallet holding its starting balance, confirmed as of now so the check-in waits a while. The
 * answer is its id. `displayOrder` places it in the user's list; the phone adds one at a time at 0.
 */
export function planWalletCreate(
  wallet: CreateWallet,
  ctx: Pick<PlanContext, 'userId' | 'now' | 'newId'>,
  displayOrder = 0,
): Planned<string> {
  const id = ctx.newId();
  return planned(
    {
      insert: [
        {
          table: 'wallets',
          row: {
            id,
            user_id: ctx.userId,
            name: wallet.name,
            type: wallet.type,
            currency: wallet.currency,
            initial_balance: minorToDecimal(wallet.initialBalanceMinor),
            color: wallet.color,
            icon: wallet.icon,
            card_style_id: wallet.cardStyleId,
            notification_package: wallet.notificationPackage ?? null,
            notification_app_label: wallet.notificationAppLabel ?? null,
            notification_account_hint: wallet.notificationAccountHint ?? null,
            balance_confirmed_at: ctx.now,
            is_active: true,
            display_order: displayOrder,
            deleted: false,
          },
        },
      ],
    },
    id,
  );
}

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
