import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { observe, syncState, when } from '@legendapp/state';
import { isLiveRow } from '@repo/core';
import type { Database } from '@repo/types/database';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { createWebStore } from '../moni-store';

const repo = fileURLToPath(new URL('../../../../..', import.meta.url));

/** The dev project and the e2e user, from this checkout's `.env.e2e` or the main checkout's. */
function e2eEnv(): Record<string, string> | null {
  const list = execFileSync('git', ['-C', repo, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  const main = /^worktree (.+)$/m.exec(list)?.[1];
  const env: Record<string, string> = {};
  for (const root of [repo, main]) {
    const file = root && join(root, 'apps/mobile/.env.e2e');
    if (!file || !existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
      if (match?.[1] && !(match[1] in env)) env[match[1]] = (match[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
  const keys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'E2E_EMAIL', 'E2E_PASSWORD'];
  return keys.every((key) => env[key]) ? env : null;
}

const env = e2eEnv();
const supabase = env
  ? createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

afterAll(async () => {
  await supabase?.removeAllChannels();
  await supabase?.auth.signOut({ scope: 'local' });
});

describe.skipIf(!supabase)('the web store against the dev project', () => {
  it('pulls the e2e user’s wallets', { timeout: 30_000 }, async () => {
    const client = supabase!;
    const { error } = await client.auth.signInWithPassword({ email: env!.E2E_EMAIL!, password: env!.E2E_PASSWORD! });
    expect(error).toBeNull();
    const { data: server } = await client.from('wallets').select('id').eq('deleted', false);

    const store = createWebStore(client);
    store.all.forEach((table$) => observe(() => table$.get()));
    store.authReady$.set(true);
    await store.enableStoreSync({ fullReset: true });
    await when(() => syncState(store.wallets$).isLoaded.get());

    const held = Object.values(store.wallets$.peek() ?? {}).filter(isLiveRow).map((row) => row.id);
    expect(held.sort()).toEqual((server ?? []).map((row) => row.id).sort());
  });
});
