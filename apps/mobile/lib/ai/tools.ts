import { tool } from 'ai';
import { z } from 'zod';
import type { CreateTransaction } from '@repo/types';
import type { WalletSeed, CategorySeed } from '@/lib/ai/system-prompt';

export type { WalletSeed, CategorySeed };

export type PendingTransaction = CreateTransaction & {
  walletName: string;
};

export type WalletPickRequest = {
  prompt: string;
  wallets: { id: string; name: string; type: string; currency: string; balance: number }[];
  pendingData: {
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    description?: string | null;
    merchant?: string | null;
    categoryId?: string | null;
    transactionDate?: string;
  };
};

const TAG = '[Moni/Tool]';

/**
 * Creates the set of finance tools for the AI assistant.
 *
 * Wallet and category data are pre-loaded and seeded into the system prompt so
 * the model can call create_transaction in a single step without a get_wallets
 * round-trip.
 *
 * @param wallets     - Pre-loaded wallet list (same data embedded in the system prompt)
 * @param onPropose   - Called when the model proposes a transaction ready for confirmation.
 * @param onPickWallet - Called when wallet is ambiguous; renders an interactive picker in chat.
 */
export function createFinanceTools(
  wallets: WalletSeed[],
  onPropose: (tx: PendingTransaction) => void,
  onPickWallet: (req: WalletPickRequest) => void,
) {
  return {

    create_transaction: tool({
      description:
        'Propose a new transaction for user confirmation. Use an exact wallet ID from the system prompt. A confirmation card will appear — call this tool immediately, output nothing after.',
      inputSchema: z.object({
        walletId: z.string().describe('Exact wallet ID from the wallet list in the system prompt'),
        amount: z.number().positive().describe('Transaction amount — always a positive number'),
        type: z
          .enum(['income', 'expense', 'transfer'])
          .describe('Transaction type: income, expense, or transfer'),
        merchant: z.string().optional().describe('Merchant, app, or payee name'),
        description: z.string().optional().describe('Short note or description'),
        categoryId: z.string().optional().describe('Category ID from the system prompt'),
        transactionDate: z
          .string()
          .optional()
          .describe('ISO 8601 date string; omit to use current time'),
      }),
      execute: async (data) => {
        console.log(TAG, 'create_transaction called with:', JSON.stringify(data, null, 2));
        const wallet = wallets.find((w) => w.id === data.walletId);

        if (!wallet) {
          const available = wallets.map((w) => ({ id: w.id, name: w.name }));
          console.warn(TAG, `create_transaction: walletId "${data.walletId}" not found. Available:`, available);
          return {
            error: `Wallet ID "${data.walletId}" does not exist. Use an ID from the wallet list in the system prompt.`,
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
          walletName: wallet.name,
        };

        console.log(TAG, 'create_transaction: firing onPropose with:', JSON.stringify(pending, null, 2));
        onPropose(pending);
        return { status: 'pending_confirmation' };
      },
    }),

    request_wallet_selection: tool({
      description:
        'Show the user an interactive wallet picker when the correct wallet cannot be determined. Only call this if there are multiple wallets AND the user gave no usable hint about which to use.',
      inputSchema: z.object({
        prompt: z
          .string()
          .describe('One short question for the user, e.g. "Which wallet is this from?"'),
        amount: z.number().positive(),
        type: z.enum(['income', 'expense', 'transfer']),
        merchant: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        categoryId: z.string().optional().nullable(),
        transactionDate: z.string().optional(),
      }),
      execute: async (data) => {
        console.log(TAG, 'request_wallet_selection called:', JSON.stringify(data, null, 2));

        onPickWallet({
          prompt: data.prompt,
          wallets: wallets.map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            currency: w.currency,
            balance: w.balance,
          })),
          pendingData: {
            amount: data.amount,
            type: data.type,
            description: data.description ?? null,
            merchant: data.merchant ?? null,
            categoryId: data.categoryId ?? null,
            transactionDate: data.transactionDate,
          },
        });

        return { status: 'waiting_for_wallet_selection' };
      },
    }),
  };
}
