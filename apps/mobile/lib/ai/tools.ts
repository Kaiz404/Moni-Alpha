import { tool } from 'ai';
import { z } from 'zod';
import { getWallets } from '@/lib/supabase/wallets';
import { getTransactions } from '@/lib/supabase/transactions';
import { getCategories } from '@/lib/supabase/categories';
import type { CreateTransaction } from '@repo/types';

export type PendingTransaction = CreateTransaction & {
  walletName: string;
};

const TAG = '[Moni/Tool]';

/**
 * Creates the set of finance tools for the AI assistant.
 * @param onPropose - Called when the model proposes a transaction; triggers the confirmation UI
 */
export function createFinanceTools(onPropose: (tx: PendingTransaction) => void) {
  return {
    get_wallets: tool({
      description: "Retrieve the user's wallets with their current balances and IDs",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(TAG, 'get_wallets called');
        try {
          const wallets = await getWallets();
          const result = wallets.map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            currency: w.currency,
            balance: w.currentBalance ?? w.initialBalance,
            icon: w.icon,
          }));
          console.log(TAG, `get_wallets → ${result.length} wallets:`, result.map((w) => `${w.name} (${w.id})`));
          return result;
        } catch (e) {
          console.error(TAG, 'get_wallets error:', e);
          throw e;
        }
      },
    }),

    get_transactions: tool({
      description: 'Retrieve recent transactions to provide spending context',
      inputSchema: z.object({
        walletId: z.string().optional().describe('Filter by wallet ID'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results, default 15'),
      }),
      execute: async ({ walletId, limit = 15 }) => {
        console.log(TAG, 'get_transactions called, walletId:', walletId, 'limit:', limit);
        try {
          const txs = await getTransactions(walletId);
          const result = txs.slice(0, limit).map((t) => ({
            id: t.id,
            amount: t.amount,
            type: t.type,
            merchant: t.merchant,
            description: t.description,
            date: t.transactionDate,
            walletId: t.walletId,
          }));
          console.log(TAG, `get_transactions → ${result.length} transactions`);
          return result;
        } catch (e) {
          console.error(TAG, 'get_transactions error:', e);
          throw e;
        }
      },
    }),

    get_categories: tool({
      description: 'Retrieve available transaction categories',
      inputSchema: z.object({
        type: z
          .enum(['income', 'expense'])
          .optional()
          .describe('Filter by category type'),
      }),
      execute: async ({ type }) => {
        console.log(TAG, 'get_categories called, type:', type);
        try {
          const categories = await getCategories(type);
          const result = categories.map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            type: c.type,
          }));
          console.log(TAG, `get_categories → ${result.length} categories`);
          return result;
        } catch (e) {
          console.error(TAG, 'get_categories error:', e);
          throw e;
        }
      },
    }),

    create_transaction: tool({
      description:
        'Propose a new transaction for user confirmation. You MUST call get_wallets first and use an exact wallet ID from that response. Never invent or guess wallet IDs. The user will see a confirmation card and must tap Confirm to save it.',
      inputSchema: z.object({
        walletId: z.string().describe('Exact wallet ID from get_wallets — never make this up'),
        amount: z.number().positive().describe('Transaction amount — always a positive number'),
        type: z
          .enum(['income', 'expense', 'transfer'])
          .describe('Transaction type: income, expense, or transfer'),
        merchant: z.string().optional().describe('Merchant or payee name'),
        description: z.string().optional().describe('Short note or description'),
        categoryId: z.string().optional().describe('Category ID from get_categories'),
        transactionDate: z
          .string()
          .optional()
          .describe('ISO 8601 date string; omit to use current time'),
      }),
      execute: async (data) => {
        console.log(TAG, 'create_transaction called with:', JSON.stringify(data, null, 2));
        try {
          const wallets = await getWallets();
          const wallet = wallets.find((w) => w.id === data.walletId);

          // Guard: the model hallucinated a wallet ID that doesn't exist.
          // Return an error result (not throw) so the model can see it and
          // self-correct by calling get_wallets on its next step.
          if (!wallet) {
            const available = wallets.map((w) => ({ id: w.id, name: w.name }));
            console.warn(
              TAG,
              `create_transaction: walletId "${data.walletId}" not found. Available:`,
              available,
            );
            return {
              error: `Wallet ID "${data.walletId}" does not exist. You must call get_wallets first and use one of the real IDs listed below.`,
              available_wallets: available,
            };
          }

          const pending: PendingTransaction = {
            walletId: wallet.id,
            amount: data.amount,
            type: data.type,
            merchant: data.merchant ?? null,
            description: data.description ?? null,
            categoryId: data.categoryId ?? null,
            transactionDate: data.transactionDate ?? new Date().toISOString(),
            walletName: wallet.name ?? 'Wallet',
          };

          console.log(TAG, 'create_transaction: firing onPropose with:', JSON.stringify(pending, null, 2));
          onPropose(pending);

          return { status: 'pending_confirmation' };
        } catch (e) {
          console.error(TAG, 'create_transaction error:', e);
          throw e;
        }
      },
    }),
  };
}
