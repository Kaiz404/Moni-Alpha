import { z } from 'zod';

// Category type enum
export const categoryTypeSchema = z.enum(['income', 'expense']);

// Category schema
export const categorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(), // null for system categories
  name: z.string().min(1).max(100),
  icon: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  parentId: z.string().uuid().nullable(),
  type: categoryTypeSchema,
  isActive: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Create category schema (user-created only)
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  parentId: z.string().uuid().nullable().optional(),
  type: categoryTypeSchema,
});

// Update category schema
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  parentId: z.string().uuid().nullable().optional(),
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
