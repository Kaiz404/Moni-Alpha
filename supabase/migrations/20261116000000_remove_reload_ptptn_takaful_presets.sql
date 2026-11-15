-- Retire the presets TNG Reloads, PTPTN and Takaful. A soft delete, as when a user deletes a category:
-- the system rows only turn inactive, so transactions, budgets and rules filed under them keep them, and
-- the bumped updated_at makes phones pull the change. No user's row and no transaction changes.
UPDATE public.categories
SET is_active = false
WHERE user_id IS NULL
  AND type = 'expense'
  AND name IN ('TNG Reloads', 'PTPTN', 'Takaful')
  AND is_active;
