-- Malaysian presets: PTPTN, Takaful, Tolls, Transit, TNG Reloads. System rows only; no user's row
-- changes. A user who already has a category of one of these names keeps it, and the app hides the
-- preset of the same name from that user (hideShadowedPresets), so neither name appears twice.
ALTER TABLE public.categories DROP CONSTRAINT categories_icon_catalog_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_icon_catalog_check CHECK (icon = ANY (ARRAY[
    'home-variant', 'silverware-fork-knife', 'coffee', 'shopping', 'tshirt-crew',
    'car', 'train', 'airplane', 'briefcase', 'school', 'book-open-page-variant',
    'heart-pulse', 'pill', 'movie-open', 'gamepad-variant-outline', 'music',
    'cellphone', 'wifi', 'gift-outline', 'hand-coin', 'credit-card-outline',
    'package-variant', 'cash', 'laptop', 'chart-line', 'cash-plus',
    'shield-check', 'boom-gate', 'wallet-plus'
  ]));

-- The user's row now shares a name with a preset. Editing its colour must still sync, and the app
-- writes every column on update, so only a real change to name, type or is_active is checked.
CREATE OR REPLACE FUNCTION public.ensure_category_name_available()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active
    AND (
      TG_OP = 'INSERT'
      OR NEW.name IS DISTINCT FROM OLD.name
      OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
    )
    AND EXISTS (
      SELECT 1
      FROM public.categories AS category
      WHERE category.id IS DISTINCT FROM NEW.id
        AND category.is_active
        AND category.type = NEW.type
        AND lower(category.name) = lower(NEW.name)
        AND (category.user_id IS NULL OR category.user_id = NEW.user_id)
    )
  THEN
    RAISE EXCEPTION 'An active category with this name already exists';
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.categories (user_id, name, icon, color, type, display_order)
SELECT NULL, preset.name, preset.icon, preset.color, 'expense', preset.display_order
FROM (VALUES
  ('Transit', 'train', '#A6D8F0', 13),
  ('Tolls', 'boom-gate', '#EAD978', 14),
  ('TNG Reloads', 'wallet-plus', '#A8D6A0', 15),
  ('PTPTN', 'hand-coin', '#AEC5F5', 16),
  ('Takaful', 'shield-check', '#E4B1E4', 17)
) AS preset(name, icon, color, display_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories AS existing
  WHERE existing.user_id IS NULL AND existing.type = 'expense' AND lower(existing.name) = lower(preset.name)
);

UPDATE public.categories
SET display_order = 18
WHERE user_id IS NULL AND type = 'expense' AND name = 'Other Expenses';
