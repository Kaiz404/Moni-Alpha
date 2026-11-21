import { beforeEach, describe, expect, it } from 'vitest';

import { createRowGateway } from '../gateway';
import { fakeSupabase } from './fake-supabase';

const { server, supabase } = fakeSupabase();
const gateway = createRowGateway(supabase);

beforeEach(() => {
  server.tables.clear();
  server.calls.length = 0;
});

describe('a write queued before the palette change', () => {
  it('updates with the current colour', async () => {
    server.tables.set('categories', [{ id: 'c1', name: 'Food', color: '#FB7F77' }]);
    const result = await gateway.update('categories', { id: 'c1', name: 'Food', color: '#F3B6B2' });
    expect(result).toEqual({ ok: true, row: { id: 'c1', name: 'Food', color: '#FB7F77' } });
  });

  it('creates with the current colour', async () => {
    server.tables.set('wallets', []);
    await gateway.createOrRevive('wallets', { id: 'w1', name: 'Cash', color: '#F3B6B2' });
    expect(server.tables.get('wallets')).toEqual([{ id: 'w1', name: 'Cash', color: '#FB7F77' }]);
  });

  it('leaves a table without colours alone', async () => {
    server.tables.set('debts', []);
    await gateway.createOrRevive('debts', { id: 'd1', color: '#F3B6B2' });
    expect(server.tables.get('debts')).toEqual([{ id: 'd1', color: '#F3B6B2' }]);
  });
});

describe('a create that clashes with a live row of the same id', () => {
  it('takes a newer version: an Undo that lands before the insert returns still deletes the row', async () => {
    server.tables.set('transactions', [{ id: 't1', deleted: false, updated_at: '2026-11-20T02:35:48.751745+00:00' }]);
    await gateway.createOrRevive('transactions', { id: 't1', deleted: true, updated_at: '2026-11-20T02:35:49.000Z' });
    expect(server.tables.get('transactions')).toEqual([{ id: 't1', deleted: true, updated_at: '2026-11-20T02:35:49.000Z' }]);
  });

  it('leaves the server row when the queued create is older or carries no time', async () => {
    server.tables.set('transactions', [{ id: 't1', deleted: false, note: 'kept', updated_at: '2026-11-20T02:35:48.000Z' }]);
    await gateway.createOrRevive('transactions', { id: 't1', deleted: false, note: 'stale', updated_at: '2026-11-19T00:00:00.000Z' });
    await gateway.createOrRevive('transactions', { id: 't1', deleted: false, note: 'untimed' });
    expect(server.tables.get('transactions')).toEqual([{ id: 't1', deleted: false, note: 'kept', updated_at: '2026-11-20T02:35:48.000Z' }]);
  });
});

describe('the row gateway', () => {
  it('soft-deletes instead of deleting', async () => {
    server.tables.set('transactions', [{ id: 't1', deleted: false }]);
    await gateway.softDelete('transactions', 't1');
    expect(server.tables.get('transactions')).toEqual([{ id: 't1', deleted: true }]);
  });

  it('says a refusal is final and a lost request is worth retrying', async () => {
    expect(await gateway.update('wallets', { id: 'w1' })).toEqual({
      ok: false,
      message: "Could not find the table 'public.wallets' in the schema cache",
      retryable: false,
    });
    server.offline = true;
    expect(await gateway.list('wallets')).toEqual({
      ok: false,
      message: 'TypeError: Network request failed',
      retryable: true,
    });
    server.offline = false;
  });

  it('tries again after a passing failure and gives up on a refusal', async () => {
    server.tables.set('transactions', [{ id: 't1' }]);
    const failures = {
      'server error': { message: 'upstream connect error', status: 503 },
      'statement timeout': { message: 'canceling statement due to statement timeout', code: '57014', status: 500 },
      'expired session': { message: 'JWT expired', code: 'PGRST303', status: 401 },
      'row it points at not there yet': { message: 'violates foreign key constraint', code: '23503', status: 409 },
      'row-level security': { message: 'new row violates row-level security policy', code: '42501', status: 403 },
      'check constraint': { message: 'violates check constraint', code: '23514', status: 400 },
    };
    const retryable: Record<string, boolean> = {};
    for (const [name, error] of Object.entries(failures)) {
      server.fail = () => error;
      const result = await gateway.update('transactions', { id: 't1' });
      retryable[name] = !result.ok && result.retryable;
    }
    server.fail = null;
    expect(retryable).toEqual({
      'server error': true,
      'statement timeout': true,
      'expired session': true,
      'row it points at not there yet': true,
      'row-level security': false,
      'check constraint': false,
    });
  });
});
