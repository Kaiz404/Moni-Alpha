import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { deleteAccount } from '@/lib/auth/account-functions';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

function refusal(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
}

describe('deleteAccount', () => {
  it('reads the function answer as done', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(deleteAccount()).resolves.toEqual({ kind: 'ok', data: { ok: true } });
  });

  it("passes on the function's own refusal with its status", async () => {
    mockInvoke.mockResolvedValueOnce({
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
    mockInvoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError('offline') });
    await expect(deleteAccount()).resolves.toEqual({ kind: 'unreachable' });
  });

  it('refuses an answer that is not the contract', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { deleted: 'yes' }, error: null });
    await expect(deleteAccount()).resolves.toEqual({
      kind: 'refused',
      status: 200,
      message: 'Moni sent an answer this app does not understand',
    });
  });
});
