import { randomUUID } from 'expo-crypto';
import { syncSystem } from '@/lib/powersync/Powersync';
import { getWallets, createWallet } from '@/lib/supabase/wallets';
import type { LogFn, DebugTestResult } from './types';

const CLUSTERS = [
  { lat: 3.139, lng: 101.6869, name: 'Kuala Lumpur', count: 24 },
  { lat: 3.0738, lng: 101.5183, name: 'Shah Alam', count: 12 },
  { lat: 3.1073, lng: 101.6067, name: 'Petaling Jaya', count: 16 },
  { lat: 1.4927, lng: 103.7414, name: 'Johor Bahru', count: 8 },
];

const SEED_TAG = '{"seedSource":"heatmap-demo"}';

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
    const { db, supabaseConnector } = syncSystem;
    const userId = await supabaseConnector.getUserId();
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

        await db
          .insertInto('transactions')
          .values({
            id: randomUUID(),
            user_id: userId,
            wallet_id: walletId,
            amount: (8 + Math.round(Math.random() * 120)).toString(),
            type: 'expense',
            category_id: null,
            transfer_to_wallet_id: null,
            linked_transaction_id: null,
            description: `Heatmap test transaction ${inserted + 1}`,
            merchant: `${cluster.name} Merchant ${i + 1}`,
            notes: 'Seeded for heatmap testing',
            transaction_date: txDate,
            location_latitude: (cluster.lat + latJitter).toFixed(8),
            location_longitude: (cluster.lng + lngJitter).toFixed(8),
            location_name: cluster.name,
            receipt_image_url: null,
            metadata: SEED_TAG,
          })
          .execute();

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
    const { db, supabaseConnector } = syncSystem;
    const userId = await supabaseConnector.getUserId();
    if (!userId) {
      log('No authenticated user');
      return { success: false, summary: 'Not authenticated' };
    }

    await db
      .deleteFrom('transactions')
      .where('user_id', '=', userId)
      .where('metadata', 'like', '%"seedSource":"heatmap-demo"%')
      .execute();

    log('Seed data cleared');
    return { success: true, summary: 'Heatmap seed data removed' };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Cleanup failed: ${msg}`);
    return { success: false, summary: `Cleanup failed: ${msg}` };
  }
}
