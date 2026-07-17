import { z } from 'zod';

// User preferences schema
export const userPreferencesSchema = z.object({
  currency: z.string().length(3).default('USD'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  notifications_enabled: z.boolean().default(true),
  /** Primary wallet for AI fallback when inference cannot pick one. Synced via profiles. */
  default_wallet_id: z.string().uuid().nullable().optional(),
  /** IANA timezone used for budget month boundaries and debt due states. */
  finance_timezone: z.string().min(1).max(100).optional(),
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

// API Response types
export type ProfileResponse = {
  profile: Profile;
};

export type AuthResponse = {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
};
