import type { CreateCategory } from '@repo/types';

import type { FinanceCategory } from '../read-model/types';
import { planned, refused, type PlanContext, type Planned } from './types';

/** A user's own categories order after the presets. */
const LAST_PRESET_ORDER = 100;

/**
 * A new category of the user's, last in their list of its type. The answer is its id. `categories` is every
 * category the user sees, archived ones too, so the order never repeats; an active one of the same type and name refuses it.
 */
export function planCategoryCreate(
  category: CreateCategory,
  categories: readonly Pick<FinanceCategory, 'userId' | 'name' | 'type' | 'isActive' | 'displayOrder'>[],
  ctx: Pick<PlanContext, 'userId' | 'newId'>,
): Planned<string> {
  const name = category.name.trim();
  const seen = categories.filter((each) => each.userId === null || each.userId === ctx.userId);
  if (seen.some((each) => each.isActive && each.type === category.type && each.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()))
    return refused('An active category with this name already exists.');
  const order = Math.max(
    LAST_PRESET_ORDER,
    ...seen.filter((each) => each.userId === ctx.userId && each.type === category.type).map((each) => each.displayOrder),
  );
  const id = ctx.newId();
  return planned(
    {
      insert: [
        {
          table: 'categories',
          row: {
            id,
            user_id: ctx.userId,
            name,
            icon: category.icon,
            color: category.color,
            type: category.type,
            is_active: true,
            display_order: order + 1,
            deleted: false,
          },
        },
      ],
    },
    id,
  );
}
