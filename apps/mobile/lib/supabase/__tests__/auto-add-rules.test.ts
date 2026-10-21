import type { Observable } from '@legendapp/state';
import { createAutoAddRule, deleteAutoAddRule, listAutoAddRules } from '../auto-add-rules';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `rule-${++mockNextId}` }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { autoAddRules$: observable({}), assertTableMigrated: () => {} };
});

const { autoAddRules$ } = jest.requireMock('@/lib/store') as {
  autoAddRules$: Observable<Record<string, Record<string, unknown>>>;
};

const GRAB = {
  merchantKey: 'grab',
  sourceApp: 'com.maybank2u.life',
  walletId: '00000000-0000-4000-8000-00000000000a',
  categoryId: '00000000-0000-4000-8000-00000000000c',
};

describe('auto-add rules', () => {
  it('writes the rule into the store, live', async () => {
    await createAutoAddRule(GRAB);
    expect(autoAddRules$.peek()).toEqual({
      'rule-1': {
        id: 'rule-1',
        user_id: 'user-1',
        merchant_key: 'grab',
        source_app: 'com.maybank2u.life',
        wallet_id: GRAB.walletId,
        category_id: GRAB.categoryId,
        deleted: false,
      },
    });
  });

  it('reuses the row for the same app and merchant, and revives it after Ask again', async () => {
    const food = '00000000-0000-4000-8000-0000000000f0';
    deleteAutoAddRule('rule-1');
    expect(listAutoAddRules('user-1')).toEqual([]);

    await createAutoAddRule({ ...GRAB, categoryId: food });

    expect(Object.keys(autoAddRules$.peek())).toEqual(['rule-1']);
    expect(listAutoAddRules('user-1')).toEqual([
      expect.objectContaining({ id: 'rule-1', categoryId: food, deleted: false }),
    ]);
  });

  it('rejects a raw merchant instead of a key', async () => {
    await expect(createAutoAddRule({ ...GRAB, merchantKey: 'GRAB*1234' })).rejects.toThrow();
  });
});
