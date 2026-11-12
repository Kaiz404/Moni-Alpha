import { z } from 'zod';

export const categoryTypeSchema = z.enum(['income', 'expense']);
export const categoryNameMaxLength = 20;

/** The only Material Design icons available for user-created categories. */
export const categoryIconNames = [
  'home-variant',
  'silverware-fork-knife',
  'coffee',
  'shopping',
  'tshirt-crew',
  'car',
  'train',
  'airplane',
  'briefcase',
  'school',
  'book-open-page-variant',
  'heart-pulse',
  'pill',
  'movie-open',
  'gamepad-variant-outline',
  'music',
  'cellphone',
  'wifi',
  'gift-outline',
  'hand-coin',
  'credit-card-outline',
  'package-variant',
  'cash',
  'laptop',
  'chart-line',
  'cash-plus',
  'shield-check',
  'boom-gate',
  'wallet-plus',
] as const;

export const categoryIconSchema = z.enum(categoryIconNames);

/** Reusable choices for user-created categories (the Current+ sharpened catalogue). */
export const customCategoryColors = [
  '#FC7F78',
  '#FBAF51',
  '#FADC35',
  '#ADE451',
  '#7CD76C',
  '#57D8C1',
  '#68CBFB',
  '#75A0FB',
  '#9A76F8',
  '#E77BE7',
  '#FC7AAF',
  '#F8907B',
  '#DAB471',
  '#BDD170',
  '#B7C9C0',
  '#9AAECA',
] as const;

/**
 * Old pastel hex (category catalogue and wallet card swatches) to its Current+ replacement, keyed
 * uppercase. Backups and queued writes made before the palette change still carry the old values.
 */
const legacyColorMap: Readonly<Record<string, string>> = {
  '#F2B8B5': '#FC7F78',
  '#F4C58B': '#FBAF51',
  '#EAD978': '#FADC35',
  '#BEDB8D': '#ADE451',
  '#A8D6A0': '#7CD76C',
  '#8FD3C7': '#57D8C1',
  '#A6D8F0': '#68CBFB',
  '#AEC5F5': '#75A0FB',
  '#C3B2EF': '#9A76F8',
  '#E4B1E4': '#E77BE7',
  '#F3B6CF': '#FC7AAF',
  '#F0C0B6': '#F8907B',
  '#D9C6A5': '#DAB471',
  '#C8D2A2': '#BDD170',
  '#B7C9C0': '#B7C9C0',
  '#C2CAD5': '#9AAECA',
  '#F3B6B2': '#FB7F77',
  '#9FD8D5': '#69DBD5',
  '#B7D5F0': '#7CBDF8',
  '#F5C397': '#FBA75E',
  '#E8C8A9': '#EFAE6F',
  '#E9BCA8': '#F1966D',
  '#CAD5A5': '#BED473',
  '#B5CBA0': '#9BC870',
  '#B7C2D3': '#8CA5CB',
  '#BFC9D6': '#95ADCD',
  '#F4B7C1': '#FC7C91',
  '#F1D0A9': '#FBB96C',
  '#AAD8C6': '#78D7B2',
  '#8ECF9D': '#57D374',
  '#E8CF50': '#F9D51F',
  '#E87D72': '#FA402D',
  '#72CEC4': '#3EDBCA',
  '#B39AE8': '#8C5CF3',
  '#F0AD85': '#FA8A48',
};

/** Maps a pre-Current+ category or wallet hex to its replacement; any other value passes through. */
export function legacyColor<T extends string | null | undefined>(hex: T): T {
  if (typeof hex !== 'string') return hex;
  return (legacyColorMap[hex.toUpperCase()] ?? hex) as T;
}

export const customCategoryColorSchema = z.enum(customCategoryColors);

export type CategoryIconName = z.infer<typeof categoryIconSchema>;
export type CustomCategoryColor = z.infer<typeof customCategoryColorSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  name: z.string().min(1).max(categoryNameMaxLength),
  icon: categoryIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  type: categoryTypeSchema,
  isActive: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(categoryNameMaxLength),
  icon: categoryIconSchema,
  color: customCategoryColorSchema,
  type: categoryTypeSchema,
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(categoryNameMaxLength).optional(),
  icon: categoryIconSchema.optional(),
  color: customCategoryColorSchema.optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

// Reorder categories schema
export const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
});

// Type inference
export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type ReorderCategories = z.infer<typeof reorderCategoriesSchema>;

// API Response types
export type CategoryResponse = {
  category: Category;
};

export type CategoryListResponse = {
  categories: Category[];
};
