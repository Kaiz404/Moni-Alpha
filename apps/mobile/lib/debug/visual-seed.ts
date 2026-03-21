import { randomUUID } from 'expo-crypto';
import { syncSystem } from '@/lib/powersync/Powersync';
import { getWallets, createWallet } from '@/lib/supabase/wallets';
import type { LogFn, DebugTestResult } from './types';

const VISUAL_SEED_TAG = '{"seedSource":"visual-seed"}';

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
    const { db, supabaseConnector } = syncSystem;
    const userId = await supabaseConnector.getUserId();
    if (!userId) {
      log('No authenticated user');
      return { success: false, summary: 'Not authenticated' };
    }

    const walletId = await ensureTouchNGOWallet();
    const now = Date.now();
    const categories = await db
      .selectFrom('categories')
      .select(['id', 'name'])
      .where('is_active', '=', 1)
      .execute();

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
      const amount = (3 + Math.round(Math.random() * 200)).toString();

      await db
        .insertInto('transactions')
        .values({
          id: randomUUID(),
          user_id: userId,
          wallet_id: walletId,
          amount,
          type: Math.random() > 0.15 ? 'expense' : 'income',
          category_id: category.id,
          transfer_to_wallet_id: null,
          linked_transaction_id: null,
          description: `Visual seed ${i + 1}`,
          merchant: `Merchant ${Math.ceil(Math.random() * 40)}`,
          notes: 'Seeded for visual chart demo',
          transaction_date: txDate,
          location_latitude: null,
          location_longitude: null,
          location_name: null,
          receipt_image_url: null,
          metadata: VISUAL_SEED_TAG,
        })
        .execute();
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
    const { db, supabaseConnector } = syncSystem;
    const userId = await supabaseConnector.getUserId();
    if (!userId) {
      log('No authenticated user');
      return { success: false, summary: 'Not authenticated' };
    }

    await db
      .deleteFrom('transactions')
      .where('user_id', '=', userId)
      .where('metadata', 'like', '%"seedSource":"visual-seed"%')
      .execute();

    log('Visual seed data cleared');
    return { success: true, summary: 'Visual seed data removed' };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Cleanup failed: ${msg}`);
    return { success: false, summary: `Cleanup failed: ${msg}` };
  }
}
