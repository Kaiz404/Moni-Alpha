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
] as const;

export const categoryIconSchema = z.enum(categoryIconNames);

/** Reusable light-pastel choices for user-created categories. */
export const customCategoryColors = [
  '#F2B8B5',
  '#F4C58B',
  '#EAD978',
  '#BEDB8D',
  '#A8D6A0',
  '#8FD3C7',
  '#A6D8F0',
  '#AEC5F5',
  '#C3B2EF',
  '#E4B1E4',
  '#F3B6CF',
  '#F0C0B6',
  '#D9C6A5',
  '#C8D2A2',
  '#B7C9C0',
  '#C2CAD5',
] as const;

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
