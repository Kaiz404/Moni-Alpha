-- Development reset: replace emoji categories with the fixed Material Design catalogue.
-- Transaction history remains, but its development category links and all budgets reset.
DELETE FROM public.category_budgets;
UPDATE public.transactions SET category_id = NULL WHERE category_id IS NOT NULL;
DELETE FROM public.categories;

ALTER TABLE public.categories DROP COLUMN IF EXISTS parent_id;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_icon_catalog_check CHECK (icon = ANY (ARRAY[
    'home-variant', 'silverware-fork-knife', 'coffee', 'shopping', 'tshirt-crew',
    'car', 'train', 'airplane', 'briefcase', 'school', 'book-open-page-variant',
    'heart-pulse', 'pill', 'movie-open', 'gamepad-variant-outline', 'music',
    'cellphone', 'wifi', 'gift-outline', 'hand-coin', 'credit-card-outline',
    'package-variant', 'cash', 'laptop', 'chart-line', 'cash-plus'
  ]));

ALTER TABLE public.categories
  ADD CONSTRAINT categories_color_catalog_check CHECK (
    (user_id IS NULL AND color = ANY (ARRAY[
      '#F3B6B2', '#9FD8D5', '#B7D5F0', '#F5C397', '#E8C8A9', '#E9BCA8',
      '#CAD5A5', '#B5CBA0', '#B7C2D3', '#BFC9D6', '#F4B7C1', '#F1D0A9',
      '#AAD8C6', '#A8D6A0', '#A6D8F0', '#AEC5F5', '#E4B1E4', '#EAD978'
    ])) OR
    (user_id IS NOT NULL AND color = ANY (ARRAY[
      '#F2B8B5', '#F4C58B', '#EAD978', '#BEDB8D', '#A8D6A0', '#8FD3C7',
      '#A6D8F0', '#AEC5F5', '#C3B2EF', '#E4B1E4', '#F3B6CF', '#F0C0B6',
      '#D9C6A5', '#C8D2A2', '#B7C9C0', '#C2CAD5'
    ]))
  );

CREATE OR REPLACE FUNCTION public.ensure_category_name_available()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    SELECT 1
    FROM public.categories AS category
    WHERE category.id IS DISTINCT FROM NEW.id
      AND category.is_active
      AND category.type = NEW.type
      AND lower(category.name) = lower(NEW.name)
      AND (category.user_id IS NULL OR category.user_id = NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'An active category with this name already exists';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_category_name_available ON public.categories;
CREATE TRIGGER ensure_category_name_available
  BEFORE INSERT OR UPDATE OF name, type, is_active ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.ensure_category_name_available();

INSERT INTO public.categories (user_id, name, icon, color, type, display_order) VALUES
  (NULL, 'Food & Dining', 'silverware-fork-knife', '#F3B6B2', 'expense', 1),
  (NULL, 'Transportation', 'car', '#9FD8D5', 'expense', 2),
  (NULL, 'Housing', 'home-variant', '#B7D5F0', 'expense', 3),
  (NULL, 'Entertainment', 'movie-open', '#F5C397', 'expense', 4),
  (NULL, 'Shopping', 'shopping', '#E8C8A9', 'expense', 5),
  (NULL, 'Healthcare', 'heart-pulse', '#E9BCA8', 'expense', 6),
  (NULL, 'Work', 'briefcase', '#CAD5A5', 'expense', 7),
  (NULL, 'Education', 'school', '#B5CBA0', 'expense', 8),
  (NULL, 'Travel', 'airplane', '#B7C2D3', 'expense', 9),
  (NULL, 'Subscriptions', 'cellphone', '#BFC9D6', 'expense', 10),
  (NULL, 'Gifts & Donations', 'gift-outline', '#F4B7C1', 'expense', 11),
  (NULL, 'Fees & Charges', 'credit-card-outline', '#F1D0A9', 'expense', 12),
  (NULL, 'Other Expenses', 'package-variant', '#AAD8C6', 'expense', 13),
  (NULL, 'Salary', 'cash', '#A8D6A0', 'income', 1),
  (NULL, 'Freelance', 'laptop', '#A6D8F0', 'income', 2),
  (NULL, 'Investment', 'chart-line', '#AEC5F5', 'income', 3),
  (NULL, 'Gifts', 'gift-outline', '#E4B1E4', 'income', 4),
  (NULL, 'Other Income', 'cash-plus', '#EAD978', 'income', 5);

COMMENT ON TABLE public.categories IS 'Fixed system categories and user-owned custom categories. Icons and colors use the curated Material/pastel catalogue; subcategories are intentionally unsupported.';
