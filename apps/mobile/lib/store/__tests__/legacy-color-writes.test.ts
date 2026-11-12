import { updateWithCurrentColor } from '@/lib/store';

const sent: { table: string; row: Record<string, unknown>; id?: unknown }[] = [];

jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'user-1',
  supabase: {
    from: (table: string) => ({
      update: (row: Record<string, unknown>) => {
        const call = { table, row } as (typeof sent)[number];
        sent.push(call);
        const query: any = {
          eq: (_field: string, value: unknown) => {
            call.id = value;
            return query;
          },
          select: () => Promise.resolve({ data: [row], error: null }),
        };
        return query;
      },
    }),
    channel: () => {
      const channel: any = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
      return channel;
    },
  },
}));
jest.mock('@/lib/supabase/profile', () => ({ getProfilePreferences: async () => ({}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-id' }));

const params = { onError: jest.fn() };

beforeEach(() => {
  sent.length = 0;
});

describe('an edit queued before the palette change', () => {
  it('reaches the server with the current colour', async () => {
    const result = await updateWithCurrentColor('categories')({ id: 'c1', name: 'Food', color: '#F3B6B2' }, params);
    expect(sent).toEqual([{ table: 'categories', id: 'c1', row: { id: 'c1', name: 'Food', color: '#FB7F77' } }]);
    expect(result.data).toEqual({ id: 'c1', name: 'Food', color: '#FB7F77' });
  });

  it('leaves an edit without a colour alone', async () => {
    await updateWithCurrentColor('wallets')({ id: 'w1', name: 'Cash' }, params);
    expect(sent[0].row).toEqual({ id: 'w1', name: 'Cash' });
  });
});
