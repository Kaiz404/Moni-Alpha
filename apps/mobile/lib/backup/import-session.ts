import { planImport, type ImportPlan, type ImportSession } from '@repo/core';
import { applyPlan, readStoreSnapshot, storeHasPulled, type ApplyProgress } from '@repo/data';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { deviceCalendar } from '@/lib/dates/device-calendar';
import { store } from '@/lib/store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';

/** The file between its pages. Too large for route params, and worth nothing once the import ends. */
let session: ImportSession | null = null;

export const getImportSession = () => session;
export const setImportSession = (next: ImportSession | null) => {
  session = next;
};

/** Opens Android's file picker; null when the user backs out. */
export async function pickFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return null;
  return { name: picked.result.name, bytes: await picked.result.bytes() };
}

/** Whether every table has pulled since the app opened; before that, an import takes missing rows for new. */
export const importReady = () => storeHasPulled(store);

/** What the file would do to the store on this phone right now. */
export function planImportNow(current: ImportSession, userId: string): ImportPlan | null {
  return planImport(current, readStoreSnapshot(store), {
    userId,
    aliases: listMerchantAliases(userId),
    calendar: deviceCalendar,
  });
}

export function applyImport(plan: ImportPlan, onProgress: (progress: ApplyProgress) => void): Promise<number> {
  return applyPlan(store, plan, { newId: randomUUID, onProgress });
}
