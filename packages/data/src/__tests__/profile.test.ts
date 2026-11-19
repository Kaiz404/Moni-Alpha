import { beforeEach, describe, expect, it } from 'vitest';

import { needsSetup, recordAiConsent, updateProfilePreferences } from '../profile';
import { fakeSupabase } from './fake-supabase';

const { server, supabase } = fakeSupabase();

beforeEach(() => {
  server.tables.clear();
  server.offline = false;
  server.userId = 'user-1';
});

describe('updateProfilePreferences', () => {
  it('merges the patch into what is stored and keeps the rest', async () => {
    server.tables.set('profiles', [
      { id: 'user-1', preferences: { currency: 'SGD', theme: 'dark', monthly_budget: 2000 } },
      { id: 'user-2', preferences: { currency: 'USD' } },
    ]);
    const kept = await updateProfilePreferences(supabase, { moni_tone: 'playful', theme: 'light' });

    expect(kept).toEqual({
      currency: 'SGD',
      theme: 'light',
      notifications_enabled: true,
      monthly_budget: 2000,
      moni_tone: 'playful',
    });
    expect(server.tables.get('profiles')).toEqual([
      {
        id: 'user-1',
        preferences: {
          currency: 'SGD',
          theme: 'light',
          notifications_enabled: true,
          monthly_budget: 2000,
          moni_tone: 'playful',
        },
      },
      { id: 'user-2', preferences: { currency: 'USD' } },
    ]);
  });

  it('writes nothing while signed out', async () => {
    server.tables.set('profiles', [{ id: 'user-1', preferences: { currency: 'SGD' } }]);
    server.userId = null;
    await expect(updateProfilePreferences(supabase, { theme: 'dark' })).rejects.toThrow(
      'User ID required',
    );
    expect(server.tables.get('profiles')).toEqual([{ id: 'user-1', preferences: { currency: 'SGD' } }]);
  });
});

describe('recordAiConsent', () => {
  it('appends one row per changed switch at the current notice version', async () => {
    server.tables.set('ai_consents', []);
    await recordAiConsent(supabase, { chat: true, alerts: false });
    expect(server.tables.get('ai_consents')).toEqual([
      { user_id: 'user-1', use: 'chat', granted: true, notice_version: '2026-11-19' },
      { user_id: 'user-1', use: 'alerts', granted: false, notice_version: '2026-11-19' },
    ]);
  });

  it('sends nothing for an empty change', async () => {
    server.tables.set('ai_consents', []);
    server.calls.length = 0;
    await recordAiConsent(supabase, {});
    expect(server.calls).toEqual([]);
  });

  it('asks the user to sign in again when the session is gone', async () => {
    server.tables.set('ai_consents', []);
    server.userId = null;
    await expect(recordAiConsent(supabase, { all: true })).rejects.toThrow(
      'Sign in again, then try once more.',
    );
    expect(server.tables.get('ai_consents')).toEqual([]);
  });

  it('throws what the server refused', async () => {
    server.offline = true;
    await expect(recordAiConsent(supabase, { all: true })).rejects.toEqual({
      message: 'TypeError: Network request failed',
    });
  });
});

describe('needsSetup', () => {
  type Row = Record<string, unknown>;
  const tables = (preferences: Row, wallets: Row[], transactions: Row[]) => {
    server.tables.set('profiles', [{ id: 'user-1', preferences }]);
    server.tables.set('wallets', wallets);
    server.tables.set('transactions', transactions);
  };

  it('sends a brand-new account through set-up', async () => {
    tables({ currency: 'MYR' }, [{ id: 'w-2', user_id: 'user-2' }], []);
    expect(await needsSetup(supabase, 'user-1')).toBe(true);
  });

  it('never again once set-up finished, even with no wallet left', async () => {
    tables({ currency: 'MYR', setup_finished_at: '2026-10-14T07:00:00.000Z' }, [], []);
    expect(await needsSetup(supabase, 'user-1')).toBe(false);
  });

  it('never for an account the phone already filled, a deleted wallet included', async () => {
    tables({ currency: 'MYR' }, [{ id: 'w-1', user_id: 'user-1', deleted: true }], []);
    expect(await needsSetup(supabase, 'user-1')).toBe(false);
    tables({ currency: 'MYR' }, [], [{ id: 't-1', user_id: 'user-1' }]);
    expect(await needsSetup(supabase, 'user-1')).toBe(false);
  });

  it('not when the account cannot be read, so a failed read never shows set-up to an existing account', async () => {
    tables({ currency: 'MYR' }, [], []);
    server.offline = true;
    expect(await needsSetup(supabase, 'user-1')).toBe(false);
  });
});
