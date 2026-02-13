# Moni - Setup & Development Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 9.0.0 (`npm install -g pnpm`)
- **Git** ([Download](https://git-scm.com/))
- **Expo Go** app on your mobile device ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- **Supabase Account** ([Sign up](https://supabase.com/))

**Optional but Recommended:**
- **Android Studio** (for Android emulator)
- **Xcode** (for iOS simulator - macOS only)
- **VS Code** with recommended extensions

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Moni.git
cd Moni
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This will install dependencies for:
- Root workspace
- `apps/mobile`
- `apps/web`
- `packages/ui`
- `packages/database` (to be created)
- `packages/api` (to be created)
- `packages/eslint-config`
- `packages/typescript-config`

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Fill in project details:
   - **Name**: Moni (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
4. Wait for project to provision (~2 minutes)

### 2. Get API Keys

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### 3. Setup Database Schema

#### Option A: Using Supabase SQL Editor (Recommended for Phase 1)

1. In Supabase Dashboard, go to **SQL Editor**
2. Create a new query
3. Copy the complete schema from `docs/DATABASE_SCHEMA.md`
4. Run the query

#### Option B: Using Drizzle Migrations (Phase 1+)

```bash
# From packages/database (to be created)
cd packages/database

# Generate migration
pnpm drizzle-kit generate

# Push to Supabase
pnpm drizzle-kit push
```

### 4. Enable Row Level Security

Verify RLS is enabled on all tables:
```sql
-- Run this in Supabase SQL Editor
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true`.

### 5. Seed System Categories

Run the seed script from `docs/DATABASE_SCHEMA.md` to populate system categories.

---

## Environment Variables

### Web App (`apps/web/.env.local`)

Create `.env.local` file in `apps/web/`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: For development
NODE_ENV=development
```

### Mobile App (`apps/mobile/.env`)

Create `.env` file in `apps/mobile/`:

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# For testing on physical device, use your local IP:
# EXPO_PUBLIC_API_URL=http://192.168.1.x:3000/api
```

**Finding your local IP:**
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

---

## Create Shared Packages

### 1. Create `@repo/database` Package

```bash
mkdir -p packages/database/src
cd packages/database
```

**`packages/database/package.json`:**
```json
{
  "name": "@repo/database",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.4",
    "@supabase/supabase-js": "^2.47.10"
  },
  "devDependencies": {
    "drizzle-kit": "^0.29.1",
    "@repo/typescript-config": "workspace:*"
  }
}
```

**`packages/database/src/schema.ts`:**
```typescript
// Define Drizzle schema here
// See DATABASE_SCHEMA.md for complete schema
import { pgTable, uuid, text, timestamp, decimal, boolean, integer } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  preferences: text('preferences').$type<{
    currency: string;
    theme: 'light' | 'dark' | 'system';
    notifications_enabled: boolean;
  }>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ... add other tables
```

**`packages/database/src/index.ts`:**
```typescript
export * from './schema';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
```

**`packages/database/drizzle.config.ts`:**
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**`packages/database/tsconfig.json`:**
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 2. Create `@repo/types` Package

```bash
mkdir -p packages/types/src
cd packages/types
```

**`packages/types/package.json`:**
```json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./wallet": "./src/wallet.ts",
    "./transaction": "./src/transaction.ts",
    "./category": "./src/category.ts",
    "./tag": "./src/tag.ts"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  }
}
```

**`packages/types/src/wallet.ts`:**
```typescript
import { z } from 'zod';

export const walletTypeSchema = z.enum([
  'bank',
  'cash',
  'credit',
  'debit',
  'ewallet',
  'investment',
  'other',
]);

export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: walletTypeSchema,
  currency: z.string().length(3).default('USD'),
  initialBalance: z.number().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
});

export const walletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  type: walletTypeSchema,
  currency: z.string(),
  initialBalance: z.number(),
  currentBalance: z.number().optional(),
  color: z.string(),
  icon: z.string(),
  isActive: z.boolean(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateWalletSchema = createWalletSchema.partial();

// Type inference
export type WalletType = z.infer<typeof walletTypeSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type CreateWallet = z.infer<typeof createWalletSchema>;
export type UpdateWallet = z.infer<typeof updateWalletSchema>;

// API Response types
export type WalletResponse = {
  wallet: Wallet;
};

export type WalletListResponse = {
  wallets: Wallet[];
};
```

**`packages/types/src/transaction.ts`:**
```typescript
import { z } from 'zod';

export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

export const createTransactionSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  categoryId: z.string().uuid().optional(),
  transferToWalletId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  merchant: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  transactionDate: z.string().datetime().optional(),
  locationLatitude: z.number().min(-90).max(90).optional(),
  locationLongitude: z.number().min(-180).max(180).optional(),
  locationName: z.string().max(200).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.type !== 'transfer' || data.transferToWalletId,
  { message: 'Transfer must have target wallet' }
);

export type CreateTransaction = z.infer<typeof createTransactionSchema>;

// ... add more schemas as needed
```

**`packages/types/src/index.ts`:**
```typescript
// Re-export all types
export * from './wallet';
export * from './transaction';
export * from './category';
export * from './tag';
export * from './user';
export * from './analytics';
export * from './sync';
export * from './api';
```

**`packages/types/tsconfig.json`:**
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Running the Applications

### Start All Apps (Recommended)

From root directory:
```bash
pnpm dev
```

This starts:
- Web app on `http://localhost:3000`
- Mobile app with Expo dev server

### Start Individual Apps

**Web only:**
```bash
pnpm --filter web dev
```

**Mobile only:**
```bash
pnpm --filter mobile dev
```

### Mobile Development Options

After starting the mobile app, you'll see a QR code. Choose your preferred method:

**Option 1: Expo Go (Simplest)**
1. Install Expo Go on your phone
2. Scan QR code with camera (iOS) or Expo Go app (Android)

**Option 2: iOS Simulator (macOS only)**
```bash
# Press 'i' in the Expo terminal
# Or run:
pnpm --filter mobile ios
```

**Option 3: Android Emulator**
```bash
# Press 'a' in the Expo terminal
# Or run:
pnpm --filter mobile android
```

---

## Database Migrations (Mobile)

### Setup Drizzle for Expo

The mobile app needs migrations bundled into the app.

**`apps/mobile/babel.config.js`:**
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ["inline-import", { "extensions": [".sql"] }]
    ]
  };
};
```

**`apps/mobile/metro.config.js`:**
```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

module.exports = config;
```

**`apps/mobile/drizzle.config.ts`:**
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});
```

### Generate Migrations

```bash
cd apps/mobile
pnpm drizzle-kit generate
```

This creates `drizzle/migrations.js` that's automatically bundled.

### Apply Migrations in App

**`apps/mobile/app/_layout.tsx`:**
```typescript
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';

const expoDb = openDatabaseSync('moni.db');
const db = drizzle(expoDb);

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return <Text>Migration error: {error.message}</Text>;
  }

  if (!success) {
    return <Text>Migrating database...</Text>;
  }

  return (
    // Your app layout
  );
}
```

---

## Code Quality Tools

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter web lint
pnpm --filter mobile lint
```

### Type Checking

```bash
# Check all packages
pnpm check-types

# Check specific package
pnpm --filter web check-types
```

### Formatting

```bash
# Format all files
pnpm format

# Check formatting only
pnpm format:check
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Edit code
- Test locally
- Run linter and type checker

### 3. Commit Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

**Commit Message Format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Build/tooling changes

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Testing

### Unit Tests (TODO - Phase 1)

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter api test

# Watch mode
pnpm test:watch
```

### E2E Tests (TODO - Phase 2)

```bash
# Web E2E (Playwright)
pnpm --filter web test:e2e

# Mobile E2E (Maestro)
maestro test apps/mobile/e2e
```

---

## Troubleshooting

### Common Issues

**1. "Module not found" errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

**2. Expo metro bundler issues**
```bash
# Clear Expo cache
cd apps/mobile
npx expo start -c
```

**3. iOS build errors**
```bash
# Clear iOS build cache
cd apps/mobile/ios
pod cache clean --all
pod install
```

**4. Android build errors**
```bash
# Clear Android build cache
cd apps/mobile/android
./gradlew clean
```

**5. Supabase connection errors**
- Verify environment variables are correct
- Check Supabase project is running (not paused)
- Verify API keys are valid

**6. TypeScript errors in IDE**
```bash
# Reload VS Code window
# Or restart TypeScript server
# CMD+Shift+P → "TypeScript: Restart TS Server"
```

---

## VS Code Setup

### Recommended Extensions

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "supabase.supabase-vscode",
    "expo.vscode-expo-tools",
    "oven.bun-vscode",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Workspace Settings

**`.vscode/settings.json`:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

---

## Useful Commands

### Turborepo

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter web build

# Run command in all packages
turbo run lint

# Clear cache
turbo run build --force
```

### Supabase CLI (Optional)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to project
supabase link --project-ref your-project-ref

# Pull database types
supabase gen types typescript --linked > apps/web/src/lib/database.types.ts

# Run migrations locally
supabase db push
```

### Drizzle Kit

```bash
# Generate migration
cd packages/database
pnpm drizzle-kit generate

# Push schema to database
pnpm drizzle-kit push

# Open Drizzle Studio
pnpm drizzle-kit studio
```

---

## Production Deployment

### Web App (Vercel)

1. Connect GitHub repo to Vercel
2. Configure environment variables
3. Deploy

**Environment Variables (Vercel):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Mobile App (EAS Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Resources

### Documentation
- [Expo Docs](https://docs.expo.dev/)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Zod Docs](https://zod.dev/)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Turborepo Docs](https://turbo.build/repo/docs)

### Project Docs
- [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) - Full project overview
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database structure
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - API endpoints

### Community
- Expo Discord: https://chat.expo.dev/
- Supabase Discord: https://discord.supabase.com/

---

## Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Search existing GitHub issues
3. Ask in project Discord/Slack
4. Create a new GitHub issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Error messages/screenshots
   - Environment info (OS, Node version, etc.)

---

*Last Updated: February 14, 2026*
