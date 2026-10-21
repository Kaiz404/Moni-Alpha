import { updateProfilePreferences } from '../profile';

const mockStored = {
  currency: 'MYR',
  theme: 'dark',
  notifications_enabled: true,
  default_wallet_id: '6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f',
};

const mockWrites: unknown[] = [];

jest.mock('@/lib/supabase/client', () => {
  const query = (preferences: () => unknown) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: { preferences: preferences() }, error: null }),
    };
    return chain;
  };
  return {
    getUserId: async () => 'user-1',
    supabase: {
      from: () => ({
        select: () => query(() => mockStored),
        update: (row: { preferences: unknown }) => {
          mockWrites.push(row);
          return query(() => row.preferences);
        },
      }),
    },
  };
});

describe('updateProfilePreferences', () => {
  it('sets the main currency and keeps every other preference', async () => {
    const saved = await updateProfilePreferences({ currency: 'SGD' });

    expect(mockWrites).toEqual([
      {
        preferences: {
          currency: 'SGD',
          theme: 'dark',
          notifications_enabled: true,
          default_wallet_id: '6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f',
        },
      },
    ]);
    expect(saved).toEqual({
      currency: 'SGD',
      theme: 'dark',
      notifications_enabled: true,
      default_wallet_id: '6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f',
    });
  });
});
