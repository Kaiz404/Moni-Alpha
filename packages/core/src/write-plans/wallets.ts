import { minorToDecimal, type CreateWallet } from '@repo/types';

import { planned, refused, type LedgerView, type PlanContext, type Planned } from './types';

/**
 * A new wallet holding its starting balance, confirmed as of now so the check-in waits a while. The
 * answer is its id. `displayOrder` places it in the user's list: `nextWalletOrder` puts it last.
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

export type WalletEdit = { name: string; type: CreateWallet['type']; color: string; icon: string; cardStyleId: string };

/** Edit wallet's Save changes. A wallet keeps its currency, and its balance moves only by a correction. */
export function planWalletEdit(
  walletId: string,
  edit: WalletEdit,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  if (!view.walletsById[walletId]) return refused('Wallet not found');
  return planned(
    {
      patch: [
        {
          table: 'wallets',
          id: walletId,
          patch: { name: edit.name, type: edit.type, color: edit.color, icon: edit.icon, card_style_id: edit.cardStyleId, updated_at: ctx.now },
        },
      ],
    },
    null,
  );
}

/** The display order that puts a new wallet after every wallet the user already arranged. */
export function nextWalletOrder(view: Pick<LedgerView, 'walletsById'>): number {
  return Object.values(view.walletsById).reduce((last, wallet) => Math.max(last, wallet.displayOrder + 1), 0);
}

/** Reorder: numbers the wallets in `order` from 0, writing only those whose place changed. */
export function planWalletOrder(
  order: readonly string[],
  view: Pick<LedgerView, 'walletsById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  return planned(
    {
      patch: order.flatMap((id, index) => {
        const wallet = view.walletsById[id];
        if (!wallet || wallet.displayOrder === index) return [];
        return [{ table: 'wallets' as const, id, patch: { display_order: index, updated_at: ctx.now } }];
      }),
    },
    null,
  );
}
