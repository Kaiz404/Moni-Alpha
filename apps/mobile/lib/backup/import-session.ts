import { planImport, type ImportPlan, type ImportSession } from '@repo/core';
import { File } from 'expo-file-system';

import { deviceCalendar } from '@/lib/dates/device-calendar';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';

import { readStoreSnapshot } from './store-tables';

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

/** What the file would do to the store on this phone right now. */
export function planImportNow(current: ImportSession, userId: string): ImportPlan | null {
  return planImport(current, readStoreSnapshot(), {
    userId,
    aliases: listMerchantAliases(userId),
    calendar: deviceCalendar,
  });
}
