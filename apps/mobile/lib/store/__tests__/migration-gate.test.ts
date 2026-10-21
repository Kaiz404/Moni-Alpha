import { observe } from '@legendapp/state';
import { ALL_STORE_OBSERVABLES, autoAddRules$, enableStoreSync, wallets$ } from '@/lib/store';
import { authReady$ } from '@/lib/store/auth-sync';
import { createAutoAddRule, listAutoAddRules } from '@/lib/supabase/auto-add-rules';

type Row = Record<string, unknown>;

const mockServer = {
  tables: new Map<string, Row[]>(),
  calls: [] as string[],
};

function mockQuery(table: string, op: string) {
  const rows = mockServer.tables.get(table);
  const result = rows
    ? { data: op === 'probe' ? rows.slice(0, 1) : rows, error: null }
    : {
        data: null,
        error: {
          code: 'PGRST205',
          message: `Could not find the table 'public.${table}' in the schema cache`,
        },
      };
  mockServer.calls.push(`${op} ${table}`);
  const query: any = {
    gt: () => query,
    eq: () => query,
    limit: () => {
      mockServer.calls.pop();
      return mockQuery(table, 'probe');
    },
    select: () => query,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'user-1',
  supabase: {
    from: (table: string) => ({
      select: () => mockQuery(table, 'list'),
      insert: (row: Row) => {
        mockServer.tables.get(table)?.push(row);
        return mockQuery(table, 'insert');
      },
      update: () => mockQuery(table, 'update'),
    }),
    channel: () => {
      const channel: any = {
        on: (_event: string, filter: { table: string }) => {
          mockServer.calls.push(`subscribe ${filter.table}`);
          return channel;
        },
        subscribe: () => channel,
        unsubscribe: () => {},
      };
      return channel;
    },
  },
}));
jest.mock('@/lib/supabase/profile', () => ({ getProfilePreferences: async () => ({}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-id' }));

const RULE = {
  id: 'rule-1',
  user_id: 'user-1',
  merchant_key: 'grab',
  source_app: 'com.maybank2u.life',
  wallet_id: 'w1',
  category_id: 'c1',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  deleted: false,
};

const INPUT = {
  merchantKey: 'grab',
  sourceApp: 'com.maybank2u.life',
  walletId: '00000000-0000-4000-8000-00000000000a',
  categoryId: '00000000-0000-4000-8000-00000000000c',
};

const callsFor = (table: string) => mockServer.calls.filter((call) => call.endsWith(` ${table}`));

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('a synced table whose migration is not on the server yet', () => {
  const errors = jest.spyOn(console, 'error');

  it('stays quiet until a probe finds the table, then syncs it', async () => {
    for (const table of ['wallets', 'transactions', 'proposed_transactions']) {
      mockServer.tables.set(table, []);
    }
    ALL_STORE_OBSERVABLES.forEach((obs$) => observe(() => obs$.get()));
    authReady$.set(true);

    await enableStoreSync({ fullReset: true });
    await settle();

    expect(callsFor('auto_add_rules')).toEqual(['probe auto_add_rules']);
    expect(callsFor('merchant_aliases')).toEqual(['probe merchant_aliases']);
    expect(mockServer.calls).toContain('list wallets');
    expect(wallets$.peek()).toEqual({});
    expect(errors).not.toHaveBeenCalled();

    const kedai = { ...INPUT, merchantKey: 'kedai abc' };
    await expect(createAutoAddRule(kedai)).rejects.toThrow('needs a server update');
    expect(listAutoAddRules('user-1')).toEqual([]);
    autoAddRules$['written-while-gated'].set({ ...RULE, id: 'written-while-gated' });

    mockServer.tables.set('auto_add_rules', [RULE]);
    mockServer.calls.length = 0;
    await enableStoreSync({ fullReset: true });
    await settle();
    await createAutoAddRule(kedai);
    await settle();

    const ruleCalls = callsFor('auto_add_rules');
    expect(new Set(ruleCalls)).toEqual(
      new Set([
        'probe auto_add_rules',
        'subscribe auto_add_rules',
        'list auto_add_rules',
        'insert auto_add_rules',
      ]),
    );
    expect(ruleCalls[0]).toBe('probe auto_add_rules');
    expect(ruleCalls.at(-1)).toBe('insert auto_add_rules');
    expect(callsFor('merchant_aliases')).toEqual(['probe merchant_aliases']);
    expect(Object.keys(autoAddRules$.peek() ?? {}).sort()).toEqual(['generated-id', 'rule-1']);
    expect(mockServer.tables.get('auto_add_rules')?.map((row) => row.id)).toEqual([
      'rule-1',
      'generated-id',
    ]);

    mockServer.calls.length = 0;
    await enableStoreSync({ fullReset: true });
    await settle();
    expect(mockServer.calls).not.toContain('probe auto_add_rules');
    expect(errors).not.toHaveBeenCalled();
  });
});
