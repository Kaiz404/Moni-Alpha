import { describe, expect, it } from 'vitest';

import { planCategoryCreate } from '../categories';

const ctx = { userId: 'user-1', newId: () => 'new-1' };
const category = (name: string, userId: string | null, displayOrder: number, isActive = true, type: 'expense' | 'income' = 'expense') => ({
  name,
  userId,
  type,
  isActive,
  displayOrder,
});

describe('planCategoryCreate', () => {
  it('adds the category last among the user’s own of its type', () => {
    const plan = planCategoryCreate(
      { name: ' Pets ', icon: 'gift-outline', color: '#FC7F78', type: 'expense' },
      [category('Food & Dining', null, 1), category('Hobbies', 'user-1', 104, false), category('Side gig', 'user-1', 110, true, 'income'), category('Theirs', 'user-2', 300)],
      ctx,
    );
    expect(plan).toEqual({
      kind: 'writes',
      result: 'new-1',
      writes: {
        insert: [
          {
            table: 'categories',
            row: { id: 'new-1', user_id: 'user-1', name: 'Pets', icon: 'gift-outline', color: '#FC7F78', type: 'expense', is_active: true, display_order: 105, deleted: false },
          },
        ],
        patch: [],
        softDelete: [],
      },
    });
  });

  it('starts the user’s own after the presets', () => {
    const plan = planCategoryCreate({ name: 'Pets', icon: 'gift-outline', color: '#FC7F78', type: 'expense' }, [category('Food & Dining', null, 1)], ctx);
    expect(plan.kind === 'writes' && plan.writes.insert[0]!.row).toMatchObject({ display_order: 101 });
  });

  it('refuses an active name the user already sees, in any case, but not an archived one or another type’s', () => {
    const existing = [category('Food & Dining', null, 1), category('Pets', 'user-1', 101, false), category('Salary', null, 2, true, 'income')];
    expect(planCategoryCreate({ name: 'food & dining', icon: 'coffee', color: '#FC7F78', type: 'expense' }, existing, ctx)).toEqual({
      kind: 'error',
      message: 'An active category with this name already exists.',
    });
    expect(planCategoryCreate({ name: 'Pets', icon: 'coffee', color: '#FC7F78', type: 'expense' }, existing, ctx).kind).toBe('writes');
    expect(planCategoryCreate({ name: 'Salary', icon: 'coffee', color: '#FC7F78', type: 'expense' }, existing, ctx).kind).toBe('writes');
  });
});
