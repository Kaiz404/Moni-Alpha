import type { Observable } from '@legendapp/state';
import { listMerchantAliases, nameMerchant } from '../merchant-aliases';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `alias-${++mockNextId}` }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { merchantAliases$: observable({}), assertTableMigrated: () => {} };
});

const { merchantAliases$ } = jest.requireMock('@/lib/store') as {
  merchantAliases$: Observable<Record<string, Record<string, unknown>>>;
};

describe('nameMerchant', () => {
  it('writes one row, and naming the merchant again renames it', async () => {
    await nameMerchant('grab', 'Grab');
    expect(merchantAliases$.peek()).toEqual({
      'alias-1': {
        id: 'alias-1',
        user_id: 'user-1',
        raw_key: 'grab',
        display_name: 'Grab',
        deleted: false,
      },
    });

    await nameMerchant('grab', 'Grab rides');

    expect(Object.keys(merchantAliases$.peek())).toEqual(['alias-1']);
    expect(listMerchantAliases('user-1')).toEqual([
      expect.objectContaining({ rawKey: 'grab', displayName: 'Grab rides' }),
    ]);
  });

  it('refuses a blank name', async () => {
    await expect(nameMerchant('kedai abc', '  ')).rejects.toThrow();
  });
});
