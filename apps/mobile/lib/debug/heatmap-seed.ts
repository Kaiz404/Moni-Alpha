import { transactions$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import { getWallets, createWallet } from '@/lib/supabase/wallets';
import { createTransaction } from '@/lib/supabase/transactions';
import type { LogFn, DebugTestResult } from './types';

const CLUSTERS = [
  { lat: 3.139, lng: 101.6869, name: 'Kuala Lumpur', count: 24 },
  { lat: 3.0738, lng: 101.5183, name: 'Shah Alam', count: 12 },
  { lat: 3.1073, lng: 101.6067, name: 'Petaling Jaya', count: 16 },
  { lat: 1.4927, lng: 103.7414, name: 'Johor Bahru', count: 8 },
];

async function ensureSeedWallet(): Promise<string> {
  const wallets = await getWallets();
  if (wallets.length > 0) return wallets[0].id;

  const wallet = await createWallet({
    name: 'Heatmap Seed Wallet',
    type: 'cash',
    currency: 'USD',
    initialBalance: 1000,
    color: '#3b82f6',
    icon: 'wallet',
  });
  return wallet.id;
}

export async function seedHeatmapData(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Seeding heatmap test transactions...');
    const userId = await getUserId();
    if (!userId) {
      log('No authenticated user');
      return { success: false, summary: 'Not authenticated' };
    }

    const walletId = await ensureSeedWallet();
    const now = Date.now();
    let inserted = 0;

    for (const cluster of CLUSTERS) {
      for (let i = 0; i < cluster.count; i++) {
        const latJitter = (Math.random() - 0.5) * 0.01;
        const lngJitter = (Math.random() - 0.5) * 0.01;
        const txDate = new Date(now - (inserted + 1) * 3600_000).toISOString();

        await createTransaction({
          walletId,
          amount: 8 + Math.round(Math.random() * 120),
          type: 'expense',
          description: `Heatmap test transaction ${inserted + 1}`,
          merchant: `${cluster.name} Merchant ${i + 1}`,
          notes: 'Seeded for heatmap testing (heatmap-demo)',
          transactionDate: txDate,
          locationLatitude: cluster.lat + latJitter,
          locationLongitude: cluster.lng + lngJitter,
          locationName: cluster.name,
        });

        inserted++;
      }
    }

    log(`Inserted ${inserted} transactions across ${CLUSTERS.length} clusters`);
    return { success: true, summary: `${inserted} transactions seeded` };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Seed failed: ${msg}`);
    return { success: false, summary: `Seed failed: ${msg}` };
  }
}

export async function clearHeatmapSeedData(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Removing seeded heatmap transactions...');
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
      if ((tx.notes ?? '').includes('heatmap-demo')) {
        patchRow(transactions$, tx.id, { deleted: true, updated_at: now });
      }
    }

    log('Seed data cleared');
    return { success: true, summary: 'Heatmap seed data removed' };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Cleanup failed: ${msg}`);
    return { success: false, summary: `Cleanup failed: ${msg}` };
  }
}
