import { z } from 'zod';

// User preferences schema
export const userPreferencesSchema = z.object({
  /** Main currency: the one totals and the Budget tab count in. */
  currency: z.string().length(3).default('MYR'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  notifications_enabled: z.boolean().default(true),
  /** Primary wallet for AI fallback when inference cannot pick one. Synced via profiles. */
  default_wallet_id: z.string().uuid().nullable().optional(),
  /** IANA timezone used for budget month boundaries and debt due states. */
  finance_timezone: z.string().min(1).max(100).optional(),
  /** The month's total budget in the main currency, whole units; null falls back to the sum of category budgets. */
  monthly_budget: z.number().int().positive().nullable().optional(),
});

// Profile schema
export const profileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  avatarUrl: z.string().url().nullable(),
  preferences: userPreferencesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Update profile schema
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  preferences: userPreferencesSchema.partial().optional(),
});

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100),
});

/** Sign-up asks for the month and year of birth, never the day: `YYYY-MM`. */
export const birthMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const MIN_SIGN_UP_AGE = 18;

/**
 * Without the day, someone counts as 18 from the first day of their 18th birthday's month.
 * `today` is read in local time, as the user sees the date.
 */
export function isOldEnoughToSignUp(birthMonth: BirthMonth, today: Date): boolean {
  const [year, month] = birthMonth.split('-').map(Number) as [number, number];
  const monthsOld = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
  return monthsOld >= MIN_SIGN_UP_AGE * 12;
}

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

// Type inference
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type SignUp = z.infer<typeof signUpSchema>;
export type SignIn = z.infer<typeof signInSchema>;
export type BirthMonth = z.infer<typeof birthMonthSchema>;
