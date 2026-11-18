import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount } from '../account-functions';

const invoke = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ functions: { invoke } }),
}));

function refusal(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => invoke.mockReset());

describe('deleteAccount', () => {
  it('calls delete-account with an empty body', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await deleteAccount();
    expect(invoke).toHaveBeenCalledWith('delete-account', { body: {} });
  });

  it('reads the function answer as done', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(deleteAccount()).resolves.toEqual({ kind: 'ok', data: { ok: true } });
  });

  it("passes on the function's own refusal with its status", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: refusal(401, { error: 'Sign in again to delete your account' }),
    });
    await expect(deleteAccount()).resolves.toEqual({
      kind: 'refused',
      status: 401,
      message: 'Sign in again to delete your account',
    });
  });

  it('reads a failed fetch as unreachable', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError('offline') });
    await expect(deleteAccount()).resolves.toEqual({ kind: 'unreachable' });
  });

  it('refuses an answer that is not the contract', async () => {
    invoke.mockResolvedValueOnce({ data: { deleted: 'yes' }, error: null });
    await expect(deleteAccount()).resolves.toEqual({
      kind: 'refused',
      status: 200,
      message: 'Moni sent an answer this app does not understand',
    });
  });
});
