import { transactions$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import { getWallets, createWallet } from '@/lib/supabase/wallets';
import { createTransaction } from '@/lib/supabase/transactions';
import { getCategories } from '@/lib/supabase/categories';
import type { LogFn, DebugTestResult } from './types';

async function ensureTouchNGOWallet(): Promise<string> {
  const wallets = await getWallets();
  const found = wallets.find((w: any) => {
    const name = (w.name || '').toLowerCase();
    return name === 'touch n go' || name === 'touch n go wallet';
  });
  if (found) return found.id;

  const wallet = await createWallet({
    name: 'Touch n Go',
    type: 'ewallet',
    currency: 'USD',
    initialBalance: 100,
    color: '#f59e0b',
    icon: 'credit-card',
  });

  return wallet.id;
}

export async function seedVisualDemoData(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Seeding visual demo transactions for Touch n Go...');
    const userId = await getUserId();
    if (!userId) {
      log('No authenticated user');
      return { success: false, summary: 'Not authenticated' };
    }

    const walletId = await ensureTouchNGOWallet();
    const now = Date.now();
    const categories = await getCategories();

    let usable = categories.filter((c: any) => !(c.name || '').toLowerCase().includes('other'));
    if (!usable.length) usable = categories;
    if (!usable.length) {
      log('No active categories found');
      return { success: false, summary: 'No active categories available' };
    }

    const total = 160;
    for (let i = 0; i < total; i += 1) {
      const daysAgo = Math.floor(Math.random() * 90);
      const txDate = new Date(now - daysAgo * 24 * 3600_000).toISOString();
      const category = usable[Math.floor(Math.random() * usable.length)];
      const amount = 3 + Math.round(Math.random() * 200);

      await createTransaction({
        walletId,
        amount,
        type: Math.random() > 0.15 ? 'expense' : 'income',
        categoryId: category.id,
        description: `Visual seed ${i + 1}`,
        merchant: `Merchant ${Math.ceil(Math.random() * 40)}`,
        notes: 'Seeded for visual chart demo (visual-seed)',
        transactionDate: txDate,
      });
    }

    log(`Inserted ${total} visual demo transactions into Touch n Go`);
    return { success: true, summary: `${total} visual transactions seeded` };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Visual seed failed: ${msg}`);
    return { success: false, summary: `Seed failed: ${msg}` };
  }
}

export async function clearVisualSeedData(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Removing visual-seed transactions...');
    const userId = await getUserId();
    if (!userId) {
      log('No authenticated user');
      return { success: false, summary: 'Not authenticated' };
    }

    const now = new Date().toISOString();
    for (const tx of getRecordValues<{
      id: string;
      user_id: string | null;
      notes: string | null;
    }>(transactions$)) {
      if (tx.user_id !== userId) continue;
      if ((tx.notes ?? '').includes('visual-seed')) {
        patchRow(transactions$, tx.id, { deleted: true, updated_at: now });
      }
    }

    log('Visual seed data cleared');
    return { success: true, summary: 'Visual seed data removed' };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Cleanup failed: ${msg}`);
    return { success: false, summary: `Cleanup failed: ${msg}` };
  }
}
